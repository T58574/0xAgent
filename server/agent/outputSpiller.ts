import fs from 'node:fs';
import path from 'node:path';
import { getAppDir } from '../config';

export const DEFAULT_SPILL_THRESHOLD = 24 * 1024; // 24 KB

export interface SpillResult {
  output: string;
  spilled: boolean;
  filePath?: string;
  originalSize: number;
}

export async function getSpillDir(): Promise<string> {
  const spillDir = path.join(getAppDir(), 'spill');
  try {
    await fs.promises.mkdir(spillDir, { recursive: true });
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

  const originalSize = output.length;
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

    const lines = output.split('\n');
    const headLines = lines.slice(0, 50).join('\n');
    const tailLines = lines.slice(-20).join('\n');

    const preview = `${headLines}\n\n[... ВЫВОД ПРЕВЫСИЛ ЛИМИТ (${originalSize.toLocaleString()} байт), ПОЛНЫЙ ЛОГ СОХРАНЕН В: ${filePath} ...]\n\n${tailLines}`;

    return {
      output: preview,
      spilled: true,
      filePath,
      originalSize,
    };
  } catch (err) {
    console.error('Failed to spill tool output to disk:', err);
    return { output, spilled: false, originalSize };
  }
}
