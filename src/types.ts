export interface ThemeColors {
  bg_color: string;
  text_color: string;
  border_color: string;
  active_color: string;
  send_btn_color: string;
}

export interface AppConfig {
  api_url: string;
  model_name: string;
  system_prompt: string;
  workspace_dir?: string | null;
  groq_api_key?: string | null;
  theme_colors?: ThemeColors | null;
}


export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string; // JSON string from Rust backend
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'error';
  output?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  tool_calls?: ToolCallInfo[] | null;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[] | null;
}
