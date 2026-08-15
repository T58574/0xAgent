import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig, saveConfig } from '../config';
import { parseGgufMetadata } from '../ggufParser';
import { voiceDaemonManager } from '../agent/voiceDaemonManager';
import { stopLlamaServerProcess } from './llamaRoutes';

export const configRouter = Router();

configRouter.get('/config', (_req, res) => {
  try {
    const cfg = loadConfig();
    res.json(cfg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

configRouter.post('/config', (req, res) => {
  try {
    saveConfig(req.body);

    if (req.body.tts_config && typeof req.body.tts_config.wake_word_enabled === 'boolean') {
      voiceDaemonManager.syncWithConfig(req.body.tts_config.wake_word_enabled);
    }

    // Auto-Free GPU resources when switching to a cloud model (Rule 16)
    const newModel = req.body.model_name;
    if (newModel && typeof newModel === 'string') {
      const isCloudModel =
        !newModel.startsWith('local:') &&
        !newModel.endsWith('.gguf') &&
        !newModel.includes('localhost') &&
        !newModel.includes('127.0.0.1');

      if (isCloudModel) {
        stopLlamaServerProcess();
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

configRouter.get('/models', (_req, res) => {
  try {
    const cfg = loadConfig();
    const cloudModels = [
      {
        id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        badge: 'Fast',
        speed: 'Fast >',
        provider: 'Google AI Studio',
      },
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        badge: 'Fast',
        speed: 'Fast >',
        provider: 'Google AI Studio',
      },
      {
        id: 'gemini-3.5-flash-lite',
        name: 'Gemini 3.5 Flash Lite',
        badge: 'Ultra Fast',
        speed: 'Ultra Fast >',
        provider: 'Google AI Studio',
      },
      {
        id: 'gemma-4-31b-it',
        name: 'Gemma 4 31B IT',
        badge: 'Medium',
        speed: 'Medium >',
        provider: 'Google AI Studio',
      },
      {
        id: 'gemini-2.5-flash-preview-tts',
        name: 'Gemini 2.5 Flash Preview TTS',
        badge: 'Fast',
        speed: 'Fast >',
        provider: 'Google AI Studio',
        isAudio: true,
      },
    ];

    const dirsToScan: string[] = [
      path.join(process.cwd(), 'models'),
      path.join(os.homedir(), '.0xagent', 'models'),
    ];

    if (cfg.models_path && fs.existsSync(cfg.models_path)) {
      dirsToScan.unshift(cfg.models_path);
    }

    const scannedLocalModels: any[] = [];
    const seenFilenames = new Set<string>();

    for (const dirPath of dirsToScan) {
      if (fs.existsSync(dirPath)) {
        try {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            if (file.toLowerCase().endsWith('.gguf') && !seenFilenames.has(file.toLowerCase())) {
              seenFilenames.add(file.toLowerCase());
              const fullPath = path.join(dirPath, file);
              const meta = parseGgufMetadata(fullPath);
              scannedLocalModels.push({
                id: `local:${file}`,
                fileName: file,
                filePath: fullPath,
                title: meta.cleanTitle || meta.modelName,
                quantization: meta.quantization,
                sizeGB: meta.sizeGB || meta.fileSizeFormatted,
                formattedName: meta.formattedName || `${meta.modelName} [${meta.quantization}] (${meta.fileSizeFormatted})`,
                isMmproj: meta.isMmproj,
                contextLength: meta.contextLength,
              });
            }
          }
        } catch (dirErr) {
          console.error(`Error scanning models directory ${dirPath}:`, dirErr);
        }
      }
    }

    res.json({
      cloud: cloudModels,
      local: scannedLocalModels,
      activeModelId: cfg.model_name || 'gemini-3.6-flash',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

