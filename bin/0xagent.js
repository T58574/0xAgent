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
  console.log(`  Security Preset        : ${c.cyan}${cfg.permissionPreset || 'prompt'}${c.reset}`);
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

    // Read current version
    let currentVersion = '0.1.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
      if (pkg.version) currentVersion = pkg.version;
    } catch {}

    console.log(`${c.gray}    Current version: v${currentVersion}${c.reset}`);

    // Pre-update memory backup
    const dbPath = path.join(CONFIG_DIR, 'memory.db');
    if (fs.existsSync(dbPath)) {
      const backupPath = path.join(CONFIG_DIR, `memory.db.bak_${Date.now()}`);
      fs.copyFileSync(dbPath, backupPath);
      console.log(`${c.gray}    Memory database backed up to: ${backupPath}${c.reset}`);
    }

    // Auto-stash local changes
    try {
      execSync('git stash save "Auto-stash before 0xagent update"', { stdio: 'ignore' });
    } catch {}

    execSync('git fetch origin main', { stdio: 'inherit' });

    const localHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const remoteHash = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();

    if (localHash === remoteHash) {
      console.log(`${c.green}[OK] 0xAgent is already up-to-date (v${currentVersion} - ${localHash.substring(0, 7)}).${c.reset}\n`);
      return;
    }

    console.log(`${c.cyan}[+] Updates available! Pulling latest release...${c.reset}`);
    try {
      execSync('git pull --rebase origin main', { stdio: 'inherit' });
    } catch {
      execSync('git pull origin main', { stdio: 'inherit' });
    }

    console.log(`${c.yellow}[+] Installing dependencies (npm install)...${c.reset}`);
    execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });

    console.log(`${c.yellow}[+] Rebuilding frontend client...${c.reset}`);
    execSync('npm run build', { stdio: 'inherit' });

    if (process.platform === 'win32') {
      console.log(`${c.yellow}[+] Rebuilding native Windows tray launcher...${c.reset}`);
      const buildPs1 = path.join(PROJECT_ROOT, 'scripts', 'build-launcher.ps1');
      if (fs.existsSync(buildPs1)) {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${buildPs1}"`, { stdio: 'inherit' });
      }
    }

    let newVersion = currentVersion;
    try {
      const newPkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
      if (newPkg.version) newVersion = newPkg.version;
    } catch {}

    console.log(`\n${c.green}${c.bold}[SUCCESS] 0xAgent successfully updated to v${newVersion}!${c.reset}\n`);
  } catch (err) {
    console.error(`\n${c.red}[ERR] Update failed:${c.reset}`, err.message);
  }
}


async function cmdConfig() {
  banner();
  const cfg = loadConfig();

  console.log(`${c.bold}0xAgent Interactive Configuration Manager${c.reset}\n`);
  console.log(`  1. Set Interface Language [current: ${cfg.language || 'ru'}]`);
  console.log(`  2. Set Security Permission Preset [current: ${cfg.permissionPreset || 'prompt'}]`);
  console.log(`  3. Set Groq API Key (Whisper STT) [current: ${cfg.groqApiKey ? '***' + cfg.groqApiKey.slice(-4) : 'none'}]`);
  console.log(`  4. Open Models Folder in File Explorer`);
  console.log(`  5. Purge GPU VRAM & Reset Services`);
  console.log(`  6. Check for Updates (GitHub)`);
  console.log(`  0. Exit\n`);

  const choice = await promptQuestion(`${c.cyan}Select option (0-6): ${c.reset}`);

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
      console.log(`Available presets: prompt (Partial Automation), unrestricted (Full Automation)`);
      const preset = await promptQuestion(`${c.yellow}Enter preset ('prompt' or 'unrestricted'): ${c.reset}`);
      if (['prompt', 'unrestricted'].includes(preset)) {
        cfg.permissionPreset = preset;
        saveConfig(cfg);
        console.log(`${c.green}[OK] Security preset updated to ${preset}.${c.reset}`);
      } else {
        console.log(`${c.red}[!] Invalid preset.${c.reset}`);
      }
      break;
    }
    case '3': {
      const key = await promptQuestion(`${c.yellow}Enter Groq API Key (or empty to clear): ${c.reset}`);
      cfg.groqApiKey = key.trim();
      saveConfig(cfg);
      console.log(`${c.green}[OK] Groq API key updated.${c.reset}`);
      break;
    }
    case '4': {
      const modelsDir = path.join(CONFIG_DIR, 'models');
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
      if (process.platform === 'win32') {
        execSync(`explorer "${modelsDir}"`);
      } else {
        console.log(`${c.cyan}Models directory:${c.reset} ${modelsDir}`);
      }
      break;
    }
    case '5': {
      await cmdPurgeVram();
      break;
    }
    case '6': {
      await cmdUpdate();
      break;
    }
    case '0':
    default:
      console.log(`${c.gray}Exiting config manager.${c.reset}`);
      break;
  }
}

