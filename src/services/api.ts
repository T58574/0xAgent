import {
  AppConfig,
  GgufMetadata,
  MemoryItem,
  SkillInfo,
  PersonaMetadata,
  PersonaDetail,
  ToolsState,
  AvailableModelsResponse,
  KnowledgeEntry,
  KnowledgeQueryOptions,
  JarvisState,
  StagedProposal,
  SearchEngineInfo,
  WebSearchProvider,
  SystemPromptItem,
  SystemVersionInfo,
  UpdateCheckResult,
  UpdateApplyResult,
  ProxyItem,
  ProxyProtocol,
  ProxyHealthCheckResult,
  ProxyExportConfig,
  ProxyRoutingConfig,
} from '../types';

import { getStoredToken, setStoredToken, clearStoredToken, reconnectWebSocket, listen } from './wsService';

export { getStoredToken, setStoredToken, clearStoredToken, reconnectWebSocket, listen };

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
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

const get = <T>(endpoint: string) => request<T>(endpoint);
const post = <T>(endpoint: string, body?: any) =>
  request<T>(endpoint, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
const put = <T>(endpoint: string, body?: any) =>
  request<T>(endpoint, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
const del = <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' });

// Auth
export async function get_auth_status(): Promise<{
  isPasswordSet: boolean;
  isAuthenticated: boolean;
  locked?: boolean;
  remainingSec?: number;
}> {
  return get('/auth/status');
}

export async function setup_password(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const data = await post<{ success: boolean; token?: string; error?: string }>('/auth/setup', { password });
  if (data.token) setStoredToken(data.token);
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
  const data = await post<any>('/auth/login', { password });
  if (data.token) setStoredToken(data.token);
  return data;
}

export async function change_password(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const data = await post<any>('/auth/change-password', { currentPassword, newPassword });
  if (data.token) setStoredToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await post('/auth/logout');
  } catch {}
  clearStoredToken();
}

// Config
export const get_config = () => get<AppConfig>('/config');
export const save_config = (config: AppConfig) => post<void>('/config', config);

// Re-export Chat, Session & Workspace API from modular domain
export * from './api/chat';


// Llama Releases & Installation
export const get_llama_releases = () => get<any[]>('/llama-releases');
export const get_installed_llama_versions = () =>
  get<{ tag: string; exePath: string; isCurrent: boolean }[]>('/installed-llama-versions');
export const install_llama_version = (tag: string, downloadUrl?: string, assetName?: string, autoCleanup?: boolean) =>
  post<{ exePath: string; message: string }>('/install-llama-version', { tag, downloadUrl, assetName, autoCleanup });
export const select_installed_llama = (exePath: string) =>
  post<{ exePath: string; message: string }>('/select-installed-llama', { exePath });
export const delete_installed_llama = (tag: string, exePath: string) =>
  post<{ success: boolean; message: string }>('/delete-installed-llama', { tag, exePath });
export const cleanup_old_llama_versions = (keepTag?: string) =>
  post<{ success: boolean; removedCount: number; message: string }>('/cleanup-old-llama', { keepTag });

// Models & Hardware
export const parse_gguf = (filePath: string) => post<GgufMetadata>('/parse-gguf', { filePath });
export const scan_models_dir = (dirPath?: string) =>
  get<{ dirPath: string; models: GgufMetadata[] }>(dirPath ? `/scan-models-dir?dirPath=${encodeURIComponent(dirPath)}` : '/scan-models-dir');
export const get_available_models = () => get<AvailableModelsResponse>('/models');
export const set_active_model = (modelId: string) =>
  post<{ success: boolean; activeModelId: string }>('/models/active', { modelId });

// Re-export Telemetry, Hardware & Server Health API from modular domain
export * from './api/telemetry';


// Re-export Veronica & Remote Node API from modular domain
export * from './api/veronica';


// Memories & Skills
export const get_memories = (query?: string) =>
  get<MemoryItem[]>(query ? `/memories?query=${encodeURIComponent(query)}` : '/memories');
export const add_memory = (key: string, value: string, category?: string, scope?: string) =>
  post<MemoryItem>('/memories', { key, value, category, scope });
export const update_memory = (id: string, updates: { key?: string; value?: string; category?: string; scope?: string }) =>
  put<MemoryItem>(`/memories/${encodeURIComponent(id)}`, updates);
export const delete_memory = (id: string) => del<void>(`/memories/${encodeURIComponent(id)}`);

export const get_skills = () => get<SkillInfo[]>('/skills');
export async function get_skill_content(name: string): Promise<string> {
  const data = await get<{ content: string }>(`/skills/${encodeURIComponent(name)}`);
  return data.content;
}
export const save_skill = (name: string, content: string) =>
  post<void>(`/skills/${encodeURIComponent(name)}`, { content });
export const delete_skill = (name: string) => del<void>(`/skills/${encodeURIComponent(name)}`);

// Personas & Prompts
export const get_personas = () => get<PersonaMetadata[]>('/personas');
export const get_persona_detail = (id: string) => get<PersonaDetail>(`/personas/${encodeURIComponent(id)}`);
export const create_persona = (name: string, description?: string, icon?: string) =>
  post<PersonaDetail>('/personas', { name, description, icon });
export const activate_persona = (id: string) => post<PersonaMetadata[]>(`/personas/${encodeURIComponent(id)}/activate`);
export const save_persona_file = (id: string, filename: 'SOUL.md' | 'TOOLS.md' | 'USER.md', content: string) =>
  post<PersonaDetail>(`/personas/${encodeURIComponent(id)}/file`, { filename, content });
export const delete_persona = (id: string) => del<void>(`/personas/${encodeURIComponent(id)}`);

// Persona Proposals & Evolution Pipeline
export const get_persona_proposals = (id: string, status?: string) =>
  get<any[]>(status ? `/personas/${encodeURIComponent(id)}/proposals?status=${encodeURIComponent(status)}` : `/personas/${encodeURIComponent(id)}/proposals`);
export const approve_persona_proposal = (id: string, proposalId: string) =>
  post<any>(`/personas/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/approve`, {});
export const reject_persona_proposal = (id: string, proposalId: string, reason?: string) =>
  post<any>(`/personas/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/reject`, { reason });
export const apply_persona_proposal = (id: string, proposalId: string, forceOverride?: boolean) =>
  post<any>(`/personas/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/apply`, { forceOverride });
export const get_persona_history = (id: string, file?: string) =>
  get<any[]>(file ? `/personas/${encodeURIComponent(id)}/history?file=${encodeURIComponent(file)}` : `/personas/${encodeURIComponent(id)}/history`);
export const rollback_persona_file = (id: string, file: string, version_id: string) =>
  post<any>(`/personas/${encodeURIComponent(id)}/rollback`, { file, version_id });
export const get_system_prompts = () => get<SystemPromptItem[]>('/system-prompts');

export async function get_summarizer_prompt(): Promise<string> {
  const data = await get<{ content: string }>('/summarizer-prompt');
  return data.content;
}
export const save_summarizer_prompt = (content: string) => post<void>('/summarizer-prompt', { content });

// Tools State
export const get_tools_state = () => get<ToolsState>('/tools');
export const save_tools_toggles = (toggles: Record<string, boolean>) => post<ToolsState>('/tools/toggles', { toggles });
export const save_tools_md = (content: string) => post<ToolsState>('/tools/md', { content });

// Web Search Engines & Testing
export const get_search_engines = () =>
  get<{ engines: SearchEngineInfo[]; activeProvider: WebSearchProvider }>('/search-engines');

export const test_web_search = (params: {
  query: string;
  provider?: WebSearchProvider;
  firecrawl_api_key?: string | null;
  firecrawl_api_url?: string | null;
  searxng_url?: string | null;
}) =>
  post<{
    results: Array<{ title: string; url: string; snippet: string; engine?: string }>;
    engineUsed: string;
    latencyMs: number;
    error?: string;
    cascadeTrail?: string[];
  }>('/web-search/test', params);

// Knowledge Base
export async function get_knowledge_entries(options?: KnowledgeQueryOptions): Promise<KnowledgeEntry[]> {
  const params = new URLSearchParams();
  if (options?.query) params.append('query', options.query);
  if (options?.category) params.append('category', options.category);
  if (options?.tag) params.append('tag', options.tag);
  if (options?.startDate) params.append('startDate', String(options.startDate));
  if (options?.endDate) params.append('endDate', String(options.endDate));
  const qs = params.toString();
  return get<KnowledgeEntry[]>(`/knowledge${qs ? `?${qs}` : ''}`);
}
export const get_knowledge_categories = () => get<{ category: string; count: number }[]>('/knowledge/categories');
export const save_knowledge_entry = (entry: {
  title: string;
  category: string;
  content: string;
  summary?: string;
  tags?: string[];
  source?: string;
  id?: string;
}) => post<KnowledgeEntry>('/knowledge', entry);
export const delete_knowledge_entry = (id: string) => del<void>(`/knowledge/${encodeURIComponent(id)}`);

// Jarvis & Voice
export const get_jarvis_workspace = () => get<{ workspaceDir: string }>('/jarvis/workspace');
export const get_jarvis_state = () => get<JarvisState>('/jarvis/status');
export const speak_text = (
  text: string,
  options?: { voice?: string; rate?: string; pitch?: string; playOnSpeaker?: boolean; category?: string }
) => post<{ success: boolean; audioBase64?: string; cached: boolean }>('/jarvis/speak', { text, ...options });
export const speak_category = (category: string) =>
  post<{ success: boolean; phrase: string | null }>('/jarvis/speak-category', { category });
export const stop_voice = () => post<void>('/jarvis/stop-voice');
export const generate_spark = () => post<{ success: boolean; spark: any }>('/jarvis/spark/generate');
export const accept_spark = (id: string) => post<{ success: boolean; spark: any }>(`/jarvis/spark/${encodeURIComponent(id)}/accept`);
export const dismiss_spark = (id: string) => post<void>(`/jarvis/spark/${encodeURIComponent(id)}/dismiss`);
export const get_voice_daemon_status = () => get<{ running: boolean }>('/jarvis/voice-daemon/status');
export const toggle_voice_daemon = (enable: boolean) =>
  post<{ success: boolean; running: boolean }>('/jarvis/voice-daemon/toggle', { enable });
export const toggle_voice_daemon_recording = () => post<{ success: boolean }>('/jarvis/voice-record/toggle');
export const start_voice_daemon_recording = () => post<{ success: boolean; state: string }>('/jarvis/voice-record/start');
export const stop_voice_daemon_recording = () => post<{ success: boolean; state: string }>('/jarvis/voice-record/stop');
export const send_voice_input = (audioBase64: string, mimeType?: string) =>
  post<{ success: boolean; text: string; macro?: string }>('/jarvis/voice-input', { audioBase64, mimeType });


// Self-Improvement & Pull Request Proposals API
export const list_proposals = (sessionId?: string) =>
  get<{ proposals: StagedProposal[] }>(sessionId ? `/staging/proposals?sessionId=${encodeURIComponent(sessionId)}` : '/staging/proposals');
export const get_proposal = (id: string) =>
  get<{ proposal: StagedProposal }>(`/staging/proposals/${encodeURIComponent(id)}`);
export const create_proposal = (params: { sessionId: string; title: string; description?: string; changes: any[]; workspaceDir?: string }) =>
  post<{ success: boolean; proposal: StagedProposal }>('/staging/proposals', params);
export const verify_proposal = (id: string, workspaceDir?: string) =>
  post<{ success: boolean; proposal: StagedProposal }>(`/staging/proposals/${encodeURIComponent(id)}/verify`, { workspaceDir });
export const apply_proposal = (id: string, workspaceDir?: string) =>
  post<{ success: boolean; appliedFiles: string[]; message: string }>(`/staging/proposals/${encodeURIComponent(id)}/apply`, { workspaceDir });

// System Version & Updates API
export const get_system_version = () => get<SystemVersionInfo>('/system/version');
export const check_for_updates = (force = false) => get<UpdateCheckResult>(`/system/check-update${force ? '?force=true' : ''}`);
export const apply_system_update = () => post<UpdateApplyResult>('/system/apply-update');

// 0xProxy API
export const list_proxies = (params?: { active?: boolean; status?: string; protocol?: string; tag?: string }) => {
  const query = new URLSearchParams();
  if (params?.active !== undefined) query.set('active', String(params.active));
  if (params?.status) query.set('status', params.status);
  if (params?.protocol) query.set('protocol', params.protocol);
  if (params?.tag) query.set('tag', params.tag);
  const qStr = query.toString();
  return get<{ proxies: ProxyItem[]; count: number }>(`/proxies${qStr ? `?${qStr}` : ''}`);
};

export const add_proxies = (input: string, protocol?: ProxyProtocol, expiresAt?: number | null) =>
  post<{ added: number; proxies: ProxyItem[]; errors: string[] }>('/proxies', { input, protocol, expiresAt });

export const check_proxies = (id?: string) =>
  post<{ checked: number; results: ProxyHealthCheckResult[] } | ProxyHealthCheckResult>('/proxies/check', { id });

export const toggle_proxy = (id: string, isActive: boolean) =>
  put<ProxyItem>(`/proxies/${encodeURIComponent(id)}/toggle`, { isActive });

export const delete_proxy = (id: string) =>
  del<{ success: boolean; id: string }>(`/proxies/${encodeURIComponent(id)}`);

export const export_proxies = () =>
  get<ProxyExportConfig>('/proxies/export');

export const get_proxy_routing = () =>
  get<{ routing: ProxyRoutingConfig; bestProxy: ProxyItem | null }>('/proxies/routing');

export const update_proxy_routing = (config: Partial<ProxyRoutingConfig>) =>
  post<{ routing: ProxyRoutingConfig; bestProxy: ProxyItem | null }>('/proxies/routing', config);


