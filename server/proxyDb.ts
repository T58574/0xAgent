import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let dbInstance: DatabaseSync | null = null;
let customDbPath: string | null = null;

export function getProxyDbPath(): string {
  if (customDbPath) return customDbPath;
  const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_APP_DIR;
  const baseDir = isTest
    ? path.join(os.tmpdir(), '.0xagent_test_env')
    : path.join(os.homedir(), '.0xagent');
  return path.join(baseDir, 'proxies.db');
}

export function setCustomProxyDbPath(p: string | null): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
  customDbPath = p;
}

export function getProxyDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getProxyDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  initProxySchema(db);

  dbInstance = db;
  return db;
}

export function closeProxyDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}

function initProxySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      raw_line TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      protocol TEXT NOT NULL DEFAULT 'http',
      username TEXT,
      password TEXT,
      status TEXT NOT NULL DEFAULT 'unknown',
      latency_ms INTEGER,
      last_checked_at INTEGER,
      added_at INTEGER NOT NULL,
      expires_at INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      tag TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
    CREATE INDEX IF NOT EXISTS idx_proxies_is_active ON proxies(is_active);
    CREATE INDEX IF NOT EXISTS idx_proxies_expires_at ON proxies(expires_at);
    CREATE INDEX IF NOT EXISTS idx_proxies_host_port ON proxies(host, port);

    CREATE TABLE IF NOT EXISTS proxy_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
