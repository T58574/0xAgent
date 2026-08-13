import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../config';
import { loadSession, saveSession } from '../session';
import {
  runAgentLoop,
  cancelAgentSession,
  respondToToolConfirmation,
} from '../agent';

type BroadcastFn = (event: string, payload: any) => void;

export function createAgentRouter(broadcast: BroadcastFn): Router {
  const router = Router();

  router.post('/send-message', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const config = loadConfig();
    runAgentLoop(sessionId, config, broadcast).catch(async (err) => {
      console.error('Agent loop error:', err);
      try {
        const session = await loadSession(sessionId);
        const errMsg = `⚠️ **Системная ошибка выполнения Агента:**\n\`\`\`\n${err.message || err}\n\`\`\``;
        session.messages.push({
          id: uuidv4(),
          role: 'assistant',
          content: errMsg,
          timestamp: Date.now(),
        });
        session.updated_at = Date.now();
        await saveSession(session);
        broadcast('agent-error', { sessionId, message: errMsg });
      } catch {}
      broadcast('agent-status-changed', 'idle');
    });

    res.json({ success: true });
  });

  router.post('/cancel-agent', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) {
      cancelAgentSession(sessionId);
    }
    res.json({ success: true });
  });

  router.post('/respond-to-tool', (req, res) => {
    const { sessionId, toolCallId, approve } = req.body;
    const ok = respondToToolConfirmation(sessionId, toolCallId, approve);
    res.json({ success: ok });
  });

  return router;
}
