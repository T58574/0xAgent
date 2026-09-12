import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

function resolvePythonPath(): string {
  const venvPaths = [
    path.join(os.homedir(), '.0xagent', 'venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), 'venv', 'Scripts', 'python.exe'),
  ];
  for (const vp of venvPaths) {
    if (fs.existsSync(vp)) {
      return vp;
    }
  }
  return 'python';
}

export class TelegramVoiceService {
  private static instance: TelegramVoiceService;

  public static getInstance(): TelegramVoiceService {
    if (!TelegramVoiceService.instance) {
      TelegramVoiceService.instance = new TelegramVoiceService();
    }
    return TelegramVoiceService.instance;
  }

  public async downloadTelegramAudio(token: string, telegramFilePath: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), '0xagent_voice');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let ext = (path.extname(telegramFilePath) || '.ogg').toLowerCase();
    if (ext === '.oga' || !ext) {
      ext = '.ogg';
    }
    const tempFileName = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const localFilePath = path.join(tempDir, tempFileName);

    const downloadUrl = `https://api.telegram.org/file/bot${token}/${telegramFilePath}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to download audio from Telegram API: HTTP ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    await fs.promises.writeFile(localFilePath, Buffer.from(arrayBuffer));
    return localFilePath;
  }

  public async transcribeAudio(audioPath: string): Promise<{ text: string }> {
    const scriptPath = path.resolve(process.cwd(), 'scripts/transcribe_audio.py');
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Transcription helper script not found at ${scriptPath}`);
    }

    const pythonBin = resolvePythonPath();

    return new Promise((resolve, reject) => {
      const args = [scriptPath, audioPath, '--engine', 'auto'];
      const child = spawn(pythonBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString('utf-8'); });
      child.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve({ text: parsed.text || '' });
          } catch {
            resolve({ text: stdout.trim() });
          }
        } else {
          reject(new Error(`Transcription failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (err) => reject(err));
    });
  }
}

export const telegramVoiceService = TelegramVoiceService.getInstance();
