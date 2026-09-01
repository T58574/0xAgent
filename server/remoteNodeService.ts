import { EventEmitter } from 'node:events';

export interface RemoteNodeStatus {
  online: boolean;
  host: string;
  port: number;
  latencyMs: number;
  model?: string;
  slotsTotal?: number;
  slotsIdle?: number;
  lastChecked: number;
  error?: string;
}

export class RemoteNodeService extends EventEmitter {
  private static instance: RemoteNodeService;
  private currentStatus: RemoteNodeStatus = {
    online: false,
    host: '127.0.0.1',
    port: 11434,
    latencyMs: 0,
    lastChecked: 0,
  };
  private probeTimer: NodeJS.Timeout | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): RemoteNodeService {
    if (!RemoteNodeService.instance) {
      RemoteNodeService.instance = new RemoteNodeService();
    }
    return RemoteNodeService.instance;
  }

  public startProbe(host: string = '127.0.0.1', port: number = 11434, intervalMs: number = 30000) {
    this.stopProbe();
    this.currentStatus.host = host;
    this.currentStatus.port = port;

    // Run first check immediately
    this.checkHealth(host, port).catch(() => {});

    this.probeTimer = setInterval(() => {
      this.checkHealth(this.currentStatus.host, this.currentStatus.port).catch(() => {});
    }, intervalMs);
  }

  public stopProbe() {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  public async checkHealth(host: string, port: number): Promise<RemoteNodeStatus> {
    const start = Date.now();
    const targetUrl = `http://${host}:${port}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          // Some health endpoints just return plain text "OK"
        }

        const isOnline = res.status === 200;
        const newStatus: RemoteNodeStatus = {
          online: isOnline,
          host,
          port,
          latencyMs,
          slotsTotal: data.slots_total || data.total_slots || undefined,
          slotsIdle: data.slots_idle || data.idle_slots || undefined,
          model: data.model || undefined,
          lastChecked: Date.now(),
        };

        const changed = this.currentStatus.online !== newStatus.online;
        this.currentStatus = newStatus;
        if (changed) {
          this.emit('status_change', newStatus);
        }
        return newStatus;
      } else {
        const newStatus: RemoteNodeStatus = {
          online: false,
          host,
          port,
          latencyMs,
          lastChecked: Date.now(),
          error: `HTTP ${res.status}`,
        };
        const changed = this.currentStatus.online !== false;
        this.currentStatus = newStatus;
        if (changed) {
          this.emit('status_change', newStatus);
        }
        return newStatus;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const newStatus: RemoteNodeStatus = {
        online: false,
        host,
        port,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: err?.message || 'Connection refused',
      };
      const changed = this.currentStatus.online !== false;
      this.currentStatus = newStatus;
      if (changed) {
        this.emit('status_change', newStatus);
      }
      return newStatus;
    }
  }

  public getStatus(): RemoteNodeStatus {
    return { ...this.currentStatus };
  }
}

export const remoteNodeService = RemoteNodeService.getInstance();
