import { JarvisState, JarvisWorkerStatus, JarvisActivityLog } from '../../src/types';
import { julesService } from '../julesService';
import { logger } from '../logger';

export class JarvisSupervisor {
  private state: JarvisState = {
    isActive: true,
    supervisorStatus: 'idle',
    activeWorkers: [
      {
        id: 'supervisor-main',
        name: 'Jarvis Core Supervisor',
        type: 'supervisor',
        status: 'idle',
        currentTask: 'Monitoring system activity and cloud workers',
        updatedAt: Date.now(),
      },
    ],
    recentActivities: [
      {
        id: 'init-1',
        timestamp: Date.now(),
        agent: 'Jarvis Supervisor',
        message: 'Jarvis Supervisor initialized and monitoring background workers.',
        type: 'info',
      },
    ],
    updatedAt: Date.now(),
  };

  private wsBroadcaster: ((event: string, data: any) => void) | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startLoop();
  }

  public setWsBroadcaster(broadcaster: (event: string, data: any) => void) {
    this.wsBroadcaster = broadcaster;
  }

  public getState(): JarvisState {
    // Sync active Jules workers into activeWorkers list
    const julesSessions = julesService.getCachedSessions();
    const julesWorkers: JarvisWorkerStatus[] = julesSessions.map((s) => {
      let status: JarvisWorkerStatus['status'] = 'running';
      if (s.status === 'WAITING_PLAN_APPROVAL') status = 'waiting_approval';
      if (s.status === 'PR_CREATED' || s.status === 'COMPLETED') status = 'completed';
      if (s.status === 'FAILED') status = 'error';

      const prUrl = s.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;

      return {
        id: `jules-${s.id}`,
        name: `Jules Cloud Worker (${s.title.slice(0, 25)})`,
        type: 'jules',
        status,
        currentTask: s.prompt,
        prUrl,
        updatedAt: s.updatedAt,
      };
    });

    const staticWorkers = this.state.activeWorkers.filter((w) => w.type !== 'jules');

    return {
      ...this.state,
      activeWorkers: [...staticWorkers, ...julesWorkers],
      updatedAt: Date.now(),
    };
  }

  public logActivity(
    agent: JarvisActivityLog['agent'],
    message: string,
    type: JarvisActivityLog['type'] = 'info'
  ) {
    const log: JarvisActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      agent,
      message,
      type,
    };

    this.state.recentActivities.unshift(log);
    if (this.state.recentActivities.length > 50) {
      this.state.recentActivities = this.state.recentActivities.slice(0, 50);
    }
    this.state.updatedAt = Date.now();
    this.broadcastState();
  }

  public updateSupervisorStatus(status: JarvisState['supervisorStatus'], currentTask?: string) {
    this.state.supervisorStatus = status;
    const coreWorker = this.state.activeWorkers.find((w) => w.id === 'supervisor-main');
    if (coreWorker) {
      coreWorker.status = status === 'analyzing' ? 'running' : 'idle';
      if (currentTask) coreWorker.currentTask = currentTask;
      coreWorker.updatedAt = Date.now();
    }
    this.state.updatedAt = Date.now();
    this.broadcastState();
  }

  private startLoop() {
    this.intervalTimer = setInterval(() => {
      this.runSupervisorCycle();
    }, 15000);
  }

  public stopLoop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private runSupervisorCycle() {
    try {
      const sessions = julesService.getCachedSessions();
      for (const s of sessions) {
        if (s.status === 'PR_CREATED' && !this.state.recentActivities.some((a) => a.message.includes(s.id))) {
          const prUrl = s.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;
          this.logActivity(
            'Jules Cloud Worker',
            `Pull Request successfully created for task "${s.title}"! ${prUrl ? `PR: ${prUrl}` : ''} [${s.id}]`,
            'success'
          );
        } else if (
          s.status === 'WAITING_PLAN_APPROVAL' &&
          !this.state.recentActivities.some((a) => a.message.includes(`plan-${s.id}`))
        ) {
          this.logActivity(
            'Jarvis Supervisor',
            `Task "${s.title}" requires plan approval. Review plan in Jules widget. [plan-${s.id}]`,
            'warning'
          );
        }
      }
      this.broadcastState();
    } catch (err: any) {
      logger.error('JarvisSupervisor', `Loop cycle error: ${err?.message || err}`);
    }
  }

  private broadcastState() {
    if (this.wsBroadcaster) {
      try {
        this.wsBroadcaster('jarvis_state_update', this.getState());
      } catch (err: any) {
        logger.error('JarvisSupervisor', `Broadcast failed: ${err?.message || err}`);
      }
    }
  }
}

export const jarvisSupervisor = new JarvisSupervisor();
