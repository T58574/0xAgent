import { Router } from 'express';
import { julesService } from '../julesService';
import { jarvisSupervisor } from '../agent/jarvisSupervisor';
import { logger } from '../logger';

export const julesRouter = Router();

// List available GitHub sources connected to Jules
julesRouter.get('/jules/sources', async (_req, res) => {
  try {
    const sources = await julesService.listSources();
    res.json({ sources });
  } catch (err: any) {
    logger.error('JulesRoutes', `GET /api/jules/sources failed: ${err.message}`);
    res.status(500).json({ error: err.message || 'Failed to list Jules sources' });
  }
});

// List cached Jules sessions
julesRouter.get('/jules/sessions', (_req, res) => {
  try {
    const sessions = julesService.getCachedSessions();
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new Jules session
julesRouter.post('/jules/sessions', async (req, res) => {
  try {
    const { prompt, source, startingBranch, autoCreatePR, requirePlanApproval, title } = req.body;
    if (!prompt || !source) {
      res.status(400).json({ error: 'prompt and source are required' });
      return;
    }

    const session = await julesService.createSession({
      prompt,
      source,
      startingBranch,
      autoCreatePR,
      requirePlanApproval,
      title,
    });

    jarvisSupervisor.logActivity(
      'Local Agent',
      `Created Jules Cloud Session "${session.title}" (ID: ${session.id})`,
      'info'
    );

    res.json({ session });
  } catch (err: any) {
    logger.error('JulesRoutes', `POST /api/jules/sessions failed: ${err.message}`);
    res.status(500).json({ error: err.message || 'Failed to create Jules session' });
  }
});

// Approve Jules session plan
julesRouter.post('/jules/sessions/:id/approve', async (req, res) => {
  try {
    const sessionId = req.params.id;
    await julesService.approvePlan(sessionId);
    res.json({ success: true, sessionId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send message / feedback to Jules session
julesRouter.post('/jules/sessions/:id/message', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    await julesService.sendMessage(sessionId, prompt);
    res.json({ success: true, sessionId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get current Jarvis multi-agent supervisor state
julesRouter.get('/jarvis/state', (_req, res) => {
  try {
    const state = jarvisSupervisor.getState();
    res.json({ state });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
