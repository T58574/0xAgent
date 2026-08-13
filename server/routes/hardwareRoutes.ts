import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { parseGgufMetadata, GgufMetadata } from '../ggufParser';
import { detectGpuHardwareAsync } from '../hardware';

export const hardwareRouter = Router();

hardwareRouter.post('/parse-gguf', (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(400).json({ error: 'Valid filePath is required' });
      return;
    }
    const meta = parseGgufMetadata(filePath);
    res.json(meta);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recursively scan directory for GGUF model files & extract metadata
hardwareRouter.get('/scan-models-dir', async (req, res) => {
  try {
    const targetDir = (req.query.dirPath as string) || path.join(os.homedir(), '.0xagent', 'models');
    if (!fs.existsSync(targetDir)) {
      res.json({ dirPath: targetDir, models: [] });
      return;
    }

    const models: GgufMetadata[] = [];

    async function scanDir(dir: string, depth: number) {
      if (depth > 3 || models.length > 100) return;
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (models.length > 100) break;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!['.git', 'node_modules', 'dist', 'build', '.idea', '.vscode'].includes(entry.name)) {
              await scanDir(fullPath, depth + 1);
            }
          } else if (entry.isFile() && entry.name.endsWith('.gguf')) {
            models.push(parseGgufMetadata(fullPath));
          }
        }
      } catch {}
    }

    await scanDir(targetDir, 0);
    res.json({ dirPath: targetDir, models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GPU Hardware Auto-Detector
hardwareRouter.get('/detect-hardware', async (_req, res) => {
  try {
    const hw = await detectGpuHardwareAsync();
    res.json(hw);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
