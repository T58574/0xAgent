import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AppConfig } from '../src/types';

const APP_DIR = path.join(os.homedir(), '.0xagent');
const PROMPTS_DIR = path.join(APP_DIR, 'prompts');
const DATA_DIR = path.join(APP_DIR, 'data');
const CONFIG_FILE = path.join(APP_DIR, 'config.json');

const DEFAULT_PROMPT_CONTENT = `You are 0xAgent, an expert AI software developer assistant running on Windows with PowerShell.
You can read files, write files, patch files, list directories, grep search, and execute PowerShell commands directly in the active workspace.
When you need to use a tool, format it using XML tags:
- <read_file path="path/to/file" />
- <write_file path="path/to/file">file contents</write_file>
- <patch_file path="path/to/file">
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
</patch_file>
- <list_dir path="path/to/dir" />
- <grep_search pattern="regex_pattern" path="path/to/search" />
- <execute_command>raw powershell command</execute_command>

COMMAND EXECUTION RULES:
- OS is Windows. Commands run directly in PowerShell in the workspace root directory.
- Do NOT wrap commands in "powershell -Command ...", "powershell -Command cd ...", or explicit "cd <dir>".
- Do NOT execute blocking background dev servers (e.g. 'npm run dev', 'vite') inside <execute_command>. Use one-off build/test commands instead.`;

const CODING_AGENT_PROMPT = `# High-Speed Coding Agent Prompt

You are 0xAgent Coding Assistant.
Your focus is to quickly write clean, modular, production-ready code with minimal explanation.
Implement requested changes accurately and directly using tools.`;

const CODE_REVIEWER_PROMPT = `# Code Reviewer & Security Auditor Prompt

You are 0xAgent Auditor.
Your primary role is to inspect code for security vulnerabilities, type mismatches, and edge-case bugs before execution.
Provide constructive feedback and precise patches.`;

export function getAppDir(): string {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Populate default prompts if directory is empty or default file missing
  const defaultFile = path.join(PROMPTS_DIR, 'default.md');
  if (!fs.existsSync(defaultFile)) {
    fs.writeFileSync(defaultFile, DEFAULT_PROMPT_CONTENT, 'utf-8');
  }

  const codingFile = path.join(PROMPTS_DIR, 'coding_agent.md');
  if (!fs.existsSync(codingFile)) {
    fs.writeFileSync(codingFile, CODING_AGENT_PROMPT, 'utf-8');
  }

  const reviewerFile = path.join(PROMPTS_DIR, 'code_reviewer.md');
  if (!fs.existsSync(reviewerFile)) {
    fs.writeFileSync(reviewerFile, CODE_REVIEWER_PROMPT, 'utf-8');
  }

  return APP_DIR;
}

export function getDefaultConfig(): AppConfig {
  return {
    api_url: 'http://127.0.0.1:11434/v1',
    model_name: 'gemini-3.6-flash',
    system_prompt: DEFAULT_PROMPT_CONTENT,
    active_prompt_file: 'default.md',
    workspace_dir: null,
    groq_api_key: null,
    gemini_api_key: null,
    theme_colors: {
      bg_color: '#090d16',
      text_color: '#f8fafc',
      border_color: 'rgba(255, 255, 255, 0.1)',
      active_color: 'rgba(30, 41, 59, 0.7)',
      send_btn_color: '#3b82f6',
    },
    models_path: null,
    reasoning_enabled: true,
    planning_mode: true,
    temperature: 0.7,
    max_tokens: 8192,
    api_timeout_sec: 120,
    auto_save_history: true,
    sound_notifications: true,
    compact_chat: false,
    local_server: null,
    fallback_models: [
      'gemini-3.6-flash',
      'gemma-4-31b-it',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ],
    jules_api_key: null,
    jules_default_repo: null,
    jarvis_model: 'gemini-3.5-flash-lite',
    tts_config: {
      enabled: true,
      voice: 'ru-RU-DmitryNeural',
      rate: '+15%',
      pitch: '-5Hz',
      volume: 80,
      play_on_speaker: true,
      play_in_browser: true,
    },
    proactive_companion_enabled: true,
  };
}

export function loadConfig(): AppConfig {
  getAppDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = getDefaultConfig();
    saveConfig(defaultConfig);
    return defaultConfig;
  }
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const config: AppConfig = { ...getDefaultConfig(), ...parsed };

    // Read active prompt file content if present
    const activeFile = config.active_prompt_file || 'default.md';
    const activeFilePath = path.join(PROMPTS_DIR, activeFile);
    if (fs.existsSync(activeFilePath)) {
      config.system_prompt = fs.readFileSync(activeFilePath, 'utf-8');
    }

    return config;
  } catch (err) {
    console.error('Failed to parse config.json, returning default:', err);
    return getDefaultConfig();
  }
}

export function saveConfig(config: AppConfig): void {
  getAppDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

  // Also sync current system_prompt to active file
  const activeFile = config.active_prompt_file || 'default.md';
  const activeFilePath = path.join(PROMPTS_DIR, activeFile);
  if (config.system_prompt) {
    fs.writeFileSync(activeFilePath, config.system_prompt, 'utf-8');
  }
}


