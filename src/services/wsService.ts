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
  const host = window.location.host;
  const token = getStoredToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${protocol}//${host}/ws${query}`;
}

export function reconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  initWebSocket();
}

export function initWebSocket() {
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

export function listen<T = any>(event: string, callback: (eventData: { payload: T }) => void): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  const listeners = eventListeners.get(event)!;
  listeners.add(callback as EventCallback);

  return () => {
    listeners.delete(callback as EventCallback);
  };
}

initWebSocket();
