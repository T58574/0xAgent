import { get, post } from './core';
import { HardwareInfo, ServerStatusInfo, ContextBreakdownReport } from '../../types';

// Hardware & Server Telemetry
export const detect_hardware = () => get<HardwareInfo>('/detect-hardware');
export const get_server_status = () => get<ServerStatusInfo>('/server-status');
export const get_server_logs = () => get<{ logs: string[]; logFilePath: string; running: boolean }>('/server-logs');
export const get_lan_info = () => get<{ urls: string[] }>('/get-local-ips');
export const get_local_ips = () => get<{ urls: string[] }>('/get-local-ips');

export async function get_server_health(host: string, port: number): Promise<{ ok: boolean; status: string }> {
  try {
    return await get<{ ok: boolean; status: string }>(`/server-health?host=${encodeURIComponent(host)}&port=${port}`);
  } catch {
    return { ok: false, status: 'stopped' };
  }
}

export async function get_server_slots(host: string, port: number): Promise<{ ok: boolean; totalSlots: number; activeSlots: number }> {
  try {
    return await get<{ ok: boolean; totalSlots: number; activeSlots: number }>(`/server-slots?host=${encodeURIComponent(host)}&port=${port}`);
  } catch {
    return { ok: false, totalSlots: 0, activeSlots: 0 };
  }
}

export const start_local_server = (params?: any) =>
  post<{ success: boolean; message: string }>('/start-local-server', params || {});
export const stop_local_server = () => post<{ success: boolean; message: string }>('/stop-local-server');
export const purge_vram = () => post<{ success: boolean; message: string; killedCount?: number }>('/purge-vram');

// Persona Evolution Telemetry & Context
export const get_eval_benchmark = () => get<any>('/eval/benchmark');
export const trigger_memory_decay_cycle = () => post<any>('/personas/decay/cycle', {});
export const get_evolution_analytics = (days?: number) =>
  get<any>(days ? `/analytics/evolution?days=${days}` : '/analytics/evolution');
export const get_evolution_telemetry = (limit?: number) =>
  get<any[]>(limit ? `/analytics/evolution/telemetry?limit=${limit}` : '/analytics/evolution/telemetry');

export const get_context_breakdown = (sessionId?: string | null) =>
  get<ContextBreakdownReport>(sessionId ? `/context/breakdown?sessionId=${encodeURIComponent(sessionId)}` : '/context/breakdown');
