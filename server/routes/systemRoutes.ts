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

// GET /api/diagnostics & /api/system/diagnostics — Full backend diagnostic report
const handleDiagnostics = async (_req: Request, res: Response) => {
  try {
    const { quotaManager } = await import('../agent/quotaManager');
    const { detectGpuHardwareAsync } = await import('../hardware');
    const { activeSessionStreams } = await import('../agent/agentState');
    const { loadConfig } = await import('../config');
    const os = await import('node:os');

    const config = loadConfig();
    const hw = await detectGpuHardwareAsync();
    const quota = quotaManager.getQuotaStatus();
    const versionInfo = updateService.getSystemVersion();

    const memUsage = process.memoryUsage();
    const activeStreamsCount = activeSessionStreams.size;

    const report = {
      timestamp: Date.now(),
      status: quota.exhausted ? 'degraded' : 'healthy',
      version: versionInfo.version,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMB: Math.round(memUsage.rss / (1024 * 1024)),
        heapUsedMB: Math.round(memUsage.heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(memUsage.heapTotal / (1024 * 1024)),
        systemFreeGB: Number((os.freemem() / (1024 * 1024 * 1024)).toFixed(1)),
        systemTotalGB: Number((os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)),
      },
      hardware: {
        gpuVendor: hw.vendor,
        gpuName: hw.gpuName,
        vramMB: hw.vramMB || null,
        cpuCores: hw.cpuCores,
        ramGB: hw.ramGB,
      },
      modelConfig: {
        modelName: config.model_name || 'local:qwen2.5-coder-32b.gguf',
        contextSize: config.local_server?.ctx_size || config.max_tokens || 16384,
        planningMode: config.planning_mode ?? false,
      },
      telemetry: {
        activeStreams: activeStreamsCount,
        quotaExhausted: quota.exhausted,
        quotaResetAt: quota.resetAt || null,
        quotaResetInSeconds: quota.resetInSeconds || null,
        quotaResetText: quota.resetText || null,
        quotaReason: quota.reason || null,
      },
    };

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Diagnostic collection failed' });
  }
};

systemRouter.get('/diagnostics', handleDiagnostics);
systemRouter.get('/system/diagnostics', handleDiagnostics);

