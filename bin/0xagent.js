#!/usr/bin/env node

/**
 * 0xAgent Universal CLI Hub
 * Controls background processes, configuration, updates from GitHub, and system telemetry.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import readline from 'node:readline';
import https from 'node:https';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const USER_HOME = os.homedir();
const CONFIG_DIR = path.join(USER_HOME, '.0xagent');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function banner() {
  console.log(`
${c.cyan}${c.bold}  ==============================================================
  |   0xAgent — Autonomous AI Developer & Web-IDE Platform     |
  |   CLI & Process Supervisor Hub                             |
  ==============================================================${c.reset}
`);
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function saveConfig(cfg) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`${c.red}[ERR] Failed to save config:${c.reset}`, err.message);
    return false;
  }
}

async function checkHealth(port = 3001) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path: '/api/auth/status',
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 1200
    };

    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      // Fallback to HTTP check
      const httpReq = http.request({ ...options, path: '/api/health' }, (httpRes) => {
        resolve(httpRes.statusCode === 200);
      });
      httpReq.on('error', () => resolve(false));
      httpReq.end();
    });

    req.end();
  });
}

function promptQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

// -------------------------------------------------------------
// Commands
// -------------------------------------------------------------

async function cmdStart(options = {}) {
  banner();
  console.log(`${c.yellow}[*] Starting 0xAgent platform...${c.reset}`);

  const isWin = process.platform === 'win32';
  const trayExe = path.join(PROJECT_ROOT, '0xAgent.exe');

  if (isWin && fs.existsSync(trayExe) && !options.foreground) {
    console.log(`${c.green}[+] Launching via Native Windows Tray Supervisor (0xAgent.exe)...${c.reset}`);
    console.log(`${c.gray}    Zero RAM overhead, silent background operation.${c.reset}`);
    const child = spawn(trayExe, [], {
      detached: true,
      stdio: 'ignore',
      cwd: PROJECT_ROOT
    });
    child.unref();
    console.log(`${c.green}[OK] 0xAgent is now running in your Windows System Tray.${c.reset}`);
    console.log(`${c.cyan}    Web UI:  https://127.0.0.1:5173${c.reset}`);
    console.log(`${c.cyan}    API:     https://127.0.0.1:3001${c.reset}\n`);
    return;
  }

  // Foreground or Unix fallback
  console.log(`${c.cyan}[+] Launching 0xAgent dev server (frontend + backend)...${c.reset}`);
  const proc = spawn('npm', ['run', 'dev'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true
  });

  proc.on('close', (code) => {
    console.log(`${c.yellow}[!] 0xAgent stopped with exit code ${code}.${c.reset}`);
  });
}

async function cmdStop() {
  banner();
  console.log(`${c.yellow}[*] Terminating all 0xAgent processes, releasing ports, and purging VRAM...${c.reset}`);

  if (process.platform === 'win32') {
    const cleanupScript = path.join(PROJECT_ROOT, 'scripts', 'cleanup.ps1');
    if (fs.existsSync(cleanupScript)) {
      try {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${cleanupScript}"`, { stdio: 'inherit' });
      } catch {}
    }
  } else {
    try {
      execSync(`pkill -f "0xAgent" || true`, { stdio: 'ignore' });
      execSync(`pkill -f "llama-server" || true`, { stdio: 'ignore' });
      execSync(`lsof -ti:3001,5173 | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    } catch {}
  }

  console.log(`${c.green}[OK] All 0xAgent processes terminated cleanly.${c.reset}\n`);
}

async function cmdStatus() {
  banner();
  console.log(`${c.bold}System & Service Status:${c.reset}`);

  const isServerUp = await checkHealth(3001);
  const cfg = loadConfig();

  console.log(`  Backend Server (:3001) : ${isServerUp ? `${c.green}[ONLINE]${c.reset}` : `${c.red}[OFFLINE]${c.reset}`}`);
  console.log(`  Active Language        : ${c.cyan}${cfg.language || 'ru'}${c.reset}`);
  console.log(`  Security Preset        : ${c.cyan}${cfg.permissionPreset || 'workspace-write'}${c.reset}`);
  console.log(`  LLM Provider           : ${c.cyan}${cfg.defaultProvider || 'local'}${c.reset}`);
  console.log(`  Model                  : ${c.cyan}${cfg.selectedModel || 'None / Not Selected'}${c.reset}`);
  console.log(`  Config Location        : ${c.gray}${CONFIG_PATH}${c.reset}`);
  console.log(`  Models Directory       : ${c.gray}${path.join(CONFIG_DIR, 'models')}${c.reset}\n`);
}

async function cmdPurgeVram() {
  banner();
  console.log(`${c.yellow}[*] Purging GPU VRAM & terminating local inference workers...${c.reset}`);
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /F /T /IM llama-server.exe /IM llama.exe 2>nul || exit 0', { shell: true, stdio: 'ignore' });
    } catch {}
  } else {
    try {
      execSync('pkill -9 llama-server || true', { stdio: 'ignore' });
    } catch {}
  }
  console.log(`${c.green}[OK] GPU VRAM released successfully.${c.reset}\n`);
}

async function cmdUpdate() {
  banner();
  console.log(`${c.yellow}[*] Checking for updates from GitHub repository...${c.reset}`);

  try {
    process.chdir(PROJECT_ROOT);
    execSync('git fetch origin main', { stdio: 'inherit' });

    const localHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const remoteHash = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();

    if (localHash === remoteHash) {
      console.log(`${c.green}[OK] 0xAgent is already up-to-date (${localHash.substring(0, 7)}).${c.reset}\n`);
      return;
    }

    console.log(`${c.cyan}[+] Updates available! Pulling latest changes...${c.reset}`);
    execSync('git pull --rebase origin main', { stdio: 'inherit' });

    console.log(`${c.yellow}[+] Updating dependencies (npm install)...${c.reset}`);
    execSync('npm install', { stdio: 'inherit' });

    console.log(`${c.yellow}[+] Rebuilding frontend client...${c.reset}`);
    execSync('npm run build', { stdio: 'inherit' });

    if (process.platform === 'win32') {
      console.log(`${c.yellow}[+] Rebuilding native Windows tray launcher...${c.reset}`);
      const buildPs1 = path.join(PROJECT_ROOT, 'scripts', 'build-launcher.ps1');
      if (fs.existsSync(buildPs1)) {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${buildPs1}"`, { stdio: 'inherit' });
      }
    }

    console.log(`\n${c.green}${c.bold}[SUCCESS] 0xAgent successfully updated to latest version!${c.reset}\n`);
  } catch (err) {
    console.error(`\n${c.red}[ERR] Update failed:${c.reset}`, err.message);
  }
}

async function cmdConfig() {
  banner();
  const cfg = loadConfig();

  console.log(`${c.bold}0xAgent Interactive Configuration Manager${c.reset}\n`);
  console.log(`  1. Set Interface Language [current: ${cfg.language || 'ru'}]`);
  console.log(`  2. Set Security Permission Preset [current: ${cfg.permissionPreset || 'workspace-write'}]`);
  console.log(`  3. Set Google AI Studio (Gemini) API Key [current: ${cfg.geminiApiKey ? '***' + cfg.geminiApiKey.slice(-4) : 'none'}]`);
  console.log(`  4. Set Groq API Key [current: ${cfg.groqApiKey ? '***' + cfg.groqApiKey.slice(-4) : 'none'}]`);
  console.log(`  5. Open Models Folder in File Explorer`);
  console.log(`  6. Purge GPU VRAM & Reset Services`);
  console.log(`  7. Check for Updates (GitHub)`);
  console.log(`  0. Exit\n`);

  const choice = await promptQuestion(`${c.cyan}Select option (0-7): ${c.reset}`);

  switch (choice) {
    case '1': {
      const lang = await promptQuestion(`${c.yellow}Enter language ('en' or 'ru'): ${c.reset}`);
      if (lang === 'en' || lang === 'ru') {
        cfg.language = lang;
        saveConfig(cfg);
        console.log(`${c.green}[OK] Language updated to ${lang}.${c.reset}`);
      } else {
        console.log(`${c.red}[!] Invalid language selection.${c.reset}`);
      }
      break;
    }
    case '2': {
      console.log(`Available presets: readonly, workspace-write, prompt, unrestricted`);
      const preset = await promptQuestion(`${c.yellow}Enter preset: ${c.reset}`);
      if (['readonly', 'workspace-write', 'prompt', 'unrestricted'].includes(preset)) {
        cfg.permissionPreset = preset;
        saveConfig(cfg);
        console.log(`${c.green}[OK] Security preset updated to ${preset}.${c.reset}`);
      } else {
        console.log(`${c.red}[!] Invalid preset.${c.reset}`);
      }
      break;
    }
    case '3': {
      const key = await promptQuestion(`${c.yellow}Enter Gemini API Key (or empty to clear): ${c.reset}`);
      cfg.geminiApiKey = key.trim();
      saveConfig(cfg);
      console.log(`${c.green}[OK] Gemini API key updated.${c.reset}`);
      break;
    }
    case '4': {
      const key = await promptQuestion(`${c.yellow}Enter Groq API Key (or empty to clear): ${c.reset}`);
      cfg.groqApiKey = key.trim();
      saveConfig(cfg);
      console.log(`${c.green}[OK] Groq API key updated.${c.reset}`);
      break;
    }
    case '5': {
      const modelsDir = path.join(CONFIG_DIR, 'models');
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
      if (process.platform === 'win32') {
        execSync(`explorer "${modelsDir}"`);
      } else {
        console.log(`${c.cyan}Models directory:${c.reset} ${modelsDir}`);
      }
      break;
    }
    case '6': {
      await cmdPurgeVram();
      break;
    }
    case '7': {
      await cmdUpdate();
      break;
    }
    case '0':
    default:
      console.log(`${c.gray}Exiting config manager.${c.reset}`);
      break;
  }
}

// -------------------------------------------------------------
// CLI Routing
// -------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0] || 'start';

switch (command.toLowerCase()) {
  case 'start':
    cmdStart({ foreground: args.includes('--foreground') || args.includes('-f') });
    break;
  case 'stop':
    cmdStop();
    break;
  case 'status':
    cmdStatus();
    break;
  case 'config':
    cmdConfig();
    break;
  case 'update':
  case 'upgrade':
    cmdUpdate();
    break;
  case 'purge-vram':
  case 'purge':
    cmdPurgeVram();
    break;
  case '--help':
  case '-h':
  case 'help':
    banner();
    console.log(`${c.bold}Usage:${c.reset} 0xagent [command] [options]

${c.bold}Commands:${c.reset}
  0xagent              Start 0xAgent in background system tray (default)
  0xagent start -f     Start in foreground console mode
  0xagent config       Interactive settings & models manager
  0xagent status       Show backend health, telemetry & active model
  0xagent update       Pull latest releases from GitHub & rebuild
  0xagent stop         Terminate all running processes & free ports
  0xagent purge-vram   Force purge GPU VRAM and terminate inference servers
  0xagent help         Show this help manual
`);
    break;
  default:
    console.log(`${c.red}[!] Unknown command: ${command}${c.reset}. Run '0xagent help' for usage.`);
    break;
}
