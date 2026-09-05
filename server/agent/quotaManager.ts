import { spawn, execSync } from 'node:child_process';
import { QuotaStatus, AgyQuotaLimit, QuotaLimitsState } from '../../src/types';
import { loadConfig } from '../config';
import { getSafeCliPath } from '../veronica/adapters/antigravityModels';

export type EventBroadcaster = (event: string, payload: any) => void;

class QuotaManager {
  private static instance: QuotaManager;
  private currentStatus: QuotaStatus = {
    exhausted: false,
    lastChecked: Date.now(),
  };
  private broadcaster: EventBroadcaster | null = null;
  private autoClearTimer: NodeJS.Timeout | null = null;

  private cachedLimits: AgyQuotaLimit[] = [];
  private lastLimitsFetchTime: number = 0;
  private limitsCacheTtlMs: number = 60 * 1000; // 1 minute cache
  private isFetchingLimits: boolean = false;
  private pollingIntervalTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): QuotaManager {
    if (!QuotaManager.instance) {
      QuotaManager.instance = new QuotaManager();
    }
    return QuotaManager.instance;
  }

  public setBroadcaster(broadcaster: EventBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  /**
   * Evaluates whether a raw message or status code represents a quota or rate-limit exhaustion.
   */
  public isQuotaExhausted(rawMessage: string = '', statusCode?: number): boolean {
    if (statusCode === 429) return true;
    const msg = String(rawMessage);
    return /quota reached|quota exceeded|subscription to increase your limits|rate limit|resets in|resource_exhausted|too many requests|exceeded your current quota/i.test(
      msg
    );
  }

  /**
   * Parses human-readable or HTTP header reset durations into seconds and timestamps.
   */
  public parseResetDuration(
    rawMessage: string = '',
    retryAfterHeader?: string | null
  ): { resetAt?: number; resetInSeconds?: number; resetText?: string } {
    const text = String(rawMessage);

    // 1. Check HTTP Retry-After header
    if (retryAfterHeader) {
      const trimmed = retryAfterHeader.trim();
      const secVal = parseInt(trimmed, 10);
      if (!isNaN(secVal) && secVal > 0) {
        return {
          resetInSeconds: secVal,
          resetAt: Date.now() + secVal * 1000,
          resetText: this.formatSeconds(secVal),
        };
      }

      // Check if it's an HTTP Date (RFC 7231)
      const parsedDate = Date.parse(trimmed);
      if (!isNaN(parsedDate) && parsedDate > Date.now()) {
        const diffSec = Math.round((parsedDate - Date.now()) / 1000);
        return {
          resetInSeconds: diffSec,
          resetAt: parsedDate,
          resetText: this.formatSeconds(diffSec),
        };
      }
    }

    // 2. Check "Resets in ..." patterns (Antigravity / Google AI Studio / Anthropic CLI)
    const resetsInMatch = text.match(/resets in\s+([^\.\n\r]+)/i);
    if (resetsInMatch && resetsInMatch[1]) {
      const matchText = resetsInMatch[1].trim();
      const totalSec = this.parseDurationText(matchText);
      if (totalSec > 0) {
        return {
          resetInSeconds: totalSec,
          resetAt: Date.now() + totalSec * 1000,
          resetText: matchText,
        };
      }
    }

    // 3. Check "try again in X seconds / minutes" or "retry after X s"
    const retryInMatch = text.match(/(?:retry|try again|wait|backoff)\s+(?:in|after)?\s*(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hours?)/i);
    if (retryInMatch) {
      const val = parseInt(retryInMatch[1], 10);
      const unit = retryInMatch[2].toLowerCase();
      let multiplier = 1;
      if (unit.startsWith('m')) multiplier = 60;
      else if (unit.startsWith('h')) multiplier = 3600;

      const totalSec = val * multiplier;
      return {
        resetInSeconds: totalSec,
        resetAt: Date.now() + totalSec * 1000,
        resetText: this.formatSeconds(totalSec),
      };
    }

    // 4. Default backoff when 429 is received without explicit timestamp: 60 seconds
    return {
      resetInSeconds: 60,
      resetAt: Date.now() + 60 * 1000,
      resetText: '60s',
    };
  }

  /**
   * Helper to parse strings like "2h 45m", "1h", "45m 30s", "12s", "01:23:45"
   */
  public parseDurationText(input: string): number {
    const s = input.toLowerCase().trim();

    // Check hh:mm:ss format
    const colonMatch = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (colonMatch) {
      const hours = parseInt(colonMatch[1], 10) || 0;
      const minutes = parseInt(colonMatch[2], 10) || 0;
      const seconds = colonMatch[3] ? parseInt(colonMatch[3], 10) || 0 : 0;
      return hours * 3600 + minutes * 60 + seconds;
    }

    let totalSeconds = 0;
    const hourMatch = s.match(/(\d+)\s*h(?:ours?)?/);
    if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600;

    const minMatch = s.match(/(\d+)\s*m(?:in(?:utes?)?)?/);
    if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;

    const secMatch = s.match(/(\d+)\s*s(?:ec(?:onds?)?)?/);
    if (secMatch) totalSeconds += parseInt(secMatch[1], 10);

    return totalSeconds;
  }

  public formatSeconds(totalSeconds: number): string {
    if (totalSeconds <= 0) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  /**
   * Registers a real 429 / quota exhaustion event with actual reset timers.
   */
  public recordQuotaExhaustion(opts: {
    rawMessage?: string;
    statusCode?: number;
    retryAfterHeader?: string | null;
    modelName?: string;
    broadcast?: EventBroadcaster;
  }): QuotaStatus {
    const rawMsg = opts.rawMessage || '';
    const { resetAt, resetInSeconds, resetText } = this.parseResetDuration(rawMsg, opts.retryAfterHeader);

    if (this.autoClearTimer) {
      clearTimeout(this.autoClearTimer);
      this.autoClearTimer = null;
    }

    this.currentStatus = {
      exhausted: true,
      statusCode: opts.statusCode || 429,
      resetAt,
      resetInSeconds,
      resetText,
      reason: rawMsg.substring(0, 400).trim() || 'Quota limit reached',
      modelName: opts.modelName,
      lastChecked: Date.now(),
    };

    // Schedule automatic clearing once the reset timer expires
    if (resetInSeconds && resetInSeconds > 0) {
      this.autoClearTimer = setTimeout(() => {
        this.clearQuota(opts.broadcast || this.broadcaster || undefined);
      }, (resetInSeconds + 1) * 1000);
    }

    const broadcaster = opts.broadcast || this.broadcaster;
    if (broadcaster) {
      broadcaster('quota-status-changed', this.currentStatus);
    }

    return this.currentStatus;
  }

  /**
   * Returns the current quota status, automatically clearing if timer has elapsed.
   */
  public getQuotaStatus(): QuotaStatus {
    if (this.currentStatus.exhausted && this.currentStatus.resetAt) {
      const remainingMs = this.currentStatus.resetAt - Date.now();
      if (remainingMs <= 0) {
        this.clearQuota();
      } else {
        const sec = Math.max(0, Math.round(remainingMs / 1000));
        this.currentStatus.resetInSeconds = sec;
      }
    }
    if (this.cachedLimits.length > 0) {
      this.currentStatus.limits = this.cachedLimits;
    }
    return { ...this.currentStatus, lastChecked: Date.now() };
  }

  /**
   * Resets or clears the quota exhaustion flag.
   */
  public clearQuota(broadcast?: EventBroadcaster): QuotaStatus {
    if (this.autoClearTimer) {
      clearTimeout(this.autoClearTimer);
      this.autoClearTimer = null;
    }

    this.currentStatus = {
      exhausted: false,
      lastChecked: Date.now(),
    };

    const broadcaster = broadcast || this.broadcaster;
    if (broadcaster) {
      broadcaster('quota-status-changed', this.currentStatus);
    }

    return this.currentStatus;
  }

  /**
   * Parses headless output from 'agy -p /usage' command.
   * Format example:
   * Gemini Models\tWeekly Limit Remaining\t82%\t2026-09-09T23:47:54Z
   * Gemini Models\tFive Hour Limit Remaining\t94%\t2026-09-03T11:08:24Z
   */
  public parseAgyUsageOutput(rawOutput: string): AgyQuotaLimit[] {
    const limits: AgyQuotaLimit[] = [];
    if (!rawOutput || typeof rawOutput !== 'string') return limits;

    const lines = rawOutput.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Match tab-separated or 2+ spaces separated columns
      const parts = trimmed.split(/\t+|\s{2,}/);
      if (parts.length >= 4) {
        const modelGroup = parts[0].trim();
        const limitType = parts[1].trim();
        const pctRaw = parts[2].replace('%', '').trim();
        const remainingPercentage = parseInt(pctRaw, 10);
        const resetAtUtc = parts[3].trim();

        if (modelGroup && limitType && !isNaN(remainingPercentage)) {
          limits.push({
            modelGroup,
            limitType,
            remainingPercentage: Math.max(0, Math.min(100, remainingPercentage)),
            resetAtUtc,
          });
        }
      } else {
        // Fallback regex match for less regular whitespace
        const match = trimmed.match(/^(.+?)\t+(Weekly Limit Remaining|Five Hour Limit Remaining|[A-Za-z0-9\s]+Limit Remaining)\t+(\d+)%\t+([0-9T:\-Z]+)/i);
        if (match) {
          limits.push({
            modelGroup: match[1].trim(),
            limitType: match[2].trim(),
            remainingPercentage: parseInt(match[3], 10),
            resetAtUtc: match[4].trim(),
          });
        }
      }
    }

    return limits;
  }

  /**
   * Fetches real quotas via 'agy -p /usage' with caching.
   */
  public async fetchQuotaLimits(force: boolean = false): Promise<QuotaLimitsState> {
    const now = Date.now();
    if (!force && this.cachedLimits.length > 0 && now - this.lastLimitsFetchTime < this.limitsCacheTtlMs) {
      return {
        limits: this.cachedLimits,
        lastUpdated: this.lastLimitsFetchTime,
      };
    }

    if (this.isFetchingLimits) {
      return {
        limits: this.cachedLimits,
        lastUpdated: this.lastLimitsFetchTime,
      };
    }

    this.isFetchingLimits = true;
    try {
      const config = loadConfig();
      const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);

      const stdout = await new Promise<string>((resolve, reject) => {
        const proc = spawn(cliPath, ['-p', '/usage'], {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        let err = '';

        proc.stdout?.on('data', (d: Buffer | string) => (out += d.toString()));
        proc.stderr?.on('data', (d: Buffer | string) => (err += d.toString()));

        const timer = setTimeout(() => {
          try {
            if (proc.pid) {
              if (process.platform === 'win32') {
                execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore', windowsHide: true });
              } else {
                proc.kill('SIGKILL');
              }
            }
          } catch {}
          reject(new Error('Timeout querying agy -p /usage'));
        }, 12000);

        proc.on('close', (code: number | null) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve(out);
          } else {
            reject(new Error(`agy -p /usage failed with code ${code}: ${err || out}`));
          }
        });

        proc.on('error', (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const parsed = this.parseAgyUsageOutput(stdout);
      if (parsed.length > 0) {
        this.cachedLimits = parsed;
        this.lastLimitsFetchTime = Date.now();
        this.currentStatus.limits = parsed;

        if (this.broadcaster) {
          this.broadcaster('quota-limits-updated', {
            limits: parsed,
            lastUpdated: this.lastLimitsFetchTime,
          });
          this.broadcaster('quota-status-changed', this.getQuotaStatus());
        }
      }

      return {
        limits: this.cachedLimits,
        lastUpdated: this.lastLimitsFetchTime,
      };
    } catch (err: any) {
      return {
        limits: this.cachedLimits,
        lastUpdated: this.lastLimitsFetchTime,
        error: err.message || 'Failed to query agy limits',
      };
    } finally {
      this.isFetchingLimits = false;
    }
  }

  public getCachedLimits(): QuotaLimitsState {
    return {
      limits: this.cachedLimits,
      lastUpdated: this.lastLimitsFetchTime,
    };
  }

  /**
   * Starts periodic polling of quota limits (default every 15 minutes).
   */
  public startPeriodicPolling(intervalMs: number = 15 * 60 * 1000): void {
    if (this.pollingIntervalTimer) return;

    this.pollingIntervalTimer = setInterval(() => {
      this.fetchQuotaLimits(true).catch(() => {});
    }, intervalMs);
  }

  public stopPeriodicPolling(): void {
    if (this.pollingIntervalTimer) {
      clearInterval(this.pollingIntervalTimer);
      this.pollingIntervalTimer = null;
    }
  }
}

export const quotaManager = QuotaManager.getInstance();
export const parseResetDuration = (rawMessage: string = '', retryAfterHeader?: string | null) =>
  quotaManager.parseResetDuration(rawMessage, retryAfterHeader);
export const parseAgyUsageOutput = (rawOutput: string) =>
  quotaManager.parseAgyUsageOutput(rawOutput);
