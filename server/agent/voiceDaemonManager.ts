import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { logger } from '../logger';
import { loadConfig } from '../config';

const DAEMON_PORT = 3002;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;

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
    if (this.isRunningFlag && this.process) {
      return true;
    }

    if (!fs.existsSync(this.scriptPath)) {
      logger.error('VoiceDaemonManager', `Voice daemon script not found at: ${this.scriptPath}`);
      return false;
    }

    try {
      logger.info('VoiceDaemonManager', 'Spawning native desktop voice daemon (voice_daemon.py)...');

      this.process = spawn('python', ['-u', this.scriptPath], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          AGENT_API_URL: `http://127.0.0.1:${process.env.PORT || 3001}/api`,
          VOICE_DAEMON_PORT: DAEMON_PORT.toString(),
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
        this.broadcastState('stopped');
      });

      this.process.on('error', (err) => {
        logger.error('VoiceDaemonManager', `Voice daemon failed to spawn: ${err.message}`);
        this.isRunningFlag = false;
        this.process = null;
        this.broadcastState('stopped');
      });

      this.broadcastState('idle');
      return true;
    } catch (err: any) {
      logger.error('VoiceDaemonManager', `Error starting voice daemon: ${err?.message || err}`);
      this.isRunningFlag = false;
      return false;
    }
  }

  public stop() {
    if (this.process) {
      logger.info('VoiceDaemonManager', 'Stopping native desktop voice daemon...');
      const pid = this.process.pid;
      try {
        if (process.platform === 'win32' && pid) {
          spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
        } else {
          this.process.kill('SIGTERM');
        }
      } catch (err: any) {
        logger.warn('VoiceDaemonManager', `Error stopping daemon: ${err?.message || err}`);
      }
      this.process = null;
    }
    this.isRunningFlag = false;
    this.broadcastState('stopped');
  }

  public async startRecording(): Promise<boolean> {
    if (!this.isRunningFlag) {
      this.start();
      await new Promise((r) => setTimeout(r, 600));
    }

    try {
      const res = await fetch(`${DAEMON_URL}/record/start`, { method: 'POST', signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        this.broadcastState('recording');
        return true;
      }
    } catch {
      // Fallback via stdin
      if (this.process?.stdin?.writable) {
        this.process.stdin.write('START\n');
        this.broadcastState('recording');
        return true;
      }
    }
    return false;
  }

  public async stopRecording(): Promise<boolean> {
    try {
      const res = await fetch(`${DAEMON_URL}/record/stop`, { method: 'POST', signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        this.broadcastState('processing');
        return true;
      }
    } catch {
      // Fallback via stdin
      if (this.process?.stdin?.writable) {
        this.process.stdin.write('STOP\n');
        this.broadcastState('processing');
        return true;
      }
    }
    return false;
  }

  public async toggleRecording(): Promise<boolean> {
    if (!this.isRunningFlag) {
      return this.startRecording();
    }

    try {
      const res = await fetch(`${DAEMON_URL}/record/toggle`, { method: 'POST', signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data: any = await res.json();
        this.broadcastState(data.state || 'recording');
        return true;
      }
    } catch {
      if (this.process?.stdin?.writable) {
        this.process.stdin.write('TOGGLE\n');
        return true;
      }
    }
    return false;
  }

  public notifyTtsSpeaking(speaking: boolean) {
    if (!this.isRunningFlag) return;
    try {
      fetch(`${DAEMON_URL}/tts-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_speaking: speaking }),
        signal: AbortSignal.timeout(800),
      }).catch(() => {
        if (this.process?.stdin?.writable) {
          this.process.stdin.write(speaking ? 'TTS_ON\n' : 'TTS_OFF\n');
        }
      });
    } catch {}
  }

  public restart(): boolean {
    this.stop();
    return this.start();
  }

  public syncWithConfig(enabled: boolean) {
    if (enabled && !this.isRunningFlag) {
      this.start();
    } else if (!enabled && this.isRunningFlag) {
      this.stop();
    }
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
