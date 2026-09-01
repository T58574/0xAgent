import { Router } from 'express';
import { CliHandler } from '../veronica/cli/cliHandler';
import { getVeronicaStatus } from '../veronica';
import { snapshotCache } from '../veronica/core/snapshotCache';
import { antigravityAdapter } from '../veronica/adapters/antigravityAdapter';

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

// Projects summary
veronicaRouter.get('/projects', (_req, res) => {
  try {
    const snapshots = snapshotCache.getAllSnapshots();
    res.json({ projects: snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Spawn task endpoint
veronicaRouter.post('/tasks/spawn', async (req, res) => {
  try {
    const { project, skill, runtime_profile, autonomy_level, custom_prompt } = req.body;
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
