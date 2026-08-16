import { Router } from 'express';
import { calculateContextBreakdown } from '../agent/tokenBreakdown';

export const contextRouter = Router();

contextRouter.get('/context/breakdown', async (req, res) => {
  try {
    const sessionId = (req.query.sessionId as string) || null;
    const report = await calculateContextBreakdown(sessionId);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

contextRouter.post('/context/breakdown', async (req, res) => {
  try {
    const { sessionId, configOverride } = req.body || {};
    const report = await calculateContextBreakdown(sessionId, configOverride);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});
