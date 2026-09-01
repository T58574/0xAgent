-- Veronica Operational Schema v1.0
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  name TEXT PRIMARY KEY,
  autonomy_level TEXT NOT NULL DEFAULT 'L2',
  settings_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  runtime_profile TEXT NOT NULL DEFAULT 'default',
  project TEXT NOT NULL,
  skill TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  summary TEXT,
  result_json TEXT,
  error_message TEXT,
  autonomy_level TEXT NOT NULL DEFAULT 'L2',
  veronica_version TEXT NOT NULL DEFAULT '1.0.0',
  pid INTEGER,
  last_heartbeat INTEGER,
  task_token TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_status_finished 
  ON agent_tasks (project, status, finished_at);

CREATE INDEX IF NOT EXISTS idx_tasks_status 
  ON agent_tasks (status);

CREATE INDEX IF NOT EXISTS idx_tasks_started_at 
  ON agent_tasks (started_at DESC);

CREATE TABLE IF NOT EXISTS agent_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_task_timestamp 
  ON agent_events (task_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_events_timestamp 
  ON agent_events (timestamp);

CREATE TABLE IF NOT EXISTS git_commits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  project TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  branch TEXT NOT NULL,
  message TEXT NOT NULL,
  files_changed TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_git_project_timestamp 
  ON git_commits (project, timestamp DESC);

CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  skill TEXT NOT NULL,
  schedule TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run INTEGER,
  next_run INTEGER
);

CREATE TABLE IF NOT EXISTS project_snapshots (
  project TEXT PRIMARY KEY,
  last_updated INTEGER NOT NULL,
  active_tasks_count INTEGER NOT NULL DEFAULT 0,
  recent_completions TEXT,
  pending_attention_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at INTEGER NOT NULL,
  dense_context_summary TEXT
);

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
