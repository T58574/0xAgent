import { get, post, API_BASE } from './core';
import { getStoredToken } from '../wsService';
import { VeronicaStreamEvent, VeronicaModuleStatus } from '../../types';

// Veronica & Remote Node API
export const get_veronica_status = () => get<any>('/veronica/status');
export const get_veronica_projects = () => get<{ projects: any[] }>('/veronica/projects');
export const rescan_veronica_projects = () => post<{ success: boolean; projects: any[] }>('/veronica/projects/rescan', {});
export const get_veronica_paths = () => get<{ paths: string[] }>('/veronica/projects/paths');
export const add_veronica_path = (path: string) => post<{ success: boolean; paths: string[]; projects: any[] }>('/veronica/projects/paths', { path });
export const get_veronica_models = () => get<{ local: string[]; antigravity: { slug: string; name: string; effort?: string }[] }>('/veronica/models');
export const get_veronica_agents = () => get<{ agents: { slug: string; name: string; description?: string }[] }>('/veronica/agents');

export const spawn_veronica_task = (params: {
  project: string;
  skill: string;
  runtime_profile?: string;
  autonomy_level?: string;
  custom_prompt?: string;
  model?: string;
  effort?: string;
  agent?: string;
  print_timeout?: string;
  conversation_id?: string;
  continue_recent?: boolean;
}) => post<{ success: boolean; task: any }>('/veronica/tasks/spawn', params);

export const kill_veronica_task = (taskId: string) =>
  post<{ success: boolean }>(`/veronica/tasks/${encodeURIComponent(taskId)}/kill`, {});

export const reload_veronica_module = () =>
  post<{ success: boolean; status: VeronicaModuleStatus; timestamp: number }>('/veronica/reload', {});

export const get_veronica_task_stream_url = (taskId: string) =>
  `${API_BASE}/veronica/tasks/${encodeURIComponent(taskId)}/stream`;

export function stream_veronica_task(
  taskId: string,
  onEvent: (event: VeronicaStreamEvent) => void,
  onError?: (err: any) => void
): () => void {
  const token = getStoredToken();
  const url = `${get_veronica_task_stream_url(taskId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const eventSource = new EventSource(url);

  const handleMessage = (e: MessageEvent) => {
    try {
      const parsed: VeronicaStreamEvent = JSON.parse(e.data);
      onEvent(parsed);
      if (parsed.type === 'end') {
        eventSource.close();
      }
    } catch (parseErr) {
      console.warn('[Veronica Stream Parse Error]', parseErr);
    }
  };

  eventSource.addEventListener('open', handleMessage as any);
  eventSource.addEventListener('stdout', handleMessage as any);
  eventSource.addEventListener('stderr', handleMessage as any);
  eventSource.addEventListener('heartbeat', handleMessage as any);
  eventSource.addEventListener('status', handleMessage as any);
  eventSource.addEventListener('end', handleMessage as any);

  eventSource.onerror = (err) => {
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
