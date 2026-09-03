import { randomUUID } from 'node:crypto';
import { getProxyDb } from './proxyDb';
import { parseProxyLine, detectProtocol, testSocks5Handshake, testHttpProxy } from './proxyParser';
import { ProxyItem, ProxyProtocol, ProxyStatus, ProxyExportConfig, ProxyHealthCheckResult } from '../src/types';

export class ProxyService {
  private static instance: ProxyService;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private checkIntervalMs = 60000; // 60s default
  private wsBroadcaster: ((event: string, payload: any) => void) | null = null;
  private alertListeners: Array<(event: 'expired' | 'offline', proxy: ProxyItem) => void> = [];

  private constructor() {}

  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  public setBroadcaster(fn: (event: string, payload: any) => void): void {
    this.wsBroadcaster = fn;
  }

  public onAlert(listener: (event: 'expired' | 'offline', proxy: ProxyItem) => void): void {
    this.alertListeners.push(listener);
  }

  /**
   * Add a single proxy line or batch of lines
   */
  public async addProxies(
    rawInput: string,
    defaultProtocol?: ProxyProtocol,
    defaultExpiresAt?: number | null
  ): Promise<{ added: ProxyItem[]; errors: string[] }> {
    const lines = rawInput.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const added: ProxyItem[] = [];
    const errors: string[] = [];

    const db = getProxyDb();

    for (const line of lines) {
      const parsed = parseProxyLine(line);
      if (!parsed) {
        errors.push(`Не удалось распарсить прокси: "${line}"`);
        continue;
      }

      // Check if already exists in DB
      const existing = db.prepare('SELECT id FROM proxies WHERE host = ? AND port = ?').get(parsed.host, parsed.port) as any;
      if (existing) {
        errors.push(`Прокси ${parsed.host}:${parsed.port} уже добавлен`);
        continue;
      }

      // Detect protocol if not explicitly specified
      let protocol: ProxyProtocol = parsed.protocol || defaultProtocol || 'http';
      if (!parsed.protocol && !defaultProtocol) {
        const detected = await detectProtocol(parsed.host, parsed.port, parsed.auth, 2500);
        if (detected) {
          protocol = detected.protocol;
        }
      }

      const id = randomUUID();
      const now = Date.now();
      const expiresAt = parsed.expires_at || defaultExpiresAt || null;

      const item: ProxyItem = {
        id,
        raw_line: line,
        host: parsed.host,
        port: parsed.port,
        protocol,
        auth: parsed.auth || null,
        status: 'unknown',
        latency_ms: null,
        last_checked_at: null,
        added_at: now,
        expires_at: expiresAt,
        is_active: true,
        error_message: null,
        tag: parsed.tag || null,
      };

      db.prepare(`
        INSERT INTO proxies (id, raw_line, host, port, protocol, username, password, status, latency_ms, last_checked_at, added_at, expires_at, is_active, error_message, tag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.raw_line,
        item.host,
        item.port,
        item.protocol,
        item.auth?.username || null,
        item.auth?.password || null,
        item.status,
        item.latency_ms,
        item.last_checked_at,
        item.added_at,
        item.expires_at,
        item.is_active ? 1 : 0,
        item.error_message || null,
        item.tag || null
      );

      added.push(item);
    }

    if (this.wsBroadcaster && added.length > 0) {
      this.wsBroadcaster('proxy-updated', { type: 'batch_add', count: added.length });
    }

    // Trigger asynchronous health check for newly added proxies
    if (added.length > 0) {
      setImmediate(() => {
        for (const item of added) {
          this.checkSingleProxy(item.id).catch(() => {});
        }
      });
    }

    return { added, errors };
  }

  /**
   * List all stored proxies with optional filters
   */
  public listProxies(options?: {
    isActiveOnly?: boolean;
    status?: ProxyStatus;
    protocol?: ProxyProtocol;
    tag?: string;
  }): ProxyItem[] {
    const db = getProxyDb();
    let query = 'SELECT * FROM proxies WHERE 1=1';
    const params: any[] = [];

    if (options?.isActiveOnly) {
      query += ' AND is_active = 1';
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.protocol) {
      query += ' AND protocol = ?';
      params.push(options.protocol);
    }
    if (options?.tag) {
      query += ' AND tag = ?';
      params.push(options.tag);
    }

    query += ' ORDER BY added_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.rowToProxyItem(r));
  }

  /**
   * Get single proxy by ID
   */
  public getProxyById(id: string): ProxyItem | null {
    const db = getProxyDb();
    const row = db.prepare('SELECT * FROM proxies WHERE id = ?').get(id) as any;
    return row ? this.rowToProxyItem(row) : null;
  }

  /**
   * Delete a proxy
   */
  public deleteProxy(id: string): boolean {
    const db = getProxyDb();
    const info = db.prepare('DELETE FROM proxies WHERE id = ?').run(id);
    if (info.changes > 0 && this.wsBroadcaster) {
      this.wsBroadcaster('proxy-updated', { type: 'delete', id });
    }
    return info.changes > 0;
  }

  /**
   * Toggle proxy active status
   */
  public setActive(id: string, isActive: boolean): ProxyItem | null {
    const db = getProxyDb();
    db.prepare('UPDATE proxies SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
    const updated = this.getProxyById(id);
    if (updated && this.wsBroadcaster) {
      this.wsBroadcaster('proxy-updated', { type: 'toggle_active', proxy: updated });
    }
    return updated;
  }

  /**
   * Health-check a single proxy
   */
  public async checkSingleProxy(id: string): Promise<ProxyHealthCheckResult> {
    const proxy = this.getProxyById(id);
    if (!proxy) {
      throw new Error(`Proxy with ID ${id} not found`);
    }

    const now = Date.now();

    // 1. Check expiration
    if (proxy.expires_at && proxy.expires_at <= now) {
      this.updateProxyStatus(id, 'expired', null, 'Срок аренды прокси истек', now);
      this.emitAlert('expired', { ...proxy, status: 'expired' });
      return { proxyId: id, protocol: proxy.protocol, status: 'expired', latencyMs: null, error: 'Expired' };
    }

    // 2. Perform connection probe based on protocol
    let status: ProxyStatus = 'offline';
    let latency: number | null = null;
    let error: string | null = null;

    try {
      if (proxy.protocol === 'socks5') {
        const res = await testSocks5Handshake(proxy.host, proxy.port, proxy.auth, 3500);
        if (res.success) {
          status = 'online';
          latency = res.latencyMs;
        } else {
          status = 'offline';
          error = 'SOCKS5 handshake failed';
        }
      } else {
        const res = await testHttpProxy(proxy.host, proxy.port, proxy.auth, 3500);
        if (res.success) {
          status = 'online';
          latency = res.latencyMs;
        } else {
          status = 'offline';
          error = 'HTTP CONNECT probe failed';
        }
      }
    } catch (err: any) {
      status = 'offline';
      error = err?.message || 'Connection error';
    }

    const previousStatus = proxy.status;
    this.updateProxyStatus(id, status, latency, error, now);

    const updatedProxy = this.getProxyById(id);
    if (updatedProxy) {
      if (previousStatus === 'online' && status === 'offline') {
        this.emitAlert('offline', updatedProxy);
      }
      if (this.wsBroadcaster) {
        this.wsBroadcaster('proxy-checked', { proxy: updatedProxy });
      }
    }

    return { proxyId: id, protocol: proxy.protocol, status, latencyMs: latency, error };
  }

  /**
   * Run health check across all active proxies
   */
  public async checkAllProxies(): Promise<ProxyHealthCheckResult[]> {
    if (this.isChecking) return [];
    this.isChecking = true;

    try {
      const proxies = this.listProxies({ isActiveOnly: true });
      const results: ProxyHealthCheckResult[] = [];

      // Run in parallel chunks of 5 to avoid socket exhaustion
      const chunkSize = 5;
      for (let i = 0; i < proxies.length; i += chunkSize) {
        const chunk = proxies.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(
          chunk.map((p) => this.checkSingleProxy(p.id).catch((err) => ({
            proxyId: p.id,
            protocol: p.protocol,
            status: 'offline' as ProxyStatus,
            latencyMs: null,
            error: String(err),
          })))
        );
        results.push(...chunkResults);
      }

      return results;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Start background health-check scheduler
   */
  public startHealthCheckScheduler(intervalMs = 60000): void {
    this.checkIntervalMs = intervalMs;
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.checkAllProxies().catch((err) => {
        console.error('[0xProxy Health-Checker Error]:', err);
      });
    }, this.checkIntervalMs);

    // Initial check
    setTimeout(() => {
      this.checkAllProxies().catch(() => {});
    }, 2000);
  }

  /**
   * Stop health-check scheduler
   */
  public stopHealthCheckScheduler(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Export proxy configuration for external modules (T58574, Python scripts, curl, etc.)
   */
  public exportConfig(format: 'json' | 'txt' | 'env' = 'json'): string | ProxyExportConfig {
    const proxies = this.listProxies({ isActiveOnly: true });

    if (format === 'json') {
      const config: ProxyExportConfig = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        total: proxies.length,
        active_count: proxies.filter((p) => p.status === 'online').length,
        proxies: proxies.map((p) => {
          let authStr = '';
          if (p.auth?.username) {
            authStr = `${encodeURIComponent(p.auth.username)}:${encodeURIComponent(p.auth.password || '')}@`;
          }
          const url = `${p.protocol}://${authStr}${p.host}:${p.port}`;
          return {
            url,
            protocol: p.protocol,
            host: p.host,
            port: p.port,
            username: p.auth?.username,
            password: p.auth?.password,
            status: p.status,
            latency_ms: p.latency_ms,
            expires_at: p.expires_at ? new Date(p.expires_at).toISOString() : null,
          };
        }),
      };
      return config;
    }

    if (format === 'txt') {
      return proxies
        .map((p) => {
          if (p.auth?.username) {
            return `${p.host}:${p.port}:${p.auth.username}:${p.auth.password || ''}`;
          }
          return `${p.host}:${p.port}`;
        })
        .join('\n');
    }

    // env format: HTTP_PROXY=..., HTTPS_PROXY=..., ALL_PROXY=...
    const online = proxies.find((p) => p.status === 'online') || proxies[0];
    if (!online) return '';

    let authStr = '';
    if (online.auth?.username) {
      authStr = `${encodeURIComponent(online.auth.username)}:${encodeURIComponent(online.auth.password || '')}@`;
    }
    const proxyUrl = `${online.protocol}://${authStr}${online.host}:${online.port}`;
    return `HTTP_PROXY="${proxyUrl}"\nHTTPS_PROXY="${proxyUrl}"\nALL_PROXY="${proxyUrl}"\n`;
  }

  /**
   * Get an active online proxy URL or agent string for internal consumers
   */
  public getBestProxy(): ProxyItem | null {
    const online = this.listProxies({ isActiveOnly: true, status: 'online' });
    if (online.length === 0) return null;

    // Pick lowest latency
    online.sort((a, b) => (a.latency_ms ?? 9999) - (b.latency_ms ?? 9999));
    return online[0];
  }

  private updateProxyStatus(
    id: string,
    status: ProxyStatus,
    latencyMs: number | null,
    errorMessage: string | null,
    now: number
  ): void {
    const db = getProxyDb();
    db.prepare(`
      UPDATE proxies
      SET status = ?, latency_ms = ?, error_message = ?, last_checked_at = ?
      WHERE id = ?
    `).run(status, latencyMs, errorMessage, now, id);
  }

  private emitAlert(event: 'expired' | 'offline', proxy: ProxyItem): void {
    for (const listener of this.alertListeners) {
      try {
        listener(event, proxy);
      } catch (err) {
        console.error('[0xProxy Alert Listener Error]:', err);
      }
    }
  }

  private rowToProxyItem(row: any): ProxyItem {
    return {
      id: row.id,
      raw_line: row.raw_line,
      host: row.host,
      port: row.port,
      protocol: row.protocol as ProxyProtocol,
      auth: row.username ? { username: row.username, password: row.password || '' } : null,
      status: row.status as ProxyStatus,
      latency_ms: row.latency_ms !== null ? Number(row.latency_ms) : null,
      last_checked_at: row.last_checked_at ? Number(row.last_checked_at) : null,
      added_at: Number(row.added_at),
      expires_at: row.expires_at ? Number(row.expires_at) : null,
      is_active: Boolean(row.is_active),
      error_message: row.error_message || null,
      tag: row.tag || null,
    };
  }
}

export const proxyService = ProxyService.getInstance();
