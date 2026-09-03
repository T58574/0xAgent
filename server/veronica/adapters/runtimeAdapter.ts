import { AgentTask } from '../types';

export interface SpawnTaskOptions {
  project: string;
  skill: string;
  runtime_profile?: string;
  autonomy_level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  custom_prompt?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'auto';
  agent?: string;
  print_timeout?: string;
  conversation_id?: string;
  continue_recent?: boolean;
  output_format?: 'text' | 'json' | 'stream-json';
  max_tool_calls?: number;
  existing_task_id?: string;
  network_retry_count?: number;
}

export interface RuntimeAdapter {
  spawnTask(options: SpawnTaskOptions): Promise<AgentTask>;
  killTask(taskId: string): Promise<boolean>;
  isAvailable(): Promise<boolean>;
}
