import { Router } from 'express';
import { BENCHMARK_TASKS, runModelBenchmark, BenchmarkSuiteReport } from '../agent/modelBenchmark';

export type BroadcastFn = (event: string, payload: any) => void;

let isBenchmarkRunning = false;
let lastReport: BenchmarkSuiteReport | null = null;

export function createBenchmarkRouter(broadcast: BroadcastFn): Router {
  const router = Router();

  // Get available benchmark tasks
  router.get('/tasks', (_req, res) => {
    const tasks = BENCHMARK_TASKS.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      prompt: t.prompt,
    }));
    res.json({ success: true, tasks });
  });

  // Get current status or last report
  router.get('/status', (_req, res) => {
    res.json({
      success: true,
      isRunning: isBenchmarkRunning,
      lastReport,
    });
  });

  // Execute benchmark suite
  router.post('/run', async (req, res) => {
    if (isBenchmarkRunning) {
      res.status(409).json({ success: false, error: 'Бенчмарк уже выполняется. Дождитесь завершения.' });
      return;
    }

    const { provider, model, endpoint, taskIds } = req.body || {};

    isBenchmarkRunning = true;
    broadcast('benchmark:status', { isRunning: true, model, provider });

    try {
      const report = await runModelBenchmark({
        provider: provider || 'local',
        model,
        endpoint,
        taskIds,
        onProgress: (progress) => {
          broadcast('benchmark:progress', progress);
        },
      });

      lastReport = report;
      broadcast('benchmark:completed', report);
      res.json({ success: true, report });
    } catch (err: any) {
      const errorMsg = err.message || 'Ошибка выполнения бенчмарка';
      broadcast('benchmark:error', { error: errorMsg });
      res.status(500).json({ success: false, error: errorMsg });
    } finally {
      isBenchmarkRunning = false;
      broadcast('benchmark:status', { isRunning: false });
    }
  });

  return router;
}
