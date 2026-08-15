import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ttsService, PRESET_PHRASES } from '../ttsService';
import { voiceMacroService } from './voiceMacroService';
import { proactiveCompanion } from './proactiveCompanion';
import { jarvisSupervisor } from './jarvisSupervisor';
import { processWatcher } from './processWatcher';
import { logger } from '../logger';

export interface DiagnosticCheckResult {
  name: string;
  category: 'audio' | 'speech_recognition' | 'tts' | 'macros' | 'supervisor' | 'hardware';
  status: 'passed' | 'warning' | 'failed';
  message: string;
  details?: any;
  durationMs: number;
}

export interface SystemDiagnosticReport {
  timestamp: number;
  overallStatus: 'healthy' | 'degraded' | 'error';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  durationMs: number;
  checks: DiagnosticCheckResult[];
}

export class JarvisDiagnostics {
  /**
   * Runs an end-to-end diagnostic calibration of all Jarvis subsystems.
   */
  public async runFullDiagnostics(): Promise<SystemDiagnosticReport> {
    const startTime = Date.now();
    const checks: DiagnosticCheckResult[] = [];

    // 1. Check Voice Daemon script on disk
    checks.push(await this.checkVoiceDaemonScript());

    // 2. Check TTS Engine & Caching
    checks.push(await this.checkTtsEngine());

    // 3. Check Leading Greeting & Self-Echo Stripper
    checks.push(this.checkGreetingStripper());

    // 4. Check Voice Macro Dispatcher
    checks.push(this.checkVoiceMacroDispatcher());

    // 5. Check Jarvis Supervisor & Initiatives Engine
    checks.push(await this.checkSupervisorEngine());

    // 6. Check OS Process Watcher
    checks.push(await this.checkProcessWatcher());

    // 7. Check Hardware & Microphone Stream Availability
    checks.push(await this.checkMicrophoneHardware());

    const totalChecks = checks.length;
    const passedChecks = checks.filter((c) => c.status === 'passed').length;
    const failedChecks = checks.filter((c) => c.status === 'failed').length;

    let overallStatus: SystemDiagnosticReport['overallStatus'] = 'healthy';
    if (failedChecks > 0) {
      overallStatus = 'error';
    } else if (checks.some((c) => c.status === 'warning')) {
      overallStatus = 'degraded';
    }

    const report: SystemDiagnosticReport = {
      timestamp: Date.now(),
      overallStatus,
      totalChecks,
      passedChecks,
      failedChecks,
      durationMs: Date.now() - startTime,
      checks,
    };

    logger.info('JarvisDiagnostics', `Diagnostics completed with status [${overallStatus.toUpperCase()}]: ${passedChecks}/${totalChecks} passed in ${report.durationMs}ms`);
    return report;
  }

  /**
   * Simulates a dialogue interaction for self-testing and autonomous calibration.
   */
  public async simulateVoiceDialogue(simulatedVoiceText: string): Promise<{
    input: string;
    cleanedCommand: string;
    macroHandled: boolean;
    macroAction?: string;
    isOnlyGreeting: boolean;
    ttsSpokenPhrase?: string;
    supervisorState: any;
  }> {
    // 1. Process with greeting cleaner
    const { cleanText, isOnlyGreeting } = ttsService.cleanLeadingJarvisPhrase(simulatedVoiceText);

    // 2. Test Macro Execution
    const macro = voiceMacroService.processCommand(cleanText);

    // 3. Spoken phrase synthesis test
    let ttsSpokenPhrase: string | undefined;
    if (macro.handled) {
      ttsSpokenPhrase = PRESET_PHRASES.macro ? PRESET_PHRASES.macro[0] : 'Выполняю команду, сэр.';
    } else if (isOnlyGreeting) {
      ttsSpokenPhrase = undefined;
    } else {
      ttsSpokenPhrase = `Команда принята: ${cleanText}`;
    }

    // 4. Log to Supervisor
    jarvisSupervisor.logActivity('System', `[Synthetic Simulation] Voice input: "${simulatedVoiceText}" -> Clean: "${cleanText}" (Macro: ${macro.handled})`, 'info');

    return {
      input: simulatedVoiceText,
      cleanedCommand: cleanText,
      macroHandled: macro.handled,
      macroAction: macro.description,
      isOnlyGreeting,
      ttsSpokenPhrase,
      supervisorState: jarvisSupervisor.getState(),
    };
  }

  private async checkVoiceDaemonScript(): Promise<DiagnosticCheckResult> {
    const t0 = Date.now();
    const daemonPath = path.join(process.cwd(), 'scripts', 'voice_daemon.py');
    const exists = fs.existsSync(daemonPath);
    const durationMs = Date.now() - t0;

    if (!exists) {
      return {
        name: 'voice_daemon_script',
        category: 'speech_recognition',
        status: 'failed',
        message: `File scripts/voice_daemon.py is missing at ${daemonPath}`,
        durationMs,
      };
    }

    return {
      name: 'voice_daemon_script',
      category: 'speech_recognition',
      status: 'passed',
      message: 'Python voice daemon script verified on disk',
      details: { path: daemonPath, sizeBytes: fs.statSync(daemonPath).size },
      durationMs,
    };
  }

