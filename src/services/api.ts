import { AppConfig, ChatSession, FileNode, GgufMetadata, HardwareInfo, MemoryItem, SkillInfo, ServerStatusInfo, PersonaMetadata, PersonaDetail } from '../types';

const API_BASE = '/api';

type EventCallback = (eventData: { payload: any }) => void;
const eventListeners = new Map<string, Set<EventCallback>>();
let ws: WebSocket | null = null;
let reconnectTimer: any = null;

export function getStoredToken(): string {
  return localStorage.getItem('0xagent_auth_token') || '';
}

export function setStoredToken(token: string): void {
  localStorage.setItem('0xagent_auth_token', token);
  reconnectWebSocket();
}

export function clearStoredToken(): void {
  localStorage.removeItem('0xagent_auth_token');
  if (ws) {
    ws.close();
    ws = null;
  }
}

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = '3001';
  const token = getStoredToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${protocol}//${host}:${port}/ws${query}`;
}

export function reconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  initWebSocket();
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

function initWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    ws = new WebSocket(getWsUrl());

    ws.onmessage = (messageEvent) => {
      try {
        const { event, payload } = JSON.parse(messageEvent.data);
        const listeners = eventListeners.get(event);
        if (listeners) {
          listeners.forEach((cb) => cb({ payload }));
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      ws = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initWebSocket();
        }, 2000);
      }
    };

    ws.onerror = () => {
      if (ws) ws.close();
    };
  } catch (err) {
    console.error('WebSocket connection error:', err);
  }
}

initWebSocket();

