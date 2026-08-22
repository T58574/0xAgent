

export interface ThemeColors {
  bg_color?: string;
  text_color?: string;
  border_color?: string;
  active_color?: string;
  send_btn_color?: string;
}

export interface PromptFileInfo {
  filename: string;
  title: string;
  is_active: boolean;
  updated_at: number;
}

export type ReasoningEffortLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'auto';

export interface LocalServerConfig {
  exe_path?: string | null;
  model_path?: string | null;
  mmproj_path?: string | null;
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
  parallel_slots?: number | null;
  cache_reuse?: number | null;
  slot_save_path?: string | null;
  custom_args?: string | null;
  reasoning_effort?: ReasoningEffortLevel | null;
  spec_draft_model?: string | null;
  spec_type?: string | null;
  spec_draft_ngl?: number | string | null;
  spec_draft_n_max?: number | null;
  spec_draft_p_min?: number | null;
  reasoning_budget?: number | null;
  jinja?: boolean | null;
  reasoning_preserve?: boolean | null;
  reasoning_format?: string | null;
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

export type AppTheme =
  | 'obsidian'
  | 'light'
  | 'cyber'
  | 'graphite'
  | 'matrix'
  | 'saffron_apricot'
  | 'butter_cream'
  | 'cloud_dancer'
  | 'mint_glacier'
  | 'sicilian_tomato'
  | 'sky_industrial'
  | 'terracotta_dust';

export type AppLanguage = 'en' | 'ru';

export interface AppConfig {
  api_url: string;
  model_name: string;
  system_prompt: string;
  active_prompt_file?: string | null;
  active_persona_id?: string | null;
  workspace_dir?: string | null;
  language?: AppLanguage | null;
  groq_api_key?: string | null;
  gemini_api_key?: string | null;
  active_theme?: AppTheme | string | null;
  theme_colors?: ThemeColors | null;
  models_path?: string | null;
  reasoning_enabled?: boolean | null;
  reasoning_effort?: ReasoningEffortLevel | null;
  planning_mode?: boolean | null;
  temperature?: number | null;
  max_tokens?: number | null;
  api_timeout_sec?: number | null;
  auto_save_history?: boolean | null;
  sound_notifications?: boolean | null;
  compact_chat?: boolean | null;
  local_server?: LocalServerConfig | null;
  fallback_models?: string[] | null;
  jarvis_model?: string | null;
  tts_config?: TtsConfig | null;
  proactive_companion_enabled?: boolean | null;
  permission_preset?: PermissionPreset | null;
}

export type PermissionPreset = 'readonly' | 'workspace-write' | 'prompt' | 'unrestricted';

export interface TtsConfig {
  enabled: boolean;
  voice: 'ru-RU-SvetlanaNeural' | 'ru-RU-DmitryNeural' | string;
  rate: string; // e.g. "+20%", "+0%"
  pitch: string; // e.g. "+0Hz", "-5Hz"
  volume?: number; // 0-100
  play_on_speaker?: boolean;
  play_in_browser?: boolean;
  wake_word_enabled?: boolean;
}

export interface JarvisSparkProposal {
  id: string;
  title: string;
  category: 'feature_spark' | 'code_polish' | 'exploration' | 'friendly_checkin' | 'error_incident';
  description: string;
  suggestedAction?: string;
  targetFiles?: string[];
  contextSnippet?: string;
  errorTrace?: string;
  directivePrompt?: string;
  previewDiff?: string;
  voicePhrase?: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'dismissed';
}

export interface CloudModelItem {
  id: string;
  name: string;
  badge: 'Medium' | 'Fast' | 'Ultra Fast' | string;
  speed: string;
  provider: string;
  isAudio?: boolean;
}

export interface LocalModelItem {
  id: string;
  fileName: string;
  filePath: string;
  title: string;
  quantization: string;
  sizeGB: string;
  formattedName: string;
  isMmproj?: boolean;
  isDraft?: boolean;
  isFastMtp?: boolean;
  contextLength?: number;
  supportsReasoning?: boolean;
  recommendedReasoningEffort?: ReasoningEffortLevel;
  family?: string;
}

export interface AvailableModelsResponse {
  cloud: CloudModelItem[];
  local: LocalModelItem[];
  activeModelId: string;
}



export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string; // JSON string from Rust backend
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'error';
  output?: string | null;
  result?: string | null;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'files' | 'terminal' | 'memory' | 'skills' | 'sessions' | 'agents' | 'interactive' | 'web';
  requiresApproval: boolean;
  enabled: boolean;
  xmlSpec: string;
}

export interface ToolsState {
  tools: ToolDefinition[];
  content: string;
}

export interface MessageMetrics {
  tokensPerSec?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokenCount?: number;
  totalTokens?: number;
  contextUsed?: number;
  contextMax?: number;
  evalDurationMs?: number;
  ttftMs?: number;
  vramUsedMB?: number;
  vramTotalMB?: number;
  promptCacheHit?: boolean;
  modelName?: string;
}

