import { Router, Request, Response } from 'express';
import { quotaManager } from '../agent/quotaManager';

export const quotaRouter = Router();

// GET /api/quota/status — Returns current real-time quota status & reset timer
quotaRouter.get('/quota/status', (_req: Request, res: Response) => {
  try {
    const status = quotaManager.getQuotaStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve quota status' });
  }
});

// GET /api/quota/limits — Returns parsed agy CLI usage quotas (Weekly, 5-Hour, reset timestamps)
quotaRouter.get('/quota/limits', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true' || req.query.refresh === 'true';
    const limits = await quotaManager.fetchQuotaLimits(force);
    res.json(limits);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve quota limits' });
  }
});

// POST /api/quota/reset — Manually clears/resets quota exhaustion flag
quotaRouter.post('/quota/reset', (_req: Request, res: Response) => {
  try {
    const status = quotaManager.clearQuota();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reset quota status' });
  }
});
