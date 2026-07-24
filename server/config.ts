import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AppConfig, PromptFileInfo } from '../src/types';

const APP_DIR = path.join(os.homedir(), '.0xagent');
const PROMPTS_DIR = path.join(APP_DIR, 'prompts');
const DATA_DIR = path.join(APP_DIR, 'data');
const CONFIG_FILE = path.join(APP_DIR, 'config.json');

const DEFAULT_PROMPT_CONTENT = `You are 0xAgent, an expert AI software developer assistant.
You can read files, write files, patch files, list directories, grep search, and execute PowerShell commands.
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
- <execute_command>powershell command</execute_command>`;

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
    model_name: 'llama3:latest',
    system_prompt: DEFAULT_PROMPT_CONTENT,
    active_prompt_file: 'default.md',
    workspace_dir: null,
    groq_api_key: null,
    theme_colors: {
      bg_color: '#090d16',
      text_color: '#f8fafc',
      border_color: 'rgba(255, 255, 255, 0.1)',
      active_color: 'rgba(30, 41, 59, 0.7)',
      send_btn_color: '#3b82f6',
    },
    models_path: null,
    reasoning_enabled: true,
    temperature: 0.7,
    max_tokens: 8192,
    api_timeout_sec: 120,
    auto_save_history: true,
    sound_notifications: true,
    compact_chat: false,
    local_server: null,
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

// Prompt Files Management API
export function listPromptFiles(): PromptFileInfo[] {
  getAppDir();
  const cfg = loadConfig();
  const activeFile = cfg.active_prompt_file || 'default.md';

  const files = fs.readdirSync(PROMPTS_DIR);
  const result: PromptFileInfo[] = [];

  for (const filename of files) {
    if (filename.endsWith('.md') || filename.endsWith('.txt')) {
      const fullPath = path.join(PROMPTS_DIR, filename);
      const stat = fs.statSync(fullPath);
      
      // Generate readable title
      let title = filename.replace(/\.(md|txt)$/i, '').replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      result.push({
        filename,
        title,
        is_active: filename.toLowerCase() === activeFile.toLowerCase(),
        updated_at: stat.mtimeMs,
      });
    }
  }

  result.sort((a, b) => (a.is_active ? -1 : b.is_active ? 1 : b.updated_at - a.updated_at));
  return result;
}

export function readPromptFile(filename: string): string {
  getAppDir();
  const safeName = path.basename(filename);
  const filePath = path.join(PROMPTS_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${safeName}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function writePromptFile(filename: string, content: string): void {
  getAppDir();
  let safeName = path.basename(filename);
  if (!safeName.endsWith('.md') && !safeName.endsWith('.txt')) {
    safeName += '.md';
  }
  const filePath = path.join(PROMPTS_DIR, safeName);
  fs.writeFileSync(filePath, content, 'utf-8');

  const cfg = loadConfig();
  if (cfg.active_prompt_file === safeName) {
    cfg.system_prompt = content;
    saveConfig(cfg);
  }
}

export function deletePromptFile(filename: string): void {
  getAppDir();
  const safeName = path.basename(filename);
  if (safeName.toLowerCase() === 'default.md') {
    throw new Error('Default prompt file (default.md) cannot be deleted');
  }
  const filePath = path.join(PROMPTS_DIR, safeName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const cfg = loadConfig();
  if (cfg.active_prompt_file === safeName) {
    cfg.active_prompt_file = 'default.md';
    cfg.system_prompt = readPromptFile('default.md');
    saveConfig(cfg);
  }
}

export function setActivePromptFile(filename: string): AppConfig {
  getAppDir();
  const safeName = path.basename(filename);
  const content = readPromptFile(safeName);
  const cfg = loadConfig();
  cfg.active_prompt_file = safeName;
  cfg.system_prompt = content;
  saveConfig(cfg);
  return cfg;
}
