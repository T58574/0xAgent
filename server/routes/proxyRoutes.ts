import { Router, Request, Response } from 'express';
import { proxyService } from '../proxyService';
import { ProxyProtocol, ProxyStatus } from '../../src/types';

export function createProxyRouter(broadcast?: (event: string, payload: any) => void): Router {
  const router = Router();

  if (broadcast) {
    proxyService.setBroadcaster(broadcast);
  }

  // GET /api/proxies — List all proxies
  router.get('/proxies', (req: Request, res: Response) => {
    try {
      const isActiveOnly = req.query.active === 'true';
      const status = req.query.status as ProxyStatus | undefined;
      const protocol = req.query.protocol as ProxyProtocol | undefined;
      const tag = req.query.tag as string | undefined;

      const proxies = proxyService.listProxies({ isActiveOnly, status, protocol, tag });
      res.json({ proxies, count: proxies.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/proxies — Add proxy or batch of proxies
  router.post('/proxies', async (req: Request, res: Response) => {
    try {
      const { input, protocol, expiresAt } = req.body;
      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: 'Proxy input string is required' });
        return;
      }

      const result = await proxyService.addProxies(input, protocol, expiresAt);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/proxies/check — Trigger health-check for all proxies or single
  router.post('/proxies/check', async (req: Request, res: Response) => {
    try {
      const { id } = req.body || {};
      if (id) {
        const checkResult = await proxyService.checkSingleProxy(id);
        res.json(checkResult);
      } else {
        const results = await proxyService.checkAllProxies();
        res.json({ checked: results.length, results });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/proxies/:id/toggle — Toggle active state
  router.put('/proxies/:id/toggle', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const updated = proxyService.setActive(String(id), Boolean(isActive));
      if (!updated) {
        res.status(404).json({ error: 'Proxy not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/proxies/:id — Remove a proxy
  router.delete('/proxies/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ok = proxyService.deleteProxy(String(id));
      if (!ok) {
        res.status(404).json({ error: 'Proxy not found' });
        return;
      }
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/proxies/export — Export config for external modules (JSON / TXT / ENV)
  router.get('/proxies/export', (req: Request, res: Response) => {
    try {
      const format = (req.query.format as 'json' | 'txt' | 'env') || 'json';
      const result = proxyService.exportConfig(format);
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.json(result);
      } else {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(result);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/proxies/routing — Get routing matrix configuration & active gateway
  router.get('/proxies/routing', (_req: Request, res: Response) => {
    try {
      const routing = proxyService.getRoutingConfig();
      const bestProxy = proxyService.getBestProxy();
      res.json({ routing, bestProxy });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/proxies/routing — Update routing matrix configuration
  router.post('/proxies/routing', (req: Request, res: Response) => {
    try {
      const updated = proxyService.setRoutingConfig(req.body);
      const bestProxy = proxyService.getBestProxy();
      res.json({ routing: updated, bestProxy });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
