import { JarvisState, JarvisActivityLog } from '../../src/types';
import { proactiveCompanion } from './proactiveCompanion';
import { processWatcher } from './processWatcher';
import { ttsService } from '../ttsService';
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
        currentTask: 'Monitoring system telemetry, companion sparks, and project health',
        updatedAt: Date.now(),
      },
    ],
    recentActivities: [
      {
        id: 'init-1',
        timestamp: Date.now(),
        agent: 'Jarvis Supervisor',
        message: 'Jarvis Proactive Companion initialized and standing by.',
        type: 'info',
      },
    ],
    activeSparks: [],
    isSpeaking: false,
    updatedAt: Date.now(),
  };

  private wsBroadcaster: ((event: string, data: any) => void) | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startLoop();
  }

  public setWsBroadcaster(broadcaster: (event: string, data: any) => void) {
    this.wsBroadcaster = broadcaster;
    proactiveCompanion.setWsBroadcaster(broadcaster);
    ttsService.setWsBroadcaster(broadcaster);
  }

  public getState(): JarvisState {
    const osStatus = processWatcher.getStatus();

    return {
      ...this.state,
      supervisorStatus: osStatus.state === 'gaming' ? 'idle' : this.state.supervisorStatus,
      activeSparks: proactiveCompanion.getActiveSparks(),
      isSpeaking: ttsService.isSpeaking(),
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
        logger.error('JarvisSupervisor', `WS broadcast error: ${err?.message || err}`);
      }
    }
  }
}

export const jarvisSupervisor = new JarvisSupervisor();