export async function get_auth_status(): Promise<{
  isPasswordSet: boolean;
  isAuthenticated: boolean;
  locked?: boolean;
  remainingSec?: number;
}> {
  const res = await authFetch(`${API_BASE}/auth/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setup_password(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (res.ok && data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function login_password(password: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
  locked?: boolean;
  remainingSec?: number;
  attemptsLeft?: number;
}> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (res.ok && data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function change_password(currentPassword: string, newPassword: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const res = await authFetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (res.ok && data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function logout(): Promise<void> {
  try {
    await authFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  } catch {}
  clearStoredToken();
}

export function listen<T>(event: string, callback: (eventData: { payload: T }) => void): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  const listeners = eventListeners.get(event)!;
  listeners.add(callback as EventCallback);

  return () => {
    listeners.delete(callback as EventCallback);
  };
}

export async function get_config(): Promise<AppConfig> {
  const res = await authFetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function save_config(config: AppConfig): Promise<void> {
  const res = await authFetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function list_sessions(): Promise<ChatSession[]> {
  const res = await authFetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function load_session(id: string): Promise<ChatSession> {
  const res = await authFetch(`${API_BASE}/sessions/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function save_session(session: ChatSession): Promise<void> {
  const res = await authFetch(`${API_BASE}/sessions/${session.id}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function create_session(title?: string, workspace_dir?: string | null): Promise<ChatSession> {
  const res = await authFetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, workspace_dir }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function delete_session(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function select_workspace(): Promise<string | null> {
  const res = await authFetch(`${API_BASE}/select-workspace`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.folder;
}

export async function select_file_native(filter?: string): Promise<string | null> {
  const res = await authFetch(`${API_BASE}/select-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.filePath;
}

export async function get_workspace_tree(workspaceDir?: string | null): Promise<FileNode[]> {
  const query = workspaceDir ? `?workspaceDir=${encodeURIComponent(workspaceDir)}` : '';
  const res = await authFetch(`${API_BASE}/workspace-tree${query}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_workspace_context(workspaceDir?: string | null): Promise<{ loaded: boolean; filePath: string | null; filename: string | null; content: string | null }> {
  const query = workspaceDir ? `?workspaceDir=${encodeURIComponent(workspaceDir)}` : '';
  const res = await authFetch(`${API_BASE}/workspace-context${query}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function read_file_raw(path: string): Promise<string> {
  const res = await authFetch(`${API_BASE}/read-file-raw?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content;
}

export async function send_message(sessionId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function cancel_agent(sessionId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/cancel-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function respond_to_tool(sessionId: string, toolCallId: string, approve: boolean | string): Promise<void> {
  const res = await authFetch(`${API_BASE}/respond-to-tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, toolCallId, approve }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function transcribe_audio(audioBase64: string, apiKey: string): Promise<string> {
  const res = await authFetch(`${API_BASE}/transcribe-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, apiKey }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.text;
}


export async function get_llama_releases(): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/llama-releases`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_installed_llama_versions(): Promise<{ tag: string; exePath: string; isCurrent: boolean }[]> {
  const res = await authFetch(`${API_BASE}/installed-llama-versions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function install_llama_version(tag: string, downloadUrl?: string, assetName?: string, autoCleanup?: boolean): Promise<{ exePath: string; message: string }> {
  const res = await authFetch(`${API_BASE}/install-llama-version`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, downloadUrl, assetName, autoCleanup }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function select_installed_llama(exePath: string): Promise<{ exePath: string; message: string }> {
  const res = await authFetch(`${API_BASE}/select-installed-llama`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exePath }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function delete_installed_llama(tag: string, exePath: string): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/delete-installed-llama`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, exePath }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function cleanup_old_llama_versions(keepTag?: string): Promise<{ success: boolean; removedCount: number; message: string }> {
  const res = await authFetch(`${API_BASE}/cleanup-old-llama`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepTag }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


export async function parse_gguf(filePath: string): Promise<GgufMetadata> {
  const res = await authFetch(`${API_BASE}/parse-gguf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function scan_models_dir(dirPath?: string): Promise<{ dirPath: string; models: GgufMetadata[] }> {
  const query = dirPath ? `?dirPath=${encodeURIComponent(dirPath)}` : '';
  const res = await authFetch(`${API_BASE}/scan-models-dir${query}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function detect_hardware(): Promise<HardwareInfo> {
  const res = await authFetch(`${API_BASE}/detect-hardware`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_server_health(host: string, port: number): Promise<{ ok: boolean; status: string }> {
  const res = await authFetch(`${API_BASE}/server-health?host=${encodeURIComponent(host)}&port=${port}`);
  if (!res.ok) return { ok: false, status: 'stopped' };
  return res.json();
}

export async function get_server_slots(host: string, port: number): Promise<{ ok: boolean; totalSlots: number; activeSlots: number }> {
  const res = await authFetch(`${API_BASE}/server-slots?host=${encodeURIComponent(host)}&port=${port}`);
  if (!res.ok) return { ok: false, totalSlots: 0, activeSlots: 0 };
  return res.json();
}

export async function get_memories(query?: string): Promise<MemoryItem[]> {
  const q = query ? `?query=${encodeURIComponent(query)}` : '';
  const res = await authFetch(`${API_BASE}/memories${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function add_memory(key: string, value: string, category?: string): Promise<MemoryItem> {
  const res = await authFetch(`${API_BASE}/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, category }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function delete_memory(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/memories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function get_skills(): Promise<SkillInfo[]> {
  const res = await authFetch(`${API_BASE}/skills`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_skill_content(name: string): Promise<string> {
  const res = await authFetch(`${API_BASE}/skills/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content;
}

export async function save_skill(name: string, content: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/skills/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function delete_skill(name: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/skills/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function start_local_server(params?: any): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/start-local-server`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function stop_local_server(): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/stop-local-server`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_server_status(): Promise<ServerStatusInfo> {
  const res = await authFetch(`${API_BASE}/server-status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_personas(): Promise<PersonaMetadata[]> {
  const res = await authFetch(`${API_BASE}/personas`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_persona_detail(id: string): Promise<PersonaDetail> {
  const res = await authFetch(`${API_BASE}/personas/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function create_persona(name: string, description?: string, icon?: string): Promise<PersonaDetail> {
  const res = await authFetch(`${API_BASE}/personas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, icon }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function activate_persona(id: string): Promise<PersonaMetadata[]> {
  const res = await authFetch(`${API_BASE}/personas/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function save_persona_file(id: string, filename: 'SOUL.md' | 'TOOLS.md' | 'USER.md', content: string): Promise<PersonaDetail> {
  const res = await authFetch(`${API_BASE}/personas/${encodeURIComponent(id)}/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function delete_persona(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/personas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function get_summarizer_prompt(): Promise<string> {
  const res = await authFetch(`${API_BASE}/summarizer-prompt`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content;
}

export async function save_summarizer_prompt(content: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/summarizer-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(await res.text());
}