export interface LiveTelemetry {
  messageId?: string;
  tokensPerSec?: number;
  tokenCount?: number;
  contextUsed?: number;
  contextMax?: number;
  ttftMs?: number;
  vramUsedMB?: number;
  vramTotalMB?: number;
  promptCacheHit?: boolean;
  modelName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  images?: string[] | null;
  tool_calls?: ToolCallInfo[] | null;
  metrics?: MessageMetrics | null;
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ChatSession {
  id: string;
  title: string;
  workspace_dir?: string | null;
  active_todos?: TodoItem[];
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
  isDraft?: boolean;
  isFastMtp?: boolean;
  supportsFastMtp?: boolean;
  rawKv?: Record<string, any>;
  cleanTitle?: string;
  sizeGB?: string;
  formattedName?: string;
  supportsReasoning?: boolean;
  recommendedReasoningEffort?: ReasoningEffortLevel;
  supportedReasoningLevels?: ReasoningEffortLevel[];
  family?: 'qwen' | 'gemma' | 'deepseek' | 'phi' | 'llama' | 'mistral' | 'unknown';
}

export interface HardwareInfo {
  vendor: 'NVIDIA' | 'AMD' | 'Intel' | 'Apple' | 'CPU';
  gpuName: string;
  recommendedBuild: string;
  recommendedAssetKeywords: string[];
  isAutoDetected: boolean;
  vramMB?: number;
  ramGB?: number;
  cpuCores?: number;
}

export interface ServerStatusInfo {
  running: boolean;
  pid?: number | null;
  exePath?: string | null;
  modelPath?: string | null;
  modelName?: string | null;
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

export type KnowledgeCategory = 'strategy' | 'architecture' | 'research' | 'user_directive' | 'market_insight' | 'general';

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: KnowledgeCategory | string;
  content: string;
  summary: string;
  tags: string[];
  source?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeQueryOptions {
  query?: string;
  category?: string;
  tag?: string;
  startDate?: number;
  endDate?: number;
}

export interface JarvisActivityLog {
  id: string;
  timestamp: number;
  agent: 'Jarvis Supervisor' | 'Local Agent' | 'System';
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface JarvisWorkerStatus {
  id: string;
  name: string;
  type: 'supervisor' | 'local_agent' | 'indexer' | 'subagent';
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'error';
  currentTask?: string;
  progressPercent?: number;
  updatedAt: number;
}

export interface JarvisState {
  isActive: boolean;
  supervisorStatus: 'active' | 'idle' | 'analyzing' | 'error';
  activeWorkers: JarvisWorkerStatus[];
  recentActivities: JarvisActivityLog[];
  activeSparks?: JarvisSparkProposal[];
  isSpeaking?: boolean;
  updatedAt: number;
}

export interface AskUserQuestionOption {
  label: string;
  description?: string;
}

export type AskUserQuestionIntent = {
  kind: 'plan-review';
  approve: string;
};

export interface AskUserQuestionItem {
  id: string;
  question: string;
  detail?: string;
  header?: string;
  options?: AskUserQuestionOption[];
  multiSelect?: boolean;
  intent?: AskUserQuestionIntent;
}

export interface AskUserQuestionAnswerItem {
  id: string;
  selected: string[];
  custom?: string;
}

export interface AskUserQuestionRequest {
  sessionId: string;
  toolCallId: string;
  questions: AskUserQuestionItem[];
}

export interface AskUserQuestionAnswer {
  answers: AskUserQuestionAnswerItem[];
}

export interface CodeRunResult {
  success: boolean;
  value?: any;
  logs: string[];
  error?: string;
  executionTimeMs: number;
}

export interface SessionEvent {
  id: string;
  type: string;
  timestamp: number;
  payload: any;
}

export interface TokenBreakdownDetailItem {
  id: string;
  name: string;
  tokens: number;
  description?: string;
  scope?: 'Global' | 'Workspace';
  enabled?: boolean;
  preview?: string;
}

export interface TokenBreakdownItem {
  id: string;
  name: string;
  category: 'tools' | 'persona' | 'user_profile' | 'environment' | 'planning' | 'workspace_rules' | 'skills' | 'memory' | 'chat_history';
  tokens: number;
  percentage: number;
  shareOfUsed: number;
  color: string;
  description?: string;
  scope?: 'Global' | 'Workspace';
  contentPreview?: string;
  details?: TokenBreakdownDetailItem[];
}

export interface ContextBreakdownReport {
  totalBudget: number;
  totalUsed: number;
  availableTokens: number;
  availablePercentage: number;
  usedPercentage: number;
  systemPromptTokens: number;
  chatMessagesTokens: number;
  categories: TokenBreakdownItem[];
  modelName: string;
  sessionId?: string | null;
}

export interface StagedFileChange {
  path: string;
  originalContent?: string;
  newContent?: string;
  patch?: string;
  changeType: 'created' | 'modified' | 'deleted';
}

export interface StagedProposal {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  status: 'pending' | 'verified' | 'failed' | 'applied' | 'rejected';
  files: StagedFileChange[];
  createdAt: number;
  updatedAt: number;
  verificationResult?: {
    passed: boolean;
    typecheckOutput?: string;
    testsOutput?: string;
    durationMs?: number;
  };
}
