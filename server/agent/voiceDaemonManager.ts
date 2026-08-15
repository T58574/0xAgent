import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { logger } from '../logger';
import { loadConfig } from '../config';

export class VoiceDaemonManager {
  private process: ChildProcess | null = null;
  private isRunningFlag = false;
  private wsBroadcaster: ((event: string, data: any) => void) | null = null;
  private scriptPath: string;

  constructor() {
    this.scriptPath = path.resolve(process.cwd(), 'scripts/voice_daemon.py');
  }

  public setWsBroadcaster(broadcaster: (event: string, data: any) => void) {
    this.wsBroadcaster = broadcaster;
  }

  public isRunning(): boolean {
    return this.isRunningFlag;
  }

  public start(): boolean {
    if (this.isRunningFlag || this.process) {
      return true;
    }

    if (!fs.existsSync(this.scriptPath)) {
      logger.error('VoiceDaemonManager', `Voice daemon script not found at: ${this.scriptPath}`);
      return false;
    }

    try {
      logger.info('VoiceDaemonManager', 'Spawning native desktop voice daemon (voice_daemon.py)...');

      this.process = spawn('python', [this.scriptPath], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          AGENT_API_URL: `http://127.0.0.1:${process.env.PORT || 3001}/api`,
        },
      });

      this.isRunningFlag = true;

      this.process.stdout?.on('data', (data: Buffer) => {
        const str = data.toString().trim();
        if (str) {
          logger.info('VoiceDaemon', str);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const str = data.toString().trim();
        if (str && !str.includes('LOG (VoskAPI')) {
          logger.warn('VoiceDaemon', str);
        }
      });

      this.process.on('close', (code) => {
        logger.info('VoiceDaemonManager', `Voice daemon exited with code: ${code}`);
        this.isRunningFlag = false;
        this.process = null;
        this.broadcastState('idle');
      });

      this.process.on('error', (err) => {
        logger.error('VoiceDaemonManager', `Voice daemon failed to spawn: ${err.message}`);
        this.isRunningFlag = false;
        this.process = null;
      });

      this.broadcastState('idle');
      return true;
    } catch (err: any) {
      logger.error('VoiceDaemonManager', `Error starting voice daemon: ${err?.message || err}`);
      return false;
    }
  }

  public stop() {
    if (this.process) {
      logger.info('VoiceDaemonManager', 'Stopping native desktop voice daemon...');
      try {
        this.process.kill('SIGTERM');
      } catch {}
      this.process = null;
    }
    this.isRunningFlag = false;
    this.broadcastState('stopped');
  }

  public broadcastState(state: 'idle' | 'listening' | 'recording' | 'processing' | 'stopped', extra?: any) {
    if (this.wsBroadcaster) {
      try {
        this.wsBroadcaster('jarvis_voice_state', {
          state,
          daemonRunning: this.isRunningFlag,
          ...extra,
        });
      } catch {}
    }
  }

  public autoStartIfEnabled() {
    const config = loadConfig();
    if (config.tts_config?.wake_word_enabled) {
      this.start();
    }
  }
}

export const voiceDaemonManager = new VoiceDaemonManager();
