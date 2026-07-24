import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AppConfig } from '../src/types';

const APP_DIR = path.join(os.homedir(), '.0xagent');
const CONFIG_FILE = path.join(APP_DIR, 'config.json');

export function getAppDir(): string {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
  return APP_DIR;
}

export function getDefaultConfig(): AppConfig {
  return {
    api_url: 'http://127.0.0.1:11434/v1',
    model_name: 'llama3:latest',
    system_prompt: `You are 0xAgent, an expert AI software developer assistant.
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
- <execute_command>powershell command</execute_command>`,
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
    return { ...getDefaultConfig(), ...parsed };
  } catch (err) {
    console.error('Failed to parse config.json, returning default:', err);
    return getDefaultConfig();
  }
}

export function saveConfig(config: AppConfig): void {
  getAppDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
