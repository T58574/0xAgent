import { ChildProcess } from 'node:child_process';
import { VeronicaLogger } from '../core/logger';

export interface WatchdogOptions {
  taskId: string;
  child: ChildProcess;
  inactivityTimeoutMs?: number;
  maxToolCalls?: number;
  onStall?: () => void;
  onCircuitBreaker?: (toolCallCount: number) => void;
}

export class AntigravityWatchdog {
  private taskId: string;
  private child: ChildProcess;
  private inactivityTimeoutMs: number;
  private maxToolCalls: number;
  private timer: NodeJS.Timeout | null = null;
  private toolCallCount: number = 0;
  private circuitBreakerTriggered: boolean = false;
  private onStall?: () => void;
  private onCircuitBreaker?: (toolCallCount: number) => void;

  constructor(options: WatchdogOptions) {
    this.taskId = options.taskId;
    this.child = options.child;
    this.inactivityTimeoutMs = options.inactivityTimeoutMs || 90000;
    this.maxToolCalls = options.maxToolCalls || 120;
    this.onStall = options.onStall;
    this.onCircuitBreaker = options.onCircuitBreaker;
  }

  public start(): void {
    this.resetTimer();
  }

  public resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.handleStall();
    }, this.inactivityTimeoutMs);
  }

  public recordToolCall(toolName: string): { count: number; tripped: boolean } {
    this.toolCallCount++;
    if (this.toolCallCount >= this.maxToolCalls && !this.circuitBreakerTriggered) {
      this.circuitBreakerTriggered = true;
      this.handleCircuitBreaker(toolName);
      return { count: this.toolCallCount, tripped: true };
    }
    return { count: this.toolCallCount, tripped: false };
  }

  public getToolCallCount(): number {
    return this.toolCallCount;
  }

  public isCircuitBreakerTripped(): boolean {
    return this.circuitBreakerTriggered;
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private handleStall(): void {
    VeronicaLogger.log(
      'WARN',
      `[Antigravity Watchdog] Task ${this.taskId} stalled (no stream activity for ${Math.round(this.inactivityTimeoutMs / 1000)}s). Terminating hung process.`,
      this.taskId
    );
    try {
      this.child.kill('SIGTERM');
      setTimeout(() => {
        try {
          this.child.kill('SIGKILL');
        } catch {}
      }, 3000);
    } catch {}

    if (this.onStall) {
      this.onStall();
    }
  }

  private handleCircuitBreaker(toolName: string): void {
    VeronicaLogger.log(
      'WARN',
      `[Circuit Breaker] Task ${this.taskId} reached tool limit (${this.toolCallCount}/${this.maxToolCalls}) on tool '${toolName}'. Terminating process.`,
      this.taskId
    );
    try {
      this.child.kill('SIGTERM');
      setTimeout(() => {
        try {
          this.child.kill('SIGKILL');
        } catch {}
      }, 3000);
    } catch {}

    if (this.onCircuitBreaker) {
      this.onCircuitBreaker(this.toolCallCount);
    }
  }
}