async function cmdVeronica(veronicaArgs) {
  const subCmd = veronicaArgs[0];
  if (!subCmd || subCmd === '--help' || subCmd === '-h') {
    console.log(`
${c.cyan}${c.bold}Veronica CLI Protocol & Assistant Interface${c.reset}
Usage: 0xagent veronica <command> [options]

Commands:
  doc <project> [get|set|append <text>]  Read or update project passport, metrics & changelog
  project [list|info <project>]          List auto-discovered projects & view project cards
  task <project> <skill|prompt>          Launch an autonomous background task via Antigravity
  context <project> [--task <id>]        Fetch dense token-efficient project context
  heartbeat --task <id> [--action <a>]   Update agent alive status & progress
  report --task <id> [--status <s>]      Submit final report & task summary
  error --task <id> --message <m>        Log error or mark task failed
  git commit --task <id> -m <msg>        Safe unified git commit (L3+ autonomy)
  git rollback --task <id>               Rollback commit created by task
  agents                                 List all active background agents
`);
    return;
  }

  // Parse arguments into CLI payload
  let payload = { command: subCmd };

  if (subCmd === 'doc') {
    const project = veronicaArgs[1];
    const action = veronicaArgs[2] || 'get';
    if (!project) {
      console.error(`${c.red}[ERR] Project name is required. Usage: 0xagent veronica doc <project> [get|set|append <text>]${c.reset}`);
      return;
    }
    if (action === 'get') {
      payload.command = 'doc_get';
      payload.project = project;
    } else if (action === 'append') {
      payload.command = 'doc_append';
      payload.project = project;
      payload.message = veronicaArgs.slice(3).join(' ');
    } else if (action === 'set') {
      payload.command = 'doc_update';
      payload.project = project;
      payload.content = veronicaArgs.slice(3).join(' ');
    }
  } else if (subCmd === 'project' || subCmd === 'projects') {
    const action = veronicaArgs[1] || 'list';
    if (action === 'list') {
      payload.command = 'projects_list';
    } else {
      payload.command = 'doc_get';
      payload.project = action;
    }
  } else if (subCmd === 'task' || subCmd === 'run') {
    const project = veronicaArgs[1];
    const taskPrompt = veronicaArgs.slice(2).join(' ');
    if (!project || !taskPrompt) {
      console.error(`${c.red}[ERR] Usage: 0xagent veronica task <project> <skill_or_prompt>${c.reset}`);
      return;
    }
    payload.command = 'task_create';
    payload.project = project;
    payload.custom_prompt = taskPrompt;
  } else if (subCmd === 'context') {
    payload.project = veronicaArgs[1];
    const taskIdx = veronicaArgs.indexOf('--task');
    if (taskIdx !== -1 && veronicaArgs[taskIdx + 1]) {
      payload.task_id = veronicaArgs[taskIdx + 1];
    }
  } else if (subCmd === 'heartbeat') {
    const taskIdx = veronicaArgs.indexOf('--task');
    payload.task_id = taskIdx !== -1 ? veronicaArgs[taskIdx + 1] : process.env.VERONICA_TASK_ID;
    const actionIdx = veronicaArgs.indexOf('--action');
    if (actionIdx !== -1) payload.action = veronicaArgs[actionIdx + 1];
    const progIdx = veronicaArgs.indexOf('--progress');
    if (progIdx !== -1) payload.progress = veronicaArgs[progIdx + 1];
  } else if (subCmd === 'report') {
    const taskIdx = veronicaArgs.indexOf('--task');
    payload.task_id = taskIdx !== -1 ? veronicaArgs[taskIdx + 1] : process.env.VERONICA_TASK_ID;
    const statusIdx = veronicaArgs.indexOf('--status');
    if (statusIdx !== -1) payload.status = veronicaArgs[statusIdx + 1];
    const sumIdx = veronicaArgs.indexOf('--summary');
    if (sumIdx !== -1) payload.summary = veronicaArgs.slice(sumIdx + 1).join(' ');
  } else if (subCmd === 'error') {
    const taskIdx = veronicaArgs.indexOf('--task');
    payload.task_id = taskIdx !== -1 ? veronicaArgs[taskIdx + 1] : process.env.VERONICA_TASK_ID;
    const msgIdx = veronicaArgs.indexOf('--message');
    if (msgIdx !== -1) payload.message = veronicaArgs.slice(msgIdx + 1).join(' ');
    payload.fatal = veronicaArgs.includes('--fatal');
  } else if (subCmd === 'git') {
    const gitAction = veronicaArgs[1];
    if (gitAction === 'commit') {
      payload.command = 'git_commit';
      const taskIdx = veronicaArgs.indexOf('--task');
      payload.task_id = taskIdx !== -1 ? veronicaArgs[taskIdx + 1] : process.env.VERONICA_TASK_ID;
      const mIdx = veronicaArgs.indexOf('-m');
      if (mIdx !== -1) payload.message = veronicaArgs.slice(mIdx + 1).join(' ');
    } else if (gitAction === 'rollback') {
      payload.command = 'git_rollback';
      const taskIdx = veronicaArgs.indexOf('--task');
      payload.task_id = taskIdx !== -1 ? veronicaArgs[taskIdx + 1] : process.env.VERONICA_TASK_ID;
    }
  } else if (subCmd === 'agents' || subCmd === 'list') {
    payload.command = 'agents_list';
  }

  // Send HTTP request to local 0xAgent server
  const port = process.env.PORT || 3001;
  const postData = JSON.stringify(payload);

  const req = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: '/api/veronica/cli',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 5000,
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.success) {
            if (typeof json.data === 'string') {
              console.log(json.data);
            } else {
              console.log(JSON.stringify(json.data, null, 2));
            }
          } else {
            console.error(`${c.red}[Veronica CLI Error]${c.reset} ${json.error || 'Command failed'}`);
            process.exit(1);
          }
        } catch {
          console.log(body);
        }
      });
    }
  );

  req.on('error', (err) => {
    console.error(`${c.red}[Veronica CLI Error]${c.reset} Cannot connect to 0xAgent server on port ${port}: ${err.message}`);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

async function cmdNode(nodeArgs) {
  const subCmd = nodeArgs[0] || 'status';
  if (subCmd === 'probe' || subCmd === 'status') {
    const host = nodeArgs[1] || '127.0.0.1';
    const port = parseInt(nodeArgs[2], 10) || 11434;
    console.log(`${c.cyan}[*] Probing Compute Node at http://${host}:${port}/health...${c.reset}`);
    const start = Date.now();
    const req = http.get({ hostname: host, port, path: '/health', timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => {
        const ms = Date.now() - start;
        if (res.statusCode === 200) {
          console.log(`${c.green}[OK] Compute Node is ONLINE (${ms}ms)${c.reset}`);
          try {
            console.log(JSON.stringify(JSON.parse(data), null, 2));
          } catch {
            console.log(data);
          }
        } else {
          console.log(`${c.yellow}[!] Node responded with HTTP ${res.statusCode} (${ms}ms)${c.reset}`);
        }
      });
    });
    req.on('error', (err) => {
      console.log(`${c.red}[FAIL] Compute Node is OFFLINE: ${err.message}${c.reset}`);
    });
  } else {
    console.log(`Usage: 0xagent node probe [host] [port]`);
  }
}

// -------------------------------------------------------------
// CLI Routing
// -------------------------------------------------------------

const args = process.argv.slice(2);
const invokedAs = path.basename(process.argv[1] || '').toLowerCase();
const isVeronicaBinary = invokedAs.includes('veronica');

if (isVeronicaBinary) {
  cmdVeronica(args);
} else {
  const command = args[0] || 'start';

  // Support direct subcommands without explicit 'veronica' prefix
  const directVeronicaCmds = ['doc', 'project', 'projects', 'task', 'context', 'heartbeat', 'report', 'agents'];
  if (directVeronicaCmds.includes(command.toLowerCase())) {
    cmdVeronica(args);
  } else {
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
      case 'veronica':
        cmdVeronica(args.slice(1));
        break;
      case 'node':
        cmdNode(args.slice(1));
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
  0xagent                      Start 0xAgent in background system tray (default)
  0xagent start -f             Start in foreground console mode
  0xagent veronica <cmd>       Veronica assistant CLI (doc, project, task, context)
  0xagent doc <project> ...    Direct project documentation manager
  0xagent project list         List auto-discovered projects
  0xagent task <project> <p>   Launch autonomous task via Antigravity (agy)
  0xagent node probe [host]    Probe remote GPU Compute Node in LAN
  0xagent config               Interactive settings & models manager
  0xagent status               Show backend health, telemetry & active model
  0xagent update               Pull latest releases from GitHub & rebuild
  0xagent stop                 Terminate all running processes & free ports
  0xagent purge-vram           Force purge GPU VRAM and terminate inference servers
  0xagent help                 Show this help manual
`);
        break;
      default:
        console.log(`${c.red}[!] Unknown command: ${command}${c.reset}. Run '0xagent help' for usage.`);
        break;
    }
  }
}

