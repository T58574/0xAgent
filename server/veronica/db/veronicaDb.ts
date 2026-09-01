import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: DatabaseSync | null = null;
let dbFilePath: string = '';

export function getVeronicaDataDir(): string {
  const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_APP_DIR;
  const baseDir = isTest
    ? path.join(os.tmpdir(), '.0xagent_test_env', 'veronica')
    : path.join(os.homedir(), '.0xagent', 'veronica');

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const backupDir = path.join(baseDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const logsDir = path.join(baseDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return baseDir;
}

export function getVeronicaDbPath(): string {
  if (!dbFilePath) {
    dbFilePath = path.join(getVeronicaDataDir(), 'veronica.db');
  }
  return dbFilePath;
}

export function initVeronicaDatabase(customPath?: string): DatabaseSync {
  if (dbInstance) return dbInstance;

  const targetPath = customPath || getVeronicaDbPath();
  dbFilePath = targetPath;

  const db = new DatabaseSync(targetPath);
  dbInstance = db;

  // Optimize SQLite PRAGMAs for high-throughput concurrency
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 10000;');

  // Read and apply schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }

  // Record initial schema version if not set
  const stmt = db.prepare('SELECT version FROM schema_version WHERE version = 1');
  const res = stmt.get();
  if (!res) {
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (1, ?)').run(Date.now());
  }

  return db;
}

export function getVeronicaDb(): DatabaseSync {
  if (!dbInstance) {
    return initVeronicaDatabase();
  }
  return dbInstance;
}

export function closeVeronicaDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore close error on exit
    }
    dbInstance = null;
  }
}

/**
 * Backup veronica.db to ~/.0xagent/veronica/backups/
 */
export function createDatabaseBackup(): string | null {
  try {
    const dataDir = getVeronicaDataDir();
    const backupDir = path.join(dataDir, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `veronica_backup_${timestamp}.db`);

    const db = getVeronicaDb();
    // Flush WAL checkpoints before copy
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

    fs.copyFileSync(getVeronicaDbPath(), backupPath);

    // Clean up backups older than 30 days
    cleanupOldBackups(backupDir, 30);
    return backupPath;
  } catch (err) {
    console.error('[Veronica Backup] Error creating backup:', err);
    return null;
  }
}

function cleanupOldBackups(backupDir: string, retentionDays: number) {
  try {
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

    for (const f of files) {
      if (f.startsWith('veronica_backup_') && f.endsWith('.db')) {
        const filePath = path.join(backupDir, f);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch {
    // Ignore cleanup error
  }
}

/**
 * Daily retention cleaner: agent_events (30d), heartbeat events (7d)
 */
export function runRetentionCleanup(): void {
  try {
    const db = getVeronicaDb();
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    db.prepare("DELETE FROM agent_events WHERE event_type = 'heartbeat' AND timestamp < ?").run(sevenDaysAgo);
    db.prepare("DELETE FROM agent_events WHERE timestamp < ? AND task_id NOT IN (SELECT id FROM agent_tasks WHERE status = 'failed' OR status = 'crashed')").run(thirtyDaysAgo);
  } catch (err) {
    console.error('[Veronica Retention] Error running cleanup:', err);
  }
}
