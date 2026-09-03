import { getStoredToken } from '../wsService';

export const API_BASE = '/api';

export async function request<T>(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const { timeoutMs = 60000, signal: callerSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (callerSignal) {
    callerSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error) throw new Error(parsed.error);
      } catch (e: any) {
        if (e.message && e.message !== errText && !e.message.startsWith('Unexpected token')) throw e;
      }
      throw new Error(errText);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as unknown as T);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const get = <T>(endpoint: string) => request<T>(endpoint);
export const post = <T>(endpoint: string, body?: any) =>
  request<T>(endpoint, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
export const put = <T>(endpoint: string, body?: any) =>
  request<T>(endpoint, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
export const del = <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' });
