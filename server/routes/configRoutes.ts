import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig, saveConfig } from '../config';
import { parseGgufMetadata } from '../ggufParser';
import { voiceDaemonManager } from '../agent/voiceDaemonManager';
import { stopLlamaServerProcess } from './llamaRoutes';
import { restartTelegramBot } from '../veronica/telegram/bot';

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

    if (req.body.veronica !== undefined) {
      restartTelegramBot();
    }

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
    const cloudModels: any[] = [
      {
        id: 'gemini-3.7-flash',
        name: 'Gemini 3.7 Flash',
        provider: 'antigravity',
        supportedEfforts: ['low', 'medium', 'high'],
        defaultEffort: 'low',
      },
      {
        id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        provider: 'antigravity',
        supportedEfforts: ['low', 'medium', 'high'],
        defaultEffort: 'low',
      },
      {
        id: 'gemini-3.1-pro',
        name: 'Gemini 3.1 Pro',
        provider: 'antigravity',
        supportedEfforts: ['low', 'high'],
        defaultEffort: 'low',
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6 (Thinking)',
        provider: 'antigravity',
        supportedEfforts: [],
      },
      {
        id: 'claude-opus-4-6-thinking',
        name: 'Claude Opus 4.6 (Thinking)',
        provider: 'antigravity',
        supportedEfforts: [],
      },
      {
        id: 'gpt-oss-120b-medium',
        name: 'GPT-OSS 120B (Medium)',
        provider: 'antigravity',
        supportedEfforts: [],
      },
      {
        id: 'inherit',
        name: 'Antigravity Auto (Inherit)',
        provider: 'antigravity',
        supportedEfforts: [],
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
                isDraft: meta.isDraft,
                isFastMtp: meta.isFastMtp,
                supportsFastMtp: meta.supportsFastMtp,
                supportsReasoning: meta.supportsReasoning,
                recommendedReasoningEffort: meta.recommendedReasoningEffort,
                family: meta.family,
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
      activeModelId: cfg.model_name || 'local:qwen2.5-coder-32b.gguf',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Web Search Engines & Diagnostics
configRouter.get('/search-engines', async (_req, res) => {
  try {
    const { searchEngineRegistry } = await import('../searchEngineRegistry');
    const cfg = loadConfig();
    const engines = await searchEngineRegistry.getEngineInfoList(cfg);
    res.json({
      engines,
      activeProvider: cfg.web_search_provider || 'auto',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

configRouter.post('/web-search/test', async (req, res) => {
  try {
    const { searchEngineRegistry } = await import('../searchEngineRegistry');
    const { query, provider, firecrawl_api_key, firecrawl_api_url, searxng_url } = req.body || {};

    if (!query || !query.trim()) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const currentConfig = loadConfig();
    const testConfig = {
      ...currentConfig,
      web_search_provider: provider || currentConfig.web_search_provider || 'auto',
      firecrawl_api_key: firecrawl_api_key !== undefined ? firecrawl_api_key : currentConfig.firecrawl_api_key,
      firecrawl_api_url: firecrawl_api_url !== undefined ? firecrawl_api_url : currentConfig.firecrawl_api_url,
      searxng_url: searxng_url !== undefined ? searxng_url : currentConfig.searxng_url,
    };

    const outcome = await searchEngineRegistry.search(query.trim(), 5, testConfig);
    res.json(outcome);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


