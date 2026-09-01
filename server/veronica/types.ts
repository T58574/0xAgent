export type TaskStatus =
  | 'scheduled'
  | 'created'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'crashed'
  | 'cancelled'
  | 'interrupted'
  | 'invalid'
  | 'waiting'
  | 'awaiting_approval';

export type EventType =
  | 'heartbeat'
  | 'progress'
  | 'decision'
  | 'warning'
  | 'error'
  | 'system';

export type AutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface AgentTask {
  id: string; // UUID
  runtime_profile: string;
  project: string;
  skill: string;
  status: TaskStatus;
  started_at: number;
  finished_at?: number | null;
  summary?: string | null;
  result_json?: string | null;
  error_message?: string | null;
  autonomy_level: AutonomyLevel;
  veronica_version: string;
  pid?: number | null;
  last_heartbeat?: number | null;
  task_token: string;
  retry_count?: number;
  max_retries?: number;
  approval_payload?: string | null;
  custom_prompt?: string | null;
}

export interface AgentEvent {
  id?: number;
  task_id: string;
  event_type: EventType;
  timestamp: number;
  message: string;
  data_json?: string | null;
}

export interface GitCommitRecord {
  id?: number;
  task_id: string;
  project: string;
  commit_hash: string;
  branch: string;
  message: string;
  files_changed: string; // JSON string array
  timestamp: number;
}

export interface ProjectRecord {
  name: string;
  autonomy_level: AutonomyLevel;
  settings_json?: string | null;
  created_at: number;
}

export interface CronJobRecord {
  id: string;
  project: string;
  skill: string;
  schedule: string;
  enabled: boolean;
  skill_file?: string | null;
  custom_prompt?: string | null;
  last_run?: number | null;
  next_run?: number | null;
}

export interface ProjectSnapshot {
  project: string;
  last_updated: number;
  active_tasks_count: number;
  recent_completions: string; // JSON summary
  pending_attention_count: number;
  last_activity_at: number;
  dense_context_summary: string;
}

export interface VeronicaModuleStatus {
  enabled: boolean;
  db_healthy: boolean;
  active_tasks: number;
  queued_tasks: number;
  today_completed: number;
  today_failed: number;
  telegram_connected: boolean;
  remote_gpu_online: boolean;
}
