import { AgentTask } from '../types';

export interface SpawnTaskOptions {
  project: string;
  skill: string;
  runtime_profile?: string;
  autonomy_level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  custom_prompt?: string;
}

export interface RuntimeAdapter {
  spawnTask(options: SpawnTaskOptions): Promise<AgentTask>;
  killTask(taskId: string): Promise<boolean>;
  isAvailable(): Promise<boolean>;
}
