import { Router, Request, Response } from 'express';
import { updateService } from '../updateService';

export const systemRouter = Router();

// GET /api/system/version — Current installed version and runtime info
systemRouter.get('/system/version', (_req: Request, res: Response) => {
  try {
    const info = updateService.getSystemVersion();
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/check-update — Check GitHub for updates
systemRouter.get('/system/check-update', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const result = await updateService.checkForUpdates(force);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system/apply-update — Execute semi-automated update
systemRouter.post('/system/apply-update', async (_req: Request, res: Response) => {
  try {
    const result = await updateService.applyUpdate();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
