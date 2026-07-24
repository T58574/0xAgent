import { AppConfig, ChatSession, FileNode } from '../types';

const API_BASE = '/api';

// WebSocket connection for real-time events
type EventCallback = (eventData: { payload: any }) => void;
const eventListeners = new Map<string, Set<EventCallback>>();
let ws: WebSocket | null = null;
let reconnectTimer: any = null;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = '3001'; // Default local server port
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

// Start WebSocket connection
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

// API functions
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
