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
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

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
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'candidate', 'superseded', 'invalidated', 'conflict', 'archived', 'rejected')),
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

    -- 7. PROJECTS / WORKSPACE IDENTITY
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      repo_root TEXT,
      workspace_dir TEXT,
      git_remote TEXT,
      fingerprint TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('discovered', 'active', 'archived', 'merged')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_workspace_dir ON projects(workspace_dir);
    CREATE INDEX IF NOT EXISTS idx_projects_git_remote ON projects(git_remote);

    -- 8. PROJECT PATH ALIASES
    CREATE TABLE IF NOT EXISTS project_path_aliases (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      normalized_path TEXT NOT NULL,
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, normalized_path)
    );

    CREATE INDEX IF NOT EXISTS idx_project_path_aliases_path ON project_path_aliases(normalized_path);

    -- 9. PERSONA FILE VERSIONS
    CREATE TABLE IF NOT EXISTS persona_file_versions (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      file TEXT NOT NULL CHECK (file IN ('SOUL.md', 'TOOLS.md', 'USER.md', 'USER_PINNED.md', 'CORE.md')),
      content TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'system',
      source_proposal_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (persona_id, file, content_sha256)
    );

    CREATE INDEX IF NOT EXISTS idx_persona_file_versions_persona_file ON persona_file_versions(persona_id, file, created_at DESC);

    -- 10. PERSONA CHANGE PROPOSALS
    CREATE TABLE IF NOT EXISTS persona_change_proposals (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      target_file TEXT NOT NULL CHECK (target_file IN ('SOUL.md', 'TOOLS.md', 'USER.md', 'USER_PINNED.md', 'CORE.md')),
      target_section TEXT,
      operation TEXT NOT NULL CHECK (operation IN ('append', 'prepend', 'replace_section', 'insert_after', 'insert_before', 'delete_section', 'set_metadata')),
      patch_payload TEXT NOT NULL,
      rationale TEXT,
      source_type TEXT NOT NULL DEFAULT 'agent' CHECK (source_type IN ('agent', 'user', 'reflection', 'migration', 'system')),
      source_event_id TEXT,
      source_session_id TEXT,
      base_version_id TEXT REFERENCES persona_file_versions(id),
      risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
      requires_approval INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'reverted', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      applied_at TEXT,
      rejected_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_persona_change_proposals_persona ON persona_change_proposals(persona_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_persona_change_proposals_status ON persona_change_proposals(status, created_at DESC);

    -- 11. REGRESSION CHECKS (Pre-Apply Guard)
    CREATE TABLE IF NOT EXISTS regression_checks (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      baseline_composite REAL NOT NULL,
      proposed_composite REAL NOT NULL,
      delta REAL NOT NULL,
      blocked INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_regression_checks_proposal ON regression_checks(proposal_id, created_at DESC);

    -- 12. EVOLUTION TELEMETRY (Continuous Observability)
    CREATE TABLE IF NOT EXISTS evolution_telemetry (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      persona_id TEXT,
      project_id TEXT,
      session_id TEXT,
      proposal_id TEXT,
      proposal_risk_level TEXT,
      proposal_operation TEXT,
      regression_blocked INTEGER,
      baseline_score REAL,
      proposed_score REAL,
      score_delta REAL,
      memories_decayed INTEGER,
      memories_archived INTEGER,
      conflicts_resolved INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON evolution_telemetry(event_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_telemetry_persona ON evolution_telemetry(persona_id, created_at DESC);

    -- 13. MEMORY DECAY & HYGIENE LOGS
    CREATE TABLE IF NOT EXISTS memory_decay_logs (
      id TEXT PRIMARY KEY,
      decayed_count INTEGER NOT NULL DEFAULT 0,
      archived_count INTEGER NOT NULL DEFAULT 0,
      conflicts_resolved INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  // 11. Additive column migrations on canonical_memories
  migrateCanonicalMemoriesColumns(db);

  // 12. Create views & perform scope backfill
  createScopedViewsAndBackfill(db);
}

function migrateCanonicalMemoriesColumns(db: DatabaseSync): void {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(canonical_memories)`).all() as { name: string }[];
    const existingCols = new Set(tableInfo.map((c) => c.name));

    if (!existingCols.has('scope')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN scope TEXT NOT NULL DEFAULT 'user';`);
    }
    if (!existingCols.has('project_id')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN project_id TEXT;`);
    }
    if (!existingCols.has('persona_id')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN persona_id TEXT;`);
    }
    if (!existingCols.has('session_id')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN session_id TEXT;`);
    }
    if (!existingCols.has('display_text')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN display_text TEXT;`);
    }
    if (!existingCols.has('usage_count')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!existingCols.has('last_used_at')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN last_used_at TEXT;`);
    }
    if (!existingCols.has('expires_at')) {
      db.exec(`ALTER TABLE canonical_memories ADD COLUMN expires_at TEXT;`);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_canonical_memories_scope_status ON canonical_memories(scope, status);
      CREATE INDEX IF NOT EXISTS idx_canonical_memories_user_scope ON canonical_memories(subject_id, scope, status);
      CREATE INDEX IF NOT EXISTS idx_canonical_memories_project_scope ON canonical_memories(project_id, scope, status);
      CREATE INDEX IF NOT EXISTS idx_canonical_memories_persona_scope ON canonical_memories(persona_id, scope, status);
      CREATE INDEX IF NOT EXISTS idx_canonical_memories_session_scope ON canonical_memories(session_id, scope, status);
      CREATE INDEX IF NOT EXISTS idx_canonical_memories_domain_key ON canonical_memories(domain, key);
    `);
  } catch (err) {
    console.error('[memoryDb] Error migrating canonical_memories columns:', err);
  }
}

