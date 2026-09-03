import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { loadConfig } from '../../config';
import { proxyService } from '../../proxyService';
import { veronicaOrchestrator } from './veronicaOrchestrator';

export interface StructuredThought {
  title: string;
  summary: string;
  actionPoints: string[];
  tags: string[];
  detectedProject?: string | null;
  rawTranscript: string;
  timestamp: number;
  engine?: string;
  fileSavedPath?: string;
}

function resolvePythonPath(): string {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const venvPaths = [
    path.join(home, 'Documents', 'dev', '0xVoice2Text', 'venv', 'Scripts', 'python.exe'),
    path.resolve(process.cwd(), '..', '0xVoice2Text', 'venv', 'Scripts', 'python.exe'),
  ];
  for (const vp of venvPaths) {
    if (fs.existsSync(vp)) {
      return vp;
    }
  }
  return 'python';
}

export class VoiceThoughtService {
  private static instance: VoiceThoughtService;

  private constructor() {}

  public static getInstance(): VoiceThoughtService {
    if (!VoiceThoughtService.instance) {
      VoiceThoughtService.instance = new VoiceThoughtService();
    }
    return VoiceThoughtService.instance;
  }

  /**
   * Download audio file from Telegram Bot API to local temporary folder
   */
  public async downloadTelegramAudio(token: string, telegramFilePath: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), '0xagent_voice');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const ext = path.extname(telegramFilePath) || '.ogg';
    const tempFileName = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const localFilePath = path.join(tempDir, tempFileName);

    const downloadUrl = `https://api.telegram.org/file/bot${token}/${telegramFilePath}`;

    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to download audio from Telegram API: HTTP ${res.status} ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(localFilePath, buffer);

    return localFilePath;
  }

  /**
   * Transcribe audio file using local Qwen3 ONNX / Groq Whisper / Vosk
   */
  public async transcribeAudio(audioPath: string): Promise<{ text: string; engine: string }> {
    const config = loadConfig();

    // 1. Try Python transcribe_audio.py helper
    const scriptPath = path.resolve(process.cwd(), 'scripts/transcribe_audio.py');
    if (fs.existsSync(scriptPath)) {
      try {
        const pythonResult = await new Promise<{ text: string; engine: string }>((resolve, reject) => {
          const pythonBin = resolvePythonPath();
          console.log(`[VoiceThoughtService] Executing local STT helper via: ${pythonBin}`);
          const child = spawn(pythonBin, [scriptPath, audioPath, '--engine', 'auto'], {
            cwd: process.cwd(),
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (d) => (stdout += d.toString()));
          child.stderr?.on('data', (d) => (stderr += d.toString()));

          const timer = setTimeout(() => {
            try {
              child.kill();
            } catch {}
            reject(new Error('Transcription timed out after 60s'));
          }, 60000);

          child.on('close', (code) => {
            clearTimeout(timer);
            const lines = stdout.trim().split('\n');
            let jsonParsed: any = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') && line.endsWith('}')) {
                try {
                  jsonParsed = JSON.parse(line);
                  break;
                } catch {}
              }
            }

            if (jsonParsed && jsonParsed.success) {
              resolve({ text: (jsonParsed.text || '').trim(), engine: jsonParsed.engine || 'local-qwen3-onnx' });
              return;
            }
            reject(new Error(`Python transcription exited (${code}): ${jsonParsed?.error || stderr || stdout}`));
          });

          child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });

        if (pythonResult.text) {
          return pythonResult;
        }
      } catch (pyErr: any) {
        console.warn('[VoiceThoughtService] Python transcription helper failed, trying fallback:', pyErr?.message || pyErr);
      }
    }

    // 2. Direct Node.js fallback via Groq Whisper API if groq_api_key is present
    const groqKey = config.groq_api_key || process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const fileBytes = await fs.promises.readFile(audioPath);
        const fileName = path.basename(audioPath) || 'voice.ogg';
        const formData = new FormData();
        const blob = new Blob([fileBytes], { type: 'audio/ogg' });
        formData.append('file', blob, fileName);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'ru');

        const groqRes = await proxyService.fetchWithProxy(
          'https://api.groq.com/openai/v1/audio/transcriptions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
            },
            body: formData,
            signal: AbortSignal.timeout(30000),
          },
          'cloud_ai'
        );

        if (groqRes.ok) {
          const groqJson: any = await groqRes.json();
          if (groqJson.text) {
            return {
              text: groqJson.text.trim(),
              engine: 'groq-whisper-large-v3-turbo (node-direct)',
            };
          }
        }
      } catch (groqErr: any) {
        console.warn('[VoiceThoughtService] Direct Groq API transcription failed:', groqErr?.message || groqErr);
      }
    }

    throw new Error('All speech transcription engines failed to transcribe the audio.');
  }

  /**
   * Structure thought dump transcript with Veronica AI
   */
  public async structureThought(transcript: string): Promise<StructuredThought> {
    const now = Date.now();
    const cleanTranscript = (transcript || '').trim();

    // 1. Try Veronica LLM Orchestrator structuring
    try {
      const structured = await veronicaOrchestrator.structureVoiceThought(cleanTranscript);
      if (structured && structured.title) {
        // Ensure tags are properly formatted
        const tags = (structured.tags || []).map((t) => (t.startsWith('#') ? t : `#${t}`));
        
        // Auto-detect project if not matched by LLM
        let detectedProject = structured.project || null;
        if (!detectedProject) {
          detectedProject = await veronicaOrchestrator.resolveTargetProject(undefined, cleanTranscript);
        }

        return {
          title: structured.title,
          summary: structured.summary || cleanTranscript,
          actionPoints: structured.action_points && structured.action_points.length > 0
            ? structured.action_points
            : this.extractHeuristicActionPoints(cleanTranscript),
          tags,
          detectedProject,
          rawTranscript: cleanTranscript,
          timestamp: now,
        };
      }
    } catch (llmErr) {
      console.warn('[VoiceThoughtService] LLM structuring error, falling back to heuristics:', llmErr);
    }

    // 2. High-resilience Heuristic Fallback
    const firstSentence = cleanTranscript.split(/[.!?\n]/)[0]?.trim() || cleanTranscript.slice(0, 50);
    const title = firstSentence.length > 60 ? firstSentence.slice(0, 57) + '...' : firstSentence;
    const actionPoints = this.extractHeuristicActionPoints(cleanTranscript);
    const detectedProject = await veronicaOrchestrator.resolveTargetProject(undefined, cleanTranscript);
    
    const tags: string[] = [];
    if (detectedProject) {
      tags.push(`#${detectedProject}`);
    }
    tags.push('#голос', '#мысли');

    return {
      title: title || 'Голосовая мысль',
      summary: cleanTranscript,
      actionPoints,
      tags,
      detectedProject,
      rawTranscript: cleanTranscript,
      timestamp: now,
    };
  }

  /**
   * Heuristic action points extraction from raw text
   */
  private extractHeuristicActionPoints(text: string): string[] {
    const points: string[] = [];
    const lines = text.split(/[\n;]/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (/^(?:надо|нужно|сделать|добавить|исправить|проверить|починить|создать|реализовать|обновить)\b/i.test(line)) {
        points.push(line);
      }
    }

    if (points.length === 0 && lines.length > 0) {
      const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
      if (sentences.length > 0) {
        points.push(sentences[0]);
      }
    }

    return points;
  }

  /**
   * Append structured thought entry to brain/inbox.md
   */
  public async appendThoughtToInbox(
    thought: StructuredThought,
    targetWorkspaceDir?: string
  ): Promise<string> {
    const config = loadConfig();
    const baseDir = targetWorkspaceDir || config.workspace_dir || process.cwd();
    const brainDir = path.join(baseDir, 'brain');
    const inboxPath = path.join(brainDir, 'inbox.md');

    if (!fs.existsSync(brainDir)) {
      await fs.promises.mkdir(brainDir, { recursive: true });
    }

    const fileExists = fs.existsSync(inboxPath);
    let initialHeader = '';

    if (!fileExists) {
      initialHeader = [
        '# 📥 Thought Inbox (Голосовой сброс мыслей)',
        'Зафиксированные идеи, задачи и инсайты, структурированные Вероникой из голосовых сообщений.',
        '',
        '---',
        '',
      ].join('\n');
    }

    const dateStr = new Date(thought.timestamp).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const actionPointsBlock =
      thought.actionPoints.length > 0
        ? thought.actionPoints.map((ap) => `  - [ ] ${ap}`).join('\n')
        : '  - [ ] Зафиксировать и проработать идею';

    const tagsStr =
      thought.tags.length > 0
        ? thought.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
        : '#мысли';

    const projectStr = thought.detectedProject ? ` (Проект: \`${thought.detectedProject}\`)` : '';

    const entryMarkdown = [
      initialHeader,
      `## [${dateStr}] ${thought.title}`,
      `- **Суть идеи**: ${thought.summary}`,
      `- **Экшн-поинты**:`,
      `${actionPointsBlock}`,
      `- **Теги / Проекты**: ${tagsStr}${projectStr}`,
      `- **Оригинальная расшифровка**:`,
      `  > *«${thought.rawTranscript}»*`,
      ``,
      `---`,
      ``,
    ].filter(Boolean).join('\n');

    await fs.promises.appendFile(inboxPath, entryMarkdown, 'utf-8');
    thought.fileSavedPath = inboxPath;

    return inboxPath;
  }

  /**
   * Full end-to-end voice message processing pipeline
   */
  public async processVoiceMessage(
    token: string,
    telegramFilePath: string,
    _userId: number
  ): Promise<{ thought: StructuredThought; inboxPath: string; engine: string }> {
    let tempAudioPath: string | null = null;

    try {
      // 1. Download audio file from Telegram
      tempAudioPath = await this.downloadTelegramAudio(token, telegramFilePath);

      // 2. Transcribe speech to text
      const transcriptionResult = await this.transcribeAudio(tempAudioPath);
      const rawText = transcriptionResult.text;

      if (!rawText || !rawText.trim()) {
        throw new Error('Аудиозапись слишком тихая или не содержит чёткой речи. Попробуйте сказать чуть громче или ближе к микрофону.');
      }

      // 3. Structure thought with Veronica
      const thought = await this.structureThought(rawText);
      thought.engine = transcriptionResult.engine;

      // 4. Save to brain/inbox.md
      const inboxPath = await this.appendThoughtToInbox(thought);

      return {
        thought,
        inboxPath,
        engine: transcriptionResult.engine,
      };
    } finally {
      // 5. Clean up temporary audio file
      if (tempAudioPath && fs.existsSync(tempAudioPath)) {
        try {
          await fs.promises.unlink(tempAudioPath);
        } catch {}
      }
    }
  }
}

export const voiceThoughtService = VoiceThoughtService.getInstance();
