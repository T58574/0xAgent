import { initVeronicaDatabase, closeVeronicaDatabase, createDatabaseBackup, runRetentionCleanup } from './db/veronicaDb';
import { RecoveryService } from './watchdog/recoveryService';
import { processWatchdog } from './watchdog/processWatchdog';
import { veronicaScheduler } from './core/scheduler';
import { initTelegramBot, stopTelegramBot } from './telegram/bot';
import { loadConfig } from '../config';
import { VeronicaModuleStatus } from './types';
import { taskRegistry } from './core/taskRegistry';
import { remoteNodeService } from '../remoteNodeService';
import { snapshotCache } from './core/snapshotCache';

import { writeQueue } from './db/writeQueue';

let isModuleInitialized = false;
let backupIntervalTimer: NodeJS.Timeout | null = null;

export async function initVeronicaModule(): Promise<boolean> {
  const config = loadConfig();
  if (config.veronica?.enabled === false) {
    console.log('[Veronica] [INFO] Module disabled by configuration (veronica.enabled = false).');
    return false;
  }

  if (isModuleInitialized) return true;

  console.log('[Veronica] [INIT] Starting Veronica Personal AI Assistant Engine...');

  try {
    // 1. Initialize SQLite Database (WAL mode)
    initVeronicaDatabase();

    // 2. Run startup reconciliation for crashed/orphan tasks
    await RecoveryService.reconcileOnStartup();

    // 3. Pre-sync discovered projects and build snapshots
    try {
      await snapshotCache.syncAllDiscovered();
    } catch (sErr) {
      console.warn('[Veronica] [WARN] Initial project sync error:', sErr);
    }

    // 4. Start Process Watchdog
    const watchdogInterval = config.veronica?.watchdog_interval_sec || 15;
    processWatchdog.start(watchdogInterval);

    // 5. Start internal Scheduler
    veronicaScheduler.start(10000);

    // 6. Initialize Telegram Bot (if token configured)
    initTelegramBot();

    // 7. Schedule daily backups & retention cleaner (every 24h)
    if (backupIntervalTimer) clearInterval(backupIntervalTimer);
    backupIntervalTimer = setInterval(() => {
      createDatabaseBackup();
      runRetentionCleanup();
    }, 24 * 60 * 60 * 1000);
    backupIntervalTimer.unref?.();

    isModuleInitialized = true;
    console.log('[Veronica] [OK] Veronica Engine successfully initialized.');
    return true;
  } catch (err) {
    console.error('[Veronica] [FAIL] Initialization failed:', err);
    return false;
  }
}

export function shutdownVeronicaModule(): void {
  if (!isModuleInitialized) return;
  console.log('[Veronica] Shutting down Veronica module...');
  if (backupIntervalTimer) {
    clearInterval(backupIntervalTimer);
    backupIntervalTimer = null;
  }
  processWatchdog.stop();
  veronicaScheduler.stop();
  stopTelegramBot();
  closeVeronicaDatabase();
  isModuleInitialized = false;
}

export async function reloadVeronicaModule(): Promise<{ success: boolean; status: VeronicaModuleStatus; timestamp: number }> {
  console.log('[Veronica] [HOT-RELOAD] Gracefully reloading Veronica module...');
  try {
    // 1. Drain write queue
    await writeQueue.drain().catch(() => {});

    // 2. Stop watchdogs and schedulers
    processWatchdog.stop();
    veronicaScheduler.stop();
    stopTelegramBot();

    // 3. Mark uninitialized
    isModuleInitialized = false;

    // 4. Re-run startup initialization
    const ok = await initVeronicaModule();
    console.log('[Veronica] [HOT-RELOAD] [OK] Veronica module successfully reloaded without parent disruption.');
    return {
      success: ok,
      status: getVeronicaStatus(),
      timestamp: Date.now(),
    };
  } catch (err: any) {
    console.error('[Veronica] [HOT-RELOAD] [FAIL] Error reloading Veronica module:', err);
    return {
      success: false,
      status: getVeronicaStatus(),
      timestamp: Date.now(),
    };
  }
}

export function getVeronicaStatus(): VeronicaModuleStatus {
  const config = loadConfig();
  if (!isModuleInitialized) {
    return {
      enabled: false,
      db_healthy: false,
      active_tasks: 0,
      queued_tasks: 0,
      today_completed: 0,
      today_failed: 0,
      telegram_connected: false,
      remote_gpu_online: false,
    };
  }

  const activeTasks = taskRegistry.getActiveTasks();
  const queuedTasks = taskRegistry.listTasks({ status: 'queued' as any });
  const remoteStatus = remoteNodeService.getStatus();

  return {
    enabled: true,
    db_healthy: true,
    active_tasks: activeTasks.length,
    queued_tasks: queuedTasks.length,
    today_completed: 0,
    today_failed: 0,
    telegram_connected: !!(config.veronica?.telegram_token || process.env.TELEGRAM_BOT_TOKEN),
    remote_gpu_online: remoteStatus.online,
  };
}

export * from './types';
export * from './core/taskRegistry';
export * from './core/contextEngine';
export * from './core/snapshotCache';
export * from './core/projectDiscovery';
export * from './core/projectDocManager';
export * from './cli/cliHandler';
export * from './adapters/antigravityAdapter';
export * from './telegram/veronicaOrchestrator';
