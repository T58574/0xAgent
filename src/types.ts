

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
  user_id?: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  active_version_id?: string;
  compiled_sha256?: string;
}

export type PersonaFile =
  | 'SOUL.md'
  | 'TOOLS.md'
  | 'USER.md'
  | 'USER_PINNED.md'
  | 'CORE.md';

export interface PersonaDetail {
  metadata: PersonaMetadata;
  soul: string;
  tools: string;
  user: string;
  pinnedUser?: string;
  core?: string;
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

export type WebSearchProvider = 'auto' | 'firecrawl' | 'searxng' | 'duckduckgo' | 'wikipedia' | string;

export interface SearchEngineInfo {
  id: WebSearchProvider;
  name: string;
  description: string;
  requiresKey: boolean;
  defaultUrl?: string;
  isConfigured: boolean;
  isAvailable: boolean;
}

export interface SystemPromptItem {
  id: string;
  name: string;
  title: string;
  description: string;
  content: string;
  editable?: boolean;
}

export type ActiveView = 'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge' | 'veronica';

export interface RemoteNodeConfig {
  enabled?: boolean;
  host: string;
  port: number;
  auto_probe?: boolean;
}

export interface VeronicaConfig {
  enabled?: boolean;
  telegram_token?: string | null;
  telegram_whitelist?: number[] | null;
  antigravity_cli_path?: string | null;
  default_autonomy_level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  watchdog_interval_sec?: number;
  default_heartbeat_timeout_sec?: number;
  model?: string | null;
  effort?: 'low' | 'medium' | 'high' | 'auto' | null;
  agent?: string | null;
  print_timeout?: string | null;
}

export interface VeronicaModelInfo {
  slug: string;
  name: string;
  description?: string;
  effort?: string;
}

export interface VeronicaAgentInfo {
  slug: string;
  name: string;
  description?: string;
}

export interface VeronicaStreamEvent {
  taskId: string;
  type: 'stdout' | 'stderr' | 'status' | 'heartbeat' | 'end' | 'open' | 'error';
  chunk?: string;
  status?: string;
  timestamp: number;
  summary?: string;
  metadata?: any;
}

export interface VeronicaModuleStatus {
  enabled: boolean;
  db_healthy: boolean;
  active_tasks: number;
  queued_tasks: number;
  today_completed: number;
  today_failed: number;
  telegram_connected: boolean;
  remote_gpu_online: boolean;
}

export interface AppConfig {
  api_url: string;
  model_name: string;
  system_prompt: string;
  active_prompt_file?: string | null;
  active_persona_id?: string | null;
  workspace_dir?: string | null;
  language?: AppLanguage | null;
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
  remote_node?: RemoteNodeConfig | null;
  veronica?: VeronicaConfig | null;
  fallback_models?: string[] | null;
  jarvis_model?: string | null;
  tts_config?: TtsConfig | null;
  proactive_companion_enabled?: boolean | null;
  permission_preset?: PermissionPreset | null;
  web_search_provider?: WebSearchProvider | null;
  firecrawl_api_key?: string | null;
  firecrawl_api_url?: string | null;
  searxng_url?: string | null;
  groq_api_key?: string | null;
  tool_toggles?: Record<string, boolean> | null;
}

export type PermissionPreset = 'prompt' | 'unrestricted';

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
  badge?: 'Medium' | 'Fast' | 'Ultra Fast' | string;
  speed?: string;
  provider: string;
  isAudio?: boolean;
  supportedEfforts?: ('low' | 'medium' | 'high')[];
  defaultEffort?: 'low' | 'medium' | 'high';
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
  contextBreakdown?: ContextBreakdown;
}

export interface ContextBreakdown {
  systemTokens?: number;
  historyTokens?: number;
  memoryTokens?: number;
  toolsTokens?: number;
  freeTokens?: number;
  compactionTier?: number; // 0 (Raw), 1 (Pruned), 2 (Summarized), 3 (Emergency)
}

