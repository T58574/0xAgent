import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const APP_DIR = path.join(os.homedir(), '.0xagent');
const DB_FILE = path.join(APP_DIR, 'memory.db');
const LEGACY_JSON_FILE = path.join(APP_DIR, 'memory.json');

let dbInstance: DatabaseSync | null = null;
let customDbPath: string | null = null;

export function setCustomDbPath(p: string | null): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
  customDbPath = p;
}

export function getMemoryDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customDbPath || DB_FILE;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initSchema(db);
  migrateLegacyJsonIfEmpty(db);

  dbInstance = db;
  return db;
}

export function closeMemoryDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    -- 1. PROVENANCE & SOURCES
    CREATE TABLE IF NOT EXISTS memory_sources (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('explicit_command', 'conversation_extraction', 'manual_edit')),
      raw_quote TEXT,
      created_at INTEGER NOT NULL
    );

    -- 2. CANONICAL USER MEMORIES
    CREATE TABLE IF NOT EXISTS canonical_memories (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL DEFAULT 'user_default',
      category TEXT NOT NULL CHECK(category IN ('profile', 'preference', 'interest', 'fact', 'user_preference', 'project_convention', 'architecture', 'general')),
      domain TEXT NOT NULL DEFAULT 'general',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1.0,
      is_explicit INTEGER NOT NULL DEFAULT 0,
      importance INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'candidate', 'superseded', 'invalidated', 'conflict')),
      source_id TEXT REFERENCES memory_sources(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_confirmed_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_fact 
    ON canonical_memories(subject_id, category, domain, key) 
    WHERE status = 'active';

    CREATE INDEX IF NOT EXISTS idx_mem_lookup 
    ON canonical_memories(subject_id, category, domain, status);

    -- 3. EPISODIC MEMORY
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL DEFAULT 'user_default',
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 2,
      lifecycle TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active', 'consolidated', 'archived')),
      event_timestamp INTEGER NOT NULL,
      source_id TEXT REFERENCES memory_sources(id),
      created_at INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_lookup 
    ON episodes(subject_id, lifecycle, event_timestamp);

    -- 4. PERSONA RELATIONSHIPS
    CREATE TABLE IF NOT EXISTS persona_relationships (
      subject_id TEXT NOT NULL DEFAULT 'user_default',
      persona_id TEXT NOT NULL,
      familiarity REAL NOT NULL DEFAULT 0.5,
      formality REAL NOT NULL DEFAULT 0.5,
      warmth REAL NOT NULL DEFAULT 0.5,
      humor_level REAL NOT NULL DEFAULT 0.5,
      preferred_address TEXT,
      relationship_summary TEXT,
      shared_references TEXT,
      interaction_count INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (subject_id, persona_id)
    );

    -- 5. MEMORY AUDIT & CONFLICT LOG
    CREATE TABLE IF NOT EXISTS memory_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('NEW', 'UPDATE', 'DELETE', 'INVALIDATE', 'CONFLICT', 'RESOLVE')),
      old_status TEXT,
      new_status TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      applied_by TEXT NOT NULL,
      actor_scope TEXT,
      timestamp INTEGER NOT NULL
    );

    -- 6.1. DERIVED INDEX: FTS5 FULL-TEXT SEARCH
    CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
      title,
      summary,
      content='episodes',
      content_rowid='rowid'
    );

    -- 6.2. DERIVED INDEX: VECTOR EMBEDDINGS
    CREATE TABLE IF NOT EXISTS episode_embeddings (
      episode_id TEXT PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      embedding BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // FTS5 Synchronization triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
      INSERT INTO episodes_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
    END;

    CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
      INSERT INTO episodes_fts(episodes_fts, rowid, title, summary) VALUES('delete', old.rowid, old.title, old.summary);
    END;

    CREATE TRIGGER IF NOT EXISTS episodes_au AFTER UPDATE ON episodes BEGIN
      INSERT INTO episodes_fts(episodes_fts, rowid, title, summary) VALUES('delete', old.rowid, old.title, old.summary);
      INSERT INTO episodes_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
    END;
  `);
}

function migrateLegacyJsonIfEmpty(db: DatabaseSync): void {
  try {
    const countRow = db.prepare('SELECT count(*) as count FROM canonical_memories').get() as { count: number };
    if (countRow && countRow.count > 0) {
      return;
    }

    if (!fs.existsSync(LEGACY_JSON_FILE)) {
      // Seed default initial memories
      const now = Date.now();
      const insert = db.prepare(`
        INSERT INTO canonical_memories (
          id, subject_id, category, domain, key, value, confidence, is_explicit, importance, status, created_at, updated_at, last_confirmed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run('mem_1', 'user_default', 'user_preference', 'general', 'preferred_language', 'Russian', 1.0, 1, 5, 'active', now, now, now);
      insert.run('mem_2', 'user_default', 'architecture', 'hardware', 'gpu_card', 'AMD Radeon RX 7800 XT (Vulkan backend recommended)', 1.0, 1, 4, 'active', now, now, now);
      return;
    }

    const data = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
    const items = JSON.parse(data);
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const insert = db.prepare(`
      INSERT OR REPLACE INTO canonical_memories (
        id, subject_id, category, domain, key, value, confidence, is_explicit, importance, status, created_at, updated_at, last_confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    for (const it of items) {
      const id = it.id || `mem_${now}_${Math.random().toString(36).substring(2, 6)}`;
      const cat = it.category || 'fact';
      const key = it.key || 'unknown_key';
      const val = it.value || '';
      const domain = it.domain || 'general';
      const conf = typeof it.confidence === 'number' ? it.confidence : 1.0;
      const isExp = it.is_explicit ? 1 : 1; // legacy items are treated as explicit
      const imp = it.importance || 3;
      const st = it.status || 'active';
      const cAt = it.createdAt || now;
      const uAt = it.updatedAt || now;

      insert.run(id, 'user_default', cat, domain, key, val, conf, isExp, imp, st, cAt, uAt, uAt);
    }
  } catch (err) {
    console.error('[memoryDb] Legacy JSON migration error:', err);
  }
}
