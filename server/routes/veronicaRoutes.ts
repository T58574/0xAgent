import { Router } from 'express';
import { CliHandler } from '../veronica/cli/cliHandler';
import { getVeronicaStatus } from '../veronica';
import { snapshotCache } from '../veronica/core/snapshotCache';
import { projectDiscovery } from '../veronica/core/projectDiscovery';
import { antigravityAdapter } from '../veronica/adapters/antigravityAdapter';
import { MessageBuilder } from '../veronica/telegram/messageBuilder';

export const veronicaRouter = Router();

// CLI endpoint invoked by `0xagent veronica <cmd>`
veronicaRouter.post('/cli', async (req, res) => {
  try {
    const result = await CliHandler.handleRequest(req.body);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || err });
  }
});

// Module & Task Status for Tray Launcher and Diagnostics
veronicaRouter.get('/status', (_req, res) => {
  try {
    const status = getVeronicaStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Available models (Local GGUF + Antigravity Models)
veronicaRouter.get('/models', (_req, res) => {
  try {
    const localModels = MessageBuilder.listAvailableModels();
    const agyModels = antigravityAdapter.getAvailableAntigravityModels();
    res.json({
      local: localModels,
      antigravity: agyModels,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Available subagents
veronicaRouter.get('/agents', (_req, res) => {
  try {
    const agents = antigravityAdapter.getAvailableAntigravityAgents();
    res.json({ agents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Projects summary with auto-sync
veronicaRouter.get('/projects', async (_req, res) => {
  try {
    let snapshots = snapshotCache.getAllSnapshots();
    if (snapshots.length === 0) {
      snapshots = await snapshotCache.syncAllDiscovered();
    }
    res.json({ projects: snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rescan projects
veronicaRouter.post('/projects/rescan', async (_req, res) => {
  try {
    const snapshots = await snapshotCache.syncAllDiscovered();
    res.json({ success: true, projects: snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manage search paths
veronicaRouter.get('/projects/paths', (_req, res) => {
  try {
    res.json({ paths: projectDiscovery.getSearchPaths() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

veronicaRouter.post('/projects/paths', async (req, res) => {
  try {
    const { path: newPath } = req.body;
    if (!newPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const added = projectDiscovery.addSearchPath(newPath);
    const snapshots = await snapshotCache.syncAllDiscovered();
    res.json({ success: added, paths: projectDiscovery.getSearchPaths(), projects: snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Spawn task endpoint
veronicaRouter.post('/tasks/spawn', async (req, res) => {
  try {
    const {
      project,
      skill,
      runtime_profile,
      autonomy_level,
      custom_prompt,
      model,
      effort,
      agent,
      print_timeout,
      conversation_id,
      continue_recent,
    } = req.body;
    if (!project || !skill) {
      res.status(400).json({ error: 'project and skill are required' });
      return;
    }
    const task = await antigravityAdapter.spawnTask({
      project,
      skill,
      runtime_profile,
      autonomy_level,
      custom_prompt,
      model,
      effort,
      agent,
      print_timeout,
      conversation_id,
      continue_recent,
    });
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Kill task endpoint
veronicaRouter.post('/tasks/:id/kill', async (req, res) => {
  try {
    const taskId = req.params.id;
    const killed = await antigravityAdapter.killTask(taskId);
    res.json({ success: killed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
