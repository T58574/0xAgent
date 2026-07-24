import { AppConfig, ChatSession, FileNode } from '../types';

const API_BASE = '/api';

type EventCallback = (eventData: { payload: any }) => void;
const eventListeners = new Map<string, Set<EventCallback>>();
let ws: WebSocket | null = null;
let reconnectTimer: any = null;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = '3001';
  return `${protocol}//${host}:${port}/ws`;
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

export async function listen<T>(event: string, callback: (eventData: { payload: T }) => void): Promise<() => void> {
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
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function save_config(config: AppConfig): Promise<void> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function list_sessions(): Promise<ChatSession[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function load_session(id: string): Promise<ChatSession> {
  const res = await fetch(`${API_BASE}/sessions/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function save_session(session: ChatSession): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${session.id}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function create_session(title: string): Promise<ChatSession> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function delete_session(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function select_workspace(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/select-workspace`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.folder;
}

export async function select_file_native(filter?: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/select-file`, {
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
  const res = await fetch(`${API_BASE}/workspace-tree${query}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function read_file_raw(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}/read-file-raw?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content;
}

export async function send_message(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function cancel_agent(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cancel-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function respond_to_tool(sessionId: string, toolCallId: string, approve: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/respond-to-tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, toolCallId, approve }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function transcribe_audio(audioBase64: string, apiKey: string): Promise<string> {
  const res = await fetch(`${API_BASE}/transcribe-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, apiKey }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.text;
}

export async function get_local_ips(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/get-local-ips`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.urls;
}

export async function get_llama_releases(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/llama-releases`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_installed_llama_versions(): Promise<{ tag: string; exePath: string; isCurrent: boolean }[]> {
  const res = await fetch(`${API_BASE}/installed-llama-versions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function install_llama_version(tag: string, downloadUrl?: string, assetName?: string): Promise<{ exePath: string; message: string }> {
  const res = await fetch(`${API_BASE}/install-llama-version`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, downloadUrl, assetName }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function select_installed_llama(exePath: string): Promise<{ exePath: string; message: string }> {
  const res = await fetch(`${API_BASE}/select-installed-llama`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exePath }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get_gguf_models(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/gguf-models`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function download_gguf_model(downloadUrl: string, fileName: string): Promise<{ modelPath: string }> {
  const res = await fetch(`${API_BASE}/download-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ downloadUrl, fileName }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

