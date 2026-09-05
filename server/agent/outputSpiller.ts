import fs from 'node:fs';
import path from 'node:path';
import { getAppDir } from '../config';

export const DEFAULT_SPILL_THRESHOLD = 10 * 1024; // 10 KB (aggressive token & memory optimization)

export interface SpillResult {
  output: string;
  spilled: boolean;
  filePath?: string;
  originalSize: number;
  lineCount?: number;
}

export async function getSpillDir(): Promise<string> {
  const spillDir = path.join(getAppDir(), 'spill');
  try {
    await fs.promises.mkdir(spillDir, { recursive: true });
  } catch {}
  return spillDir;
}

export function getSpillDirSync(): string {
  const spillDir = path.join(getAppDir(), 'spill');
  try {
    if (!fs.existsSync(spillDir)) {
      fs.mkdirSync(spillDir, { recursive: true });
    }
  } catch {}
  return spillDir;
}

/**
 * Persists oversized tool output to a disk log and returns a bounded preview with locator.
 */
export async function handleOutputSpill(
  output: string,
  toolName: string = 'tool',
  threshold: number = DEFAULT_SPILL_THRESHOLD
): Promise<SpillResult> {
  if (!output || typeof output !== 'string') {
    return { output: output || '', spilled: false, originalSize: 0 };
  }

  const originalSize = Buffer.byteLength(output, 'utf-8');
  if (originalSize <= threshold) {
    return { output, spilled: false, originalSize };
  }

  try {
    const dir = await getSpillDir();
    const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).substring(2, 6);
    const fileName = `spill_${timestamp}_${safeTool}_${randomHex}.log`;
    const filePath = path.join(dir, fileName);

    await fs.promises.writeFile(filePath, output, 'utf-8');

    const lines = output.split(/\r?\n/);
    const totalLines = lines.length;
    const headLines = lines.slice(0, 20).join('\n');
    const tailLines = lines.slice(-30).join('\n');

    const preview = `${headLines}\n\n[... ВЫВОД СОКРАЩЕН (${originalSize.toLocaleString()} байт / ${totalLines} строк). ПОЛНЫЙ ЛОГ СОХРАНЕН В: ${filePath} ...]\n\n${tailLines}`;

    return {
      output: preview,
      spilled: true,
      filePath,
      originalSize,
      lineCount: totalLines,
    };
  } catch (err) {
    console.error('Failed to spill tool output to disk:', err);
    return { output, spilled: false, originalSize };
  }
}

/**
 * High-performance streaming output collector that pipes oversized stream data
 * directly to a spill log file on the fly, preventing high heap allocations and token bloat.
 */
export class StreamingOutputCollector {
  private toolName: string;
  private threshold: number;
  private inMemoryChunks: Buffer[] = [];
  private totalBytes: number = 0;
  private totalLines: number = 0;
  private isSpilled: boolean = false;
  private spillFilePath: string | null = null;
  private fileWriteStream: fs.WriteStream | null = null;
  private headLines: string[] = [];
  private tailLinesQueue: string[] = [];
  private lineRemainder: string = '';

  constructor(toolName: string = 'stream', threshold: number = DEFAULT_SPILL_THRESHOLD) {
    this.toolName = toolName;
    this.threshold = threshold;
  }

  public append(chunk: Buffer | string): void {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf-8');
    this.totalBytes += buf.length;

    // Track lines for head/tail preview
    const textChunk = this.lineRemainder + buf.toString('utf-8');
    const parts = textChunk.split(/\r?\n/);
    this.lineRemainder = parts.pop() || '';

    for (const line of parts) {
      this.totalLines++;
      if (this.headLines.length < 20) {
        this.headLines.push(line);
      }
      this.tailLinesQueue.push(line);
      if (this.tailLinesQueue.length > 30) {
        this.tailLinesQueue.shift();
      }
    }

    if (!this.isSpilled) {
      if (this.totalBytes > this.threshold) {
        this.spillToDisk();
      } else {
        this.inMemoryChunks.push(buf);
      }
    }

    if (this.isSpilled && this.fileWriteStream) {
      this.fileWriteStream.write(buf);
    }
  }

  private spillToDisk(): void {
    try {
      this.isSpilled = true;
      const dir = getSpillDirSync();
      const safeTool = this.toolName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = Date.now();
      const randomHex = Math.random().toString(16).substring(2, 6);
      const fileName = `spill_${timestamp}_${safeTool}_${randomHex}.log`;
      this.spillFilePath = path.join(dir, fileName);

      this.fileWriteStream = fs.createWriteStream(this.spillFilePath, { encoding: 'utf-8', flags: 'a' });

      // Flush previously buffered memory chunks to disk
      for (const b of this.inMemoryChunks) {
        this.fileWriteStream.write(b);
      }
      this.inMemoryChunks = [];
    } catch (err) {
      console.error('[StreamingOutputCollector] Error initializing spill stream:', err);
    }
  }

  public async finalize(): Promise<SpillResult> {
    if (this.lineRemainder) {
      this.totalLines++;
      if (this.headLines.length < 20) {
        this.headLines.push(this.lineRemainder);
      }
      this.tailLinesQueue.push(this.lineRemainder);
      if (this.tailLinesQueue.length > 30) {
        this.tailLinesQueue.shift();
      }
      this.lineRemainder = '';
    }

    if (!this.isSpilled) {
      const fullText = Buffer.concat(this.inMemoryChunks).toString('utf-8');
      return {
        output: fullText,
        spilled: false,
        originalSize: this.totalBytes,
        lineCount: this.totalLines,
      };
    }

    if (this.fileWriteStream) {
      await new Promise<void>((resolve) => {
        this.fileWriteStream?.end(() => resolve());
      });
      this.fileWriteStream = null;
    }

    const head = this.headLines.join('\n');
    const tail = this.tailLinesQueue.join('\n');
    const preview = `${head}\n\n[... ВЫВОД СОКРАЩЕН (${this.totalBytes.toLocaleString()} байт / ${this.totalLines} строк). ПОЛНЫЙ ЛОГ СОХРАНЕН В: ${this.spillFilePath} ...]\n\n${tail}`;

    return {
      output: preview,
      spilled: true,
      filePath: this.spillFilePath || undefined,
      originalSize: this.totalBytes,
      lineCount: this.totalLines,
    };
  }
}