function createScopedViewsAndBackfill(db: DatabaseSync): void {
  try {
    db.exec(`
      CREATE VIEW IF NOT EXISTS active_user_memories AS
      SELECT *
      FROM canonical_memories
      WHERE scope = 'user'
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY importance DESC, confidence DESC, updated_at DESC;

      CREATE VIEW IF NOT EXISTS active_project_memories AS
      SELECT *
      FROM canonical_memories
      WHERE scope = 'project'
        AND status = 'active'
        AND project_id IS NOT NULL
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY importance DESC, confidence DESC, updated_at DESC;

      CREATE VIEW IF NOT EXISTS active_persona_memories AS
      SELECT *
      FROM canonical_memories
      WHERE scope = 'persona'
        AND status = 'active'
        AND persona_id IS NOT NULL
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY importance DESC, confidence DESC, updated_at DESC;
    `);

    // Backfill scope classifications
    db.exec(`
      UPDATE canonical_memories
      SET
        scope = 'user',
        subject_id = 'user_default',
        persona_id = NULL,
        project_id = NULL,
        session_id = NULL
      WHERE domain IN (
        'user',
        'user_profile',
        'user_preference',
        'preference',
        'preferences',
        'profile',
        'identity'
      ) AND (scope IS NULL OR scope = 'user');

      UPDATE canonical_memories
      SET
        scope = 'project',
        persona_id = NULL,
        session_id = NULL
      WHERE domain IN (
        'project',
        'project_convention',
        'architecture',
        'repo',
        'workspace',
        'codebase'
      ) AND (scope IS NULL OR scope = 'user');

      UPDATE canonical_memories
      SET
        scope = 'persona',
        project_id = NULL,
        session_id = NULL
      WHERE domain IN (
        'persona',
        'persona_style',
        'style',
        'tone',
        'voice'
      ) AND (scope IS NULL OR scope = 'user');
    `);
  } catch (err) {
    console.error('[memoryDb] Error creating views or backfilling scopes:', err);
  }
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
