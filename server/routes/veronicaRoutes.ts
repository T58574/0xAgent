import { Router, Request, Response } from 'express';
import { CliHandler } from '../veronica/cli/cliHandler';
import { getVeronicaStatus, reloadVeronicaModule } from '../veronica';
import { snapshotCache } from '../veronica/core/snapshotCache';
import { projectDiscovery } from '../veronica/core/projectDiscovery';
import { antigravityAdapter, VeronicaStreamEvent } from '../veronica/adapters/antigravityAdapter';
import { MessageBuilder } from '../veronica/telegram/messageBuilder';
import { taskRegistry } from '../veronica/core/taskRegistry';

type BroadcastFn = (event: string, payload: any) => void;

export function createVeronicaRouter(broadcast?: BroadcastFn): Router {
  const router = Router();

  if (broadcast) {
    antigravityAdapter.setBroadcaster(broadcast);
  }

  // Graceful hot-reload of Veronica module without interrupting parent server
  router.post('/reload', async (_req, res) => {
    try {
      const result = await reloadVeronicaModule();
      if (broadcast) {
        broadcast('veronica-reloaded', result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || err });
    }
  });

  // CLI endpoint invoked by `0xagent veronica <cmd>`
  router.post('/cli', async (req, res) => {
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
  router.get('/status', (_req, res) => {
    try {
      const status = getVeronicaStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Available models (Local GGUF + Antigravity Models)
  router.get('/models', (_req, res) => {
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
  router.get('/agents', (_req, res) => {
    try {
      const agents = antigravityAdapter.getAvailableAntigravityAgents();
      res.json({ agents });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Projects summary with auto-sync
  router.get('/projects', async (_req, res) => {
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
  router.post('/projects/rescan', async (_req, res) => {
    try {
      const snapshots = await snapshotCache.syncAllDiscovered();
      res.json({ success: true, projects: snapshots });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manage search paths
  router.get('/projects/paths', (_req, res) => {
    try {
      res.json({ paths: projectDiscovery.getSearchPaths() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/projects/paths', async (req, res) => {
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
  router.post('/tasks/spawn', async (req, res) => {
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
  router.post('/tasks/:id/kill', async (req, res) => {
    try {
      const taskId = String(req.params.id);
      const killed = await antigravityAdapter.killTask(taskId);
      res.json({ success: killed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SSE Stream Endpoint for a Task
  router.get('/tasks/:id/stream', (req: Request, res: Response) => {
    const taskId = String(req.params.id);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (eventName: string, data: any) => {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Initial connection event
    writeEvent('open', { taskId, status: 'connected', timestamp: Date.now() });

    // Replay historical buffered chunks
    const existingBuffer = antigravityAdapter.getTaskStreamBuffer(taskId);
    for (const ev of existingBuffer) {
      writeEvent(ev.type, ev);
    }

    const currentTask = taskRegistry.getTask(taskId);
    if (currentTask && currentTask.status !== 'running' && currentTask.status !== 'queued') {
      writeEvent('end', {
        taskId,
        type: 'end',
        status: currentTask.status,
        summary: currentTask.summary || 'Task already completed',
        timestamp: currentTask.finished_at || Date.now(),
      });
      res.end();
      return;
    }

    // Subscribe to live stream
    const unsubscribe = antigravityAdapter.subscribeTaskStream(taskId, (event: VeronicaStreamEvent) => {
      writeEvent(event.type, event);
      if (event.type === 'end') {
        setTimeout(() => {
          try {
            res.end();
          } catch {}
        }, 100);
      }
    });

    // Keepalive ping interval
    const keepAliveTimer = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      unsubscribe();
    });
  });

  // Direct SSE Prompt Execution Endpoint
  router.post('/prompt/stream', async (req: Request, res: Response) => {
    const {
      project = '0xAgent',
      skill = 'execute_prompt',
      custom_prompt,
      model,
      effort,
      agent,
      print_timeout,
    } = req.body;

    if (!custom_prompt) {
      res.status(400).json({ error: 'custom_prompt is required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (eventName: string, data: any) => {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const task = await antigravityAdapter.spawnTask({
        project,
        skill,
        custom_prompt,
        model,
        effort,
        agent,
        print_timeout,
      });

      writeEvent('open', { taskId: task.id, status: 'spawned', timestamp: Date.now() });

      const unsubscribe = antigravityAdapter.subscribeTaskStream(task.id, (event: VeronicaStreamEvent) => {
        writeEvent(event.type, event);
        if (event.type === 'end') {
          setTimeout(() => {
            try {
              res.end();
            } catch {}
          }, 100);
        }
      });

      const keepAliveTimer = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAliveTimer);
        unsubscribe();
      });
    } catch (err: any) {
      writeEvent('error', { error: err?.message || err, timestamp: Date.now() });
      res.end();
    }
  });

  return router;
}

export const veronicaRouter = createVeronicaRouter();

