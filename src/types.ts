export interface ThemeColors {
  bg_color: string;
  text_color: string;
  border_color: string;
  active_color: string;
  send_btn_color: string;
}

export interface LocalServerConfig {
  exe_path?: string | null;
  model_path?: string | null;
  host?: string | null;
  port?: number | null;
  ctx_size?: number | null;
  threads?: number | null;
  gpu_layers?: number | null;
  temp?: number | null;
  predict?: number | null;
  batch_size?: number | null;
  ubatch_size?: number | null;
  min_p?: number | null;
  top_k?: number | null;
  top_p?: number | null;
  repeat_penalty?: number | null;
  seed?: number | null;
  presence_penalty?: number | null;
  frequency_penalty?: number | null;
  flash_attn?: boolean | null;
  embedding?: boolean | null;
  cont_batching?: boolean | null;
  prompt_cache?: boolean | null;
  mlock?: boolean | null;
  mmap?: boolean | null;
  custom_args?: string | null;
}

export interface PromptFileInfo {
  filename: string;
  title: string;
  is_active: boolean;
  updated_at: number;
}

export interface PersonaMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  user_id: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface PersonaDetail {
  metadata: PersonaMetadata;
  soul: string;
  tools: string;
  user: string;
}

export interface AppConfig {
  api_url: string;
  model_name: string;
  system_prompt: string;
  active_prompt_file?: string | null;
  active_persona_id?: string | null;
  workspace_dir?: string | null;
  groq_api_key?: string | null;
  active_theme?: 'obsidian' | 'cyber' | 'graphite' | 'matrix' | string | null;
  theme_colors?: ThemeColors | null;
  models_path?: string | null;
  reasoning_enabled?: boolean | null;
  planning_mode?: boolean | null;
  temperature?: number | null;
  max_tokens?: number | null;
  api_timeout_sec?: number | null;
  auto_save_history?: boolean | null;
  sound_notifications?: boolean | null;
  compact_chat?: boolean | null;
  local_server?: LocalServerConfig | null;
}


export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string; // JSON string from Rust backend
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'error';
  output?: string | null;
}

export interface MessageMetrics {
  tokensPerSec?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  contextUsed?: number;
  contextMax?: number;
  evalDurationMs?: number;
  modelName?: string;
}

export interface LiveTelemetry {
  messageId?: string;
  tokensPerSec?: number;
  tokenCount?: number;
  contextUsed?: number;
  contextMax?: number;
  modelName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  tool_calls?: ToolCallInfo[] | null;
  metrics?: MessageMetrics | null;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

export interface GgufMetadata {
  filePath: string;
  fileName: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  magicValid: boolean;
  version: number;
  architecture: string;
  modelName: string;
  quantization: string;
  blockCount: number;
  contextLength: number;
  expertCount: number;
  isMmproj: boolean;
  rawKv?: Record<string, any>;
}

export interface HardwareInfo {
  vendor: 'NVIDIA' | 'AMD' | 'Intel' | 'Apple' | 'CPU';
  gpuName: string;
  recommendedBuild: string;
  recommendedAssetKeywords: string[];
  isAutoDetected: boolean;
}

export interface ServerStatusInfo {
  running: boolean;
  pid?: number | null;
  exePath?: string | null;
  modelPath?: string | null;
  host: string;
  port: number;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'user_preference' | 'project_convention' | 'architecture' | 'fact' | 'general';
  createdAt: number;
  updatedAt: number;
}

export interface SkillInfo {
  name: string;
  filename: string;
  title: string;
  description: string;
  updatedAt: number;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[] | null;
}
