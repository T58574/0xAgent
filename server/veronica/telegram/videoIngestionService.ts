import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

export interface VideoMetadata {
  title?: string;
  uploader?: string;
  duration?: number;
  webpage_url?: string;
  sourceType: 'youtube' | 'tiktok' | 'reels' | 'telegram' | 'generic';
}

export interface IngestedAudioResult {
  audioPath: string;
  metadata: VideoMetadata;
  cleanup: () => Promise<void>;
}

export class VideoIngestionService {
  private static instance: VideoIngestionService;

  private constructor() {}

  public static getInstance(): VideoIngestionService {
    if (!VideoIngestionService.instance) {
      VideoIngestionService.instance = new VideoIngestionService();
    }
    return VideoIngestionService.instance;
  }

  /**
   * Resolves the best available ffmpeg binary.
   * Checks CapCut apps directory first, then system PATH.
   */
  public resolveFfmpegPath(): string {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const capcutAppsDir = path.join(home, 'AppData', 'Local', 'CapCut', 'Apps');
    if (fs.existsSync(capcutAppsDir)) {
      try {
        const subdirs = fs.readdirSync(capcutAppsDir);
        for (const sub of subdirs) {
          const candidate = path.join(capcutAppsDir, sub, 'ffmpeg.exe');
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      } catch {}
    }
    return 'ffmpeg';
  }

  /**
   * Resolves yt-dlp binary path.
   */
  public resolveYtDlpPath(): string {
    const candidatePaths = [
      'C:\\Python314\\Scripts\\yt-dlp.exe',
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return 'yt-dlp';
  }

  /**
   * Checks if string contains a supported video URL (TikTok, YouTube Shorts, Reels, generic video)
   */
  public extractVideoUrl(text: string): { url: string; sourceType: VideoMetadata['sourceType'] } | null {
    if (!text || !text.trim()) return null;

    const urlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
    if (!urlMatch) return null;

    const rawUrl = urlMatch[0];
    const u = rawUrl.toLowerCase();

    if (u.includes('tiktok.com/')) {
      return { url: rawUrl, sourceType: 'tiktok' };
    }
    if (u.includes('youtube.com/shorts/') || u.includes('youtu.be/') || u.includes('youtube.com/watch')) {
      return { url: rawUrl, sourceType: 'youtube' };
    }
    if (u.includes('instagram.com/reel/') || u.includes('instagram.com/reels/') || u.includes('instagram.com/p/')) {
      return { url: rawUrl, sourceType: 'reels' };
    }

    // Generic video indicators (vk.com, vimeo, twitter/x, direct mp4/webm/mov)
    if (
      u.includes('twitter.com/') ||
      u.includes('x.com/') ||
      u.includes('vk.com/') ||
      u.includes('vimeo.com/') ||
      /\.(mp4|webm|mkv|mov|avi|flv)(\?|$)/i.test(u)
    ) {
      return { url: rawUrl, sourceType: 'generic' };
    }

    return null;
  }

  /**
   * Fast subtitle fetcher: extracts cloud subtitles (TikTok, YouTube, Reels) in ~0.5s without downloading video/audio.
   */
  public async fetchSubtitles(url: string): Promise<{ text: string; lang: string } | null> {
    const tempDir = path.join(os.tmpdir(), '0xagent_video');
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

    const filePrefix = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const outputTemplate = path.join(tempDir, `${filePrefix}.%(ext)s`);
    const ytDlpBin = this.resolveYtDlpPath();

    const args = [
      '--skip-download',
      '--write-sub',
      '--sub-lang',
      'rus-RU,ru,eng-US,en',
      '--no-playlist',
      '--no-warnings',
      '--output',
      outputTemplate,
      url,
    ];

    try {
      await this.runProcess(ytDlpBin, args, 25000);
      const files = await fs.promises.readdir(tempDir);
      const subFiles = files.filter((f) => f.startsWith(filePrefix) && (f.endsWith('.vtt') || f.endsWith('.srt')));

      if (subFiles.length === 0) {
        return null;
      }

      // Prioritize Russian, then English, then first available
      const chosen =
        subFiles.find((f) => f.includes('rus') || f.includes('.ru.')) ||
        subFiles.find((f) => f.includes('eng') || f.includes('.en.')) ||
        subFiles[0];

      const fullSubPath = path.join(tempDir, chosen);
      const content = await fs.promises.readFile(fullSubPath, 'utf-8');

      // Cleanup sub files
      for (const sf of subFiles) {
        try {
          await fs.promises.unlink(path.join(tempDir, sf));
        } catch {}
      }

      const parsedText = this.cleanVttContent(content);
      if (!parsedText || parsedText.length < 10) return null;

      const lang = chosen.includes('rus') || chosen.includes('.ru.') ? 'ru' : 'en';
      return { text: parsedText, lang };
    } catch (err) {
      console.warn('[VideoIngestionService] Failed to fetch subtitles:', err);
      return null;
    }
  }

  /**
   * Strips WEBVTT cues, timestamps, and deduplicates consecutive repeating lines.
   */
  public cleanVttContent(vtt: string): string {
    const lines = vtt.split(/\r?\n/);
    const cleaned: string[] = [];
    let lastLine = '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line === 'WEBVTT' || line.startsWith('NOTE') || line.startsWith('STYLE')) continue;
      if (/^\d+$/.test(line)) continue; // Cue numbers
      if (line.includes('-->')) continue; // Timestamps

      // Strip inline VTT tags like <v ...>, <c ...>, </c>
      const stripped = line.replace(/<\/?[^>]+(>|$)/g, '').trim();
      if (!stripped) continue;

      if (stripped !== lastLine) {
        cleaned.push(stripped);
        lastLine = stripped;
      }
    }

    return cleaned.join(' ');
  }

  /**
   * Downloads and extracts audio from a web video URL using yt-dlp and ffmpeg
   */
  public async ingestUrl(url: string, sourceType: VideoMetadata['sourceType'] = 'generic'): Promise<IngestedAudioResult> {
    const tempDir = path.join(os.tmpdir(), '0xagent_video');
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

    const filePrefix = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const outputTemplate = path.join(tempDir, `${filePrefix}.%(ext)s`);
    const targetAudioPath = path.join(tempDir, `${filePrefix}.mp3`);

    const ytDlpBin = this.resolveYtDlpPath();
    const ffmpegBin = this.resolveFfmpegPath();

    // 1. Fetch metadata via yt-dlp --dump-single-json
    let metadata: VideoMetadata = {
      sourceType,
      webpage_url: url,
    };

    try {
      const meta = await this.runProcess(ytDlpBin, ['--dump-single-json', '--no-warnings', '--no-playlist', url], 20000);
      const parsed = JSON.parse(meta);
      metadata.title = parsed.title || undefined;
      metadata.uploader = parsed.uploader || parsed.channel || undefined;
      metadata.duration = parsed.duration || undefined;
    } catch {
      // Non-fatal, proceed with audio extraction
    }

    // 2. Download and extract audio as MP3
    const ffmpegDir = path.dirname(ffmpegBin);
    const ytDlpArgs = [
      '--no-playlist',
      '--no-warnings',
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '--output',
      outputTemplate,
    ];

    if (ffmpegBin !== 'ffmpeg' && fs.existsSync(ffmpegBin)) {
      ytDlpArgs.push('--ffmpeg-location', ffmpegDir);
    }

    ytDlpArgs.push(url);

    await this.runProcess(ytDlpBin, ytDlpArgs, 90000);

    // Verify target file exists
    if (!fs.existsSync(targetAudioPath)) {
      // Find if any file was produced with filePrefix
      const files = await fs.promises.readdir(tempDir);
      const matched = files.find((f) => f.startsWith(filePrefix));
      if (!matched) {
        throw new Error('yt-dlp completed but no output audio file was generated.');
      }
      const actualPath = path.join(tempDir, matched);
      return {
        audioPath: actualPath,
        metadata,
        cleanup: async () => {
          try {
            if (fs.existsSync(actualPath)) await fs.promises.unlink(actualPath);
          } catch {}
        },
      };
    }

    return {
      audioPath: targetAudioPath,
      metadata,
      cleanup: async () => {
        try {
          if (fs.existsSync(targetAudioPath)) await fs.promises.unlink(targetAudioPath);
        } catch {}
      },
    };
  }

  /**
   * Downloads a Telegram video or video note, extracts 16kHz audio via ffmpeg
   */
  public async ingestTelegramVideo(token: string, fileIdPath: string, isVideoNote = false): Promise<IngestedAudioResult> {
    const tempDir = path.join(os.tmpdir(), '0xagent_video');
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

    const ext = path.extname(fileIdPath) || '.mp4';
    const filePrefix = `tgvid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempVideoPath = path.join(tempDir, `${filePrefix}${ext}`);
    const tempAudioPath = path.join(tempDir, `${filePrefix}.wav`);

    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileIdPath}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to download Telegram video: HTTP ${res.status} ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    await fs.promises.writeFile(tempVideoPath, Buffer.from(arrayBuffer));

    // Extract audio via ffmpeg
    const ffmpegBin = this.resolveFfmpegPath();
    const ffmpegArgs = [
      '-y',
      '-i',
      tempVideoPath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      tempAudioPath,
    ];

    try {
      await this.runProcess(ffmpegBin, ffmpegArgs, 45000);
    } finally {
      // Clean up raw video file immediately to save disk
      try {
        if (fs.existsSync(tempVideoPath)) await fs.promises.unlink(tempVideoPath);
      } catch {}
    }

    if (!fs.existsSync(tempAudioPath)) {
      throw new Error('ffmpeg failed to extract audio from Telegram video.');
    }

    const metadata: VideoMetadata = {
      sourceType: 'telegram',
      title: isVideoNote ? 'Telegram Video Note (Кружочек)' : 'Telegram Video Message',
    };

    return {
      audioPath: tempAudioPath,
      metadata,
      cleanup: async () => {
        try {
          if (fs.existsSync(tempAudioPath)) await fs.promises.unlink(tempAudioPath);
        } catch {}
      },
    };
  }

  private runProcess(executable: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(executable, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d) => (stdout += d.toString()));
      child.stderr?.on('data', (d) => (stderr += d.toString()));

      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {}
        reject(new Error(`Process ${executable} timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Process ${executable} failed (code ${code}): ${stderr || stdout}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

export const videoIngestionService = VideoIngestionService.getInstance();
