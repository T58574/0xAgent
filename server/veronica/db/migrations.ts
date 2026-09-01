import { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at INTEGER NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    name: 'add_retry_and_approval_fields',
    up: (db: DatabaseSync) => {
      // Safely add additive columns if they don't already exist
      const taskCols = db.prepare("PRAGMA table_info('agent_tasks')").all() as any[];
      const colNames = taskCols.map((c) => c.name);

      if (!colNames.includes('retry_count')) {
        db.exec('ALTER TABLE agent_tasks ADD COLUMN retry_count INTEGER DEFAULT 0;');
      }
      if (!colNames.includes('max_retries')) {
        db.exec('ALTER TABLE agent_tasks ADD COLUMN max_retries INTEGER DEFAULT 2;');
      }
      if (!colNames.includes('approval_payload')) {
        db.exec('ALTER TABLE agent_tasks ADD COLUMN approval_payload TEXT;');
      }
      if (!colNames.includes('custom_prompt')) {
        db.exec('ALTER TABLE agent_tasks ADD COLUMN custom_prompt TEXT;');
      }

      const cronCols = db.prepare("PRAGMA table_info('cron_jobs')").all() as any[];
      const cronColNames = cronCols.map((c) => c.name);

      if (!cronColNames.includes('skill_file')) {
        db.exec('ALTER TABLE cron_jobs ADD COLUMN skill_file TEXT;');
      }
      if (!cronColNames.includes('custom_prompt')) {
        db.exec('ALTER TABLE cron_jobs ADD COLUMN custom_prompt TEXT;');
      }
    },
  },
  {
    version: 3,
    name: 'add_operational_journal_and_telegram_conversations',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS operational_journal (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          project TEXT NOT NULL,
          task_id TEXT,
          agent TEXT NOT NULL DEFAULT 'agent',
          operation_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'completed',
          summary TEXT NOT NULL,
          changes_json TEXT,
          important INTEGER NOT NULL DEFAULT 0,
          commit_hash TEXT,
          metadata_json TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_journal_project_timestamp 
          ON operational_journal (project, timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_journal_task_id 
          ON operational_journal (task_id);

        CREATE INDEX IF NOT EXISTS idx_journal_timestamp 
          ON operational_journal (timestamp DESC);

        CREATE TABLE IF NOT EXISTS telegram_conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          metadata_json TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_telegram_conv_user_timestamp 
          ON telegram_conversations (user_id, timestamp ASC);
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync): void {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as any[];
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Veronica Migrations] Applying migration v${migration.version}: ${migration.name}`);
      migration.up(db);
      const stmt = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
      stmt.run(migration.version, migration.name, Date.now());
    }
  }
}