  private async checkTtsEngine(): Promise<DiagnosticCheckResult> {
    const t0 = Date.now();
    try {
      const res = await ttsService.speakText('Калибровка систем интеркома', {
        voice: 'ru-RU-DmitryNeural',
        playOnSpeaker: false,
      });

      const durationMs = Date.now() - t0;
      if (res.success && res.audioBase64) {
        return {
          name: 'edge_tts_engine',
          category: 'tts',
          status: 'passed',
          message: 'Edge-TTS synthesis and base64 audio caching operational',
          details: { cached: res.cached, phrase: res.phrase },
          durationMs,
        };
      }

      return {
        name: 'edge_tts_engine',
        category: 'tts',
        status: 'warning',
        message: 'TTS synthesis returned empty payload',
        durationMs,
      };
    } catch (err: any) {
      return {
        name: 'edge_tts_engine',
        category: 'tts',
        status: 'failed',
        message: `TTS engine failed: ${err?.message || err}`,
        durationMs: Date.now() - t0,
      };
    }
  }

  private checkGreetingStripper(): DiagnosticCheckResult {
    const t0 = Date.now();
    const testCases = [
      { raw: 'Слушаю вас, сэр. Поставь на паузу трек', expectedClean: 'Поставь на паузу трек', expectedOnlyGreeting: false },
      { raw: 'Слушаю вас, сэр.', expectedClean: '', expectedOnlyGreeting: true },
      { raw: 'Да, сэр. Создай компонент кнопки', expectedClean: 'Создай компонент кнопки', expectedOnlyGreeting: false },
      { raw: 'На связи, открой код стоп', expectedClean: 'открой код', expectedOnlyGreeting: false },
    ];

    let allMatched = true;
    for (const tc of testCases) {
      const res = ttsService.cleanLeadingJarvisPhrase(tc.raw);
      if (res.cleanText !== tc.expectedClean || res.isOnlyGreeting !== tc.expectedOnlyGreeting) {
        allMatched = false;
        break;
      }
    }

    const durationMs = Date.now() - t0;
    return {
      name: 'greeting_stripper',
      category: 'speech_recognition',
      status: allMatched ? 'passed' : 'failed',
      message: allMatched ? 'Smart greeting stripper passes all test vectors' : 'Greeting stripper test vector mismatch',
      durationMs,
    };
  }

  private checkVoiceMacroDispatcher(): DiagnosticCheckResult {
    const t0 = Date.now();
    const mediaRes = voiceMacroService.processCommand('поставь на паузу трек');
    const volRes = voiceMacroService.processCommand('сделай тише звук');
    const codeRes = voiceMacroService.processCommand('открой код');
    const passthroughRes = voiceMacroService.processCommand('напиши функцию для сортировки массива');

    const durationMs = Date.now() - t0;
    const ok =
      mediaRes.handled &&
      mediaRes.action === 'media_play_pause' &&
      volRes.handled &&
      volRes.action === 'vol_down' &&
      codeRes.handled &&
      codeRes.action === 'launch_code' &&
      !passthroughRes.handled;

    return {
      name: 'voice_macro_dispatcher',
      category: 'macros',
      status: ok ? 'passed' : 'failed',
      message: ok ? 'Voice Macro service correctly identifies and routes OS commands' : 'Voice Macro test cases failed',
      durationMs,
    };
  }

  private async checkSupervisorEngine(): Promise<DiagnosticCheckResult> {
    const t0 = Date.now();
    const state = jarvisSupervisor.getState();
    const initiative = await proactiveCompanion.triggerAutonomousSpark();

    const durationMs = Date.now() - t0;
    const ok = state.isActive && Array.isArray(state.recentActivities) && initiative !== null;

    return {
      name: 'jarvis_supervisor_engine',
      category: 'supervisor',
      status: ok ? 'passed' : 'warning',
      message: ok ? 'Jarvis Supervisor loop and Autonomous Initiative generator active' : 'Initiative generator returned null',
      details: { initiativeTitle: initiative?.title, activeWorkers: state.activeWorkers.length },
      durationMs,
    };
  }

  private async checkProcessWatcher(): Promise<DiagnosticCheckResult> {
    const t0 = Date.now();
    const status = await processWatcher.performScan();
    const durationMs = Date.now() - t0;

    return {
      name: 'os_process_watcher',
      category: 'hardware',
      status: 'passed',
      message: `OS process scan operational (Current state: ${status.state})`,
      details: status,
      durationMs,
    };
  }

  private async checkMicrophoneHardware(): Promise<DiagnosticCheckResult> {
    const t0 = Date.now();
    return new Promise((resolve) => {
      const py = `
import sounddevice as sd
try:
    dev = sd.query_devices(kind='input')
    print(f"OK:{dev['name']}:{dev['max_input_channels']}")
except Exception as e:
    print(f"ERR:{e}")
`.trim();

      const proc = spawn('python', ['-c', py]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));

      proc.on('close', (code) => {
        const durationMs = Date.now() - t0;
        if (code === 0 && stdout.includes('OK:')) {
          const parts = stdout.trim().split(':');
          resolve({
            name: 'microphone_hardware',
            category: 'audio',
            status: 'passed',
            message: `Default input microphone detected: ${parts[1]} (${parts[2]} channels)`,
            details: { name: parts[1], channels: parts[2] },
            durationMs,
          });
        } else {
          resolve({
            name: 'microphone_hardware',
            category: 'audio',
            status: 'warning',
            message: `Microphone query note: ${stderr || stdout}`,
            durationMs,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          name: 'microphone_hardware',
          category: 'audio',
          status: 'warning',
          message: `Microphone check skipped (Python not accessible): ${err.message}`,
          durationMs: Date.now() - t0,
        });
      });
    });
  }
}

export const jarvisDiagnostics = new JarvisDiagnostics();