export type QuickReplyActionType = 'send_prompt' | 'insert_prompt' | 'open_diff' | 'explain';

export interface QuickReplyItem {
  id: string;
  label: string;
  prompt: string;
  action_type?: QuickReplyActionType;
  key?: string;
}

export interface QuickResponseOption {
  id?: string;
  key?: string;
  label: string;
  action: string;
  prompt?: string;
  action_type?: QuickReplyActionType;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type DestructiveActionType =
  | 'patch_file'
  | 'write_file'
  | 'delete_file'
  | 'execute_command'
  | 'run_shell_command'
  | 'git_push'
  | 'install_dependency'
  | string;

export interface RequestApprovalPayload {
  action_type: DestructiveActionType;
  target_artifacts: string[];
  risk_level: RiskLevel;
  preview_summary: string;
  content_to_verify?: string;
  content_hash?: string;
  nonce?: string;
  allow_override?: boolean;
}

export interface ApprovalResult {
  status: 'approved' | 'rejected' | 'expired';
  nonce: string;
  override_text?: string;
  reason?: string;
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
  contextBreakdown?: ContextBreakdown;
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
  antigravity_conversation_id?: string;
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

export interface MemorySource {
  id: string;
  session_id: string;
  message_id?: string;
  source_type: 'explicit_command' | 'conversation_extraction' | 'manual_edit';
  raw_quote?: string;
  created_at: number;
}

export type MemoryScope = 'core' | 'user' | 'persona' | 'project' | 'session';
export type MemoryCategory = 'profile' | 'preference' | 'interest' | 'fact' | 'user_preference' | 'project_convention' | 'architecture' | 'general';
export type MemoryStatus = 'active' | 'candidate' | 'superseded' | 'invalidated' | 'conflict' | 'archived' | 'rejected';
export type MemoryDomain = string;

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'reverted' | 'expired';
export type ProposalOperation = 'append' | 'prepend' | 'replace_section' | 'insert_after' | 'insert_before' | 'delete_section' | 'set_metadata';
export type ProposalSourceType = 'agent' | 'user' | 'reflection' | 'migration' | 'system';
export type ProjectStatus = 'discovered' | 'active' | 'archived' | 'merged';

export interface ProjectRecord {
  id: string;
  name: string | null;
  repo_root: string | null;
  workspace_dir: string | null;
  git_remote: string | null;
  fingerprint: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

export interface ProjectPathAlias {
  project_id: string;
  path: string;
  normalized_path: string;
  last_seen_at: string;
}

export interface PersonaFileVersionRecord {
  id: string;
  persona_id: string;
  file: PersonaFile;
  content: string;
  content_sha256: string;
  created_by: string;
  source_proposal_id: string | null;
  created_at: string;
}

export interface PersonaPatchPayload {
  section?: string;
  content?: string;
  anchorHeading?: string;
  metadata?: Record<string, unknown>;
}

export interface PersonaChangeProposalRecord {
  id: string;
  persona_id: string;
  target_file: PersonaFile;
  target_section: string | null;
  operation: ProposalOperation;
  patch_payload: PersonaPatchPayload;
  rationale: string | null;
  source_type: ProposalSourceType;
  source_event_id: string | null;
  source_session_id: string | null;
  base_version_id: string | null;
  risk_level: RiskLevel;
  requires_approval: boolean;
  status: ProposalStatus;
  created_at: string;
  reviewed_at: string | null;
  applied_at: string | null;
  rejected_reason: string | null;
}

export interface ProposePersonaChangeInput {
  persona_id: string;
  target_file: PersonaFile;
  target_section?: string;
  operation: ProposalOperation;
  patch_payload: PersonaPatchPayload;
  rationale?: string;
  source_type?: ProposalSourceType;
  source_event_id?: string;
  source_session_id?: string;
  base_content_sha256?: string;
}

export interface ProposalValidationIssue {
  code:
    | 'protected_section_conflict'
    | 'base_version_mismatch'
    | 'token_budget_exceeded'
    | 'forbidden_operation'
    | 'invalid_target_file'
    | 'unsafe_source'
    | 'duplicate_proposal';
  message: string;
}

export interface ProposePersonaChangeResult {
  ok: boolean;
  proposal?: PersonaChangeProposalRecord;
  issues?: ProposalValidationIssue[];
  risk_level?: RiskLevel;
  requires_approval?: boolean;
}

export interface RegressionCheckRecord {
  id: string;
  proposal_id: string;
  baseline_composite: number;
  proposed_composite: number;
  delta: number;
  blocked: boolean;
  reason?: string;
  details?: string;
  created_at: string;
}

export interface PreApplyGuardResult {
  ok: boolean;
  blocked: boolean;
  reason?: 'regression_detected' | 'protected_violation' | 'safe_to_apply';
  baseline_score: number;
  proposed_score: number;
  delta: number;
  details?: string;
  requiresOverride?: boolean;
  checkRecord?: RegressionCheckRecord;
}

export interface ApplyProposalResult {
  ok: boolean;
  proposal_id: string;
  new_version_id?: string;
  applied_at?: string;
  error?: string;
  blocked?: boolean;
  regression_check?: RegressionCheckRecord;
}

export interface MemoryDecayStats {
  decayed_count: number;
  archived_count: number;
  conflicts_resolved: number;
  duration_ms: number;
  timestamp: string;
}

export interface EvolutionTelemetryRecord {
  id: string;
  event_type: 'proposal_created' | 'proposal_approved' | 'proposal_rejected' | 'proposal_applied' | 'proposal_blocked' | 'proposal_reverted' | 'memory_decay_cycle';
  persona_id?: string;
  project_id?: string;
  session_id?: string;
  proposal_id?: string;
  proposal_risk_level?: string;
  proposal_operation?: string;
  regression_blocked?: boolean;
  baseline_score?: number;
  proposed_score?: number;
  score_delta?: number;
  memories_decayed?: number;
  memories_archived?: number;
  conflicts_resolved?: number;
  created_at: string;
}

export interface EvolutionDashboardSummary {
  summary: {
    totalProposals: number;
    appliedProposals: number;
    blockedProposals: number;
    revertedProposals: number;
    applyRate: number;
    blockRate: number;
    revertRate: number;
    avgScoreDelta: number;
  };
  trends: {
    dailyProposals: { date: string; count: number }[];
    dailyBlocks: { date: string; count: number }[];
    complianceScoreOverTime: { date: string; score: number }[];
  };
  quality: {
    topRiskLevels: { risk: string; count: number }[];
    mostBlockedOperations: { operation: string; count: number }[];
  };
  memory: {
    activeMemories: number;
    archivedMemories: number;
    avgConfidence: number;
    recentDecayEvents: number;
  };
}

export interface RollbackResult {
  ok: boolean;
  persona_id: string;
  file: PersonaFile;
  restored_version_id: string;
  new_version_id: string;
}

export interface CanonicalMemory {
  id: string;
  scope?: MemoryScope;
  subject_id: string;
  project_id?: string | null;
  persona_id?: string | null;
  session_id?: string | null;
  category: MemoryCategory;
  domain: string;
  key: string;
  value: string;
  display_text?: string | null;
  confidence: number;
  is_explicit: number;
  importance: number;
  status: MemoryStatus;
  source_id?: string | null;
  usage_count?: number;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at: number;
  updated_at: number;
  last_confirmed_at: number;
}

export interface Episode {
  id: string;
  subject_id: string;
  session_id: string;
  title: string;
  summary: string;
  importance: number;
  lifecycle: 'active' | 'consolidated' | 'archived';
  event_timestamp: number;
  source_id?: string;
  created_at: number;
  last_accessed_at: number;
}

export interface PersonaRelationship {
  subject_id: string;
  persona_id: string;
  familiarity: number;
  formality: number;
  warmth: number;
  humor_level: number;
  preferred_address?: string;
  relationship_summary?: string;
  shared_references?: string[];
  interaction_count: number;
  updated_at: number;
}

export interface MemoryAuditEntry {
  id?: number;
  memory_id: string;
  operation: 'NEW' | 'UPDATE' | 'DELETE' | 'INVALIDATE' | 'CONFLICT' | 'RESOLVE';
  old_status?: string;
  new_status?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  applied_by: 'user_explicit' | 'extractor_worker' | 'consolidation_job' | 'admin';
  actor_scope?: string;
  timestamp: number;
}

export interface MemoryItem {
  id: string;
  scope?: MemoryScope;
  key: string;
  value: string;
  category: MemoryCategory;
  subject_id?: string;
  project_id?: string | null;
  persona_id?: string | null;
  session_id?: string | null;
  domain?: string;
  display_text?: string | null;
  confidence?: number;
  is_explicit?: number;
  importance?: number;
  status?: MemoryStatus;
  source_id?: string | null;
  usage_count?: number;
  last_used_at?: string | null;
  expires_at?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type PromptMode =
  | 'small_talk'
  | 'chat_assist'
  | 'coding_task'
  | 'debugging'
  | 'architecture_review';

export interface PromptTokenBudget {
  core_max?: number;
  user_max?: number;
  project_max?: number;
  persona_max?: number;
  episodic_max?: number;
  session_max?: number;
  total_max: number;
  corePolicy?: number;
  persona?: number;
  tools?: number;
  projectMemory?: number;
  userMemory?: number;
  episodicMemory?: number;
  sessionMemory?: number;
}

export interface PromptPrefixMeta {
  corePolicyVersion: string;
  personaId: string;
  personaVersionId?: string;
  personaCompiledSha256?: string;
  toolSchemaVersion: string;
}

export interface BuiltPrompt {
  prefix: string;
  prefixMeta: PromptPrefixMeta;
  dynamicMemoryBlock: string;
  tokenEstimate: number;
  budget: PromptTokenBudget;
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

export interface SystemVersionInfo {
  version: string;
  gitCommit?: string;
  gitBranch?: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  publishedAt?: string;
  channel?: 'stable' | 'beta';
  commitsBehind?: number;
  lastChecked: number;
}

export interface UpdateApplyProgress {
  stage: 'idle' | 'backup' | 'stash' | 'pull' | 'install' | 'build' | 'done' | 'error';
  message: string;
  progressPercent: number;
  error?: string;
}

export interface UpdateApplyResult {
  success: boolean;
  message: string;
  previousVersion: string;
  newVersion: string;
  backupPath?: string;
  restarted?: boolean;
}

// ============================================================================
// 0xPROXY SUBSYSTEM TYPES
// ============================================================================

export type ProxyProtocol = 'http' | 'https' | 'socks5';
export type ProxyStatus = 'online' | 'offline' | 'checking' | 'expired' | 'unknown';

export interface ProxyAuth {
  username?: string;
  password?: string;
}

export interface ProxyItem {
  id: string;
  raw_line: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  auth?: ProxyAuth | null;
  status: ProxyStatus;
  latency_ms: number | null;
  last_checked_at: number | null;
  added_at: number;
  expires_at: number | null;
  is_active: boolean;
  error_message?: string | null;
  tag?: string | null;
}

export interface ProxyHealthCheckResult {
  proxyId: string;
  protocol: ProxyProtocol;
  status: ProxyStatus;
  latencyMs: number | null;
  error?: string | null;
}

export interface ProxyExportConfig {
  version: string;
  exported_at: string;
  total: number;
  active_count: number;
  proxies: {
    url: string;
    protocol: ProxyProtocol;
    host: string;
    port: number;
    username?: string;
    password?: string;
    status: ProxyStatus;
    latency_ms: number | null;
    expires_at: string | null;
  }[];
}

export type ProxyRoutingCategory = 'cloud_ai' | 'web_search' | 'media_download';

export interface ProxyRoutingConfig {
  enabled: boolean;
  route_cloud_ai: boolean;
  route_web_search: boolean;
  route_media_download: boolean;
}



