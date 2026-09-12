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
import { CuiClient, TerminalCui, runCliPrompt, SettingsTui, ModelTui, PersonaTui, CommandPickerTui } from './cui.js';

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
  process.exit(0);
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
  process.exit(0);
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
  process.exit(0);
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
  const client = new CuiClient({ workspaceDir: process.cwd() });
  const tui = new SettingsTui(client, () => process.exit(0));
  tui.start();
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

async function getPipedStdin() {
  if (process.stdin.isTTY) return null;
  return new Promise((resolve) => {
    let data = '';
    const onData = (chunk) => (data += chunk);
    const onEnd = () => {
      cleanup();
      resolve(data.trim() || null);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(data.trim() || null);
    }, 150);

    const cleanup = () => {
      clearTimeout(timer);
      try { process.stdin.removeListener('data', onData); } catch {}
      try { process.stdin.removeListener('end', onEnd); } catch {}
      try { process.stdin.pause(); } catch {}
    };

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.resume();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const first = (args[0] || '').toLowerCase();

  const EXPLICIT_COMMANDS = new Set([
    'start', 'stop', 'status', 'node', 'config', 'settings', 'update', 'upgrade',
    'release', 'purge-vram', 'purge', 'help', '--help', '-h', 'model', 'persona', 'server', 'chat'
  ]);

  const piped = !EXPLICIT_COMMANDS.has(first) ? await getPipedStdin() : null;

  // No arguments provided
  if (args.length === 0) {
    if (piped) {
      await runCliPrompt(piped, { quiet: false });
      return;
    }
    // Default in TTY: Launch full interactive CUI
    const client = new CuiClient({ workspaceDir: process.cwd() });
    const cui = new TerminalCui(client);
    await cui.startRepl();
    return;
  }

  // One-shot execution shortcuts: 0xagent -p "..." or 0xagent --prompt "..." or 0xagent exec "..."
  if (first === '-p' || first === '--prompt' || first === 'exec') {
    const promptArgs = args.slice(1).filter((a) => !a.startsWith('-'));
    let prompt = promptArgs.join(' ');
    if (piped) prompt = prompt ? `${prompt}\n\n${piped}` : piped;
    const quiet = args.includes('--quiet') || args.includes('-q');
    const json = args.includes('--json');
    if (!prompt) {
      console.error(`${c.red}[!] No prompt provided. Usage: 0xagent -p "your prompt"${c.reset}`);
      process.exit(1);
    }
    await runCliPrompt(prompt, { quiet, json });
    return;
  }

  // Explicit interactive CUI mode: 0xagent chat or 0xagent -i
  if (first === 'chat' || first === '-i' || first === '--interactive') {
    const client = new CuiClient({ workspaceDir: process.cwd() });
    const cui = new TerminalCui(client);
    await cui.startRepl();
    return;
  }

  // Server management from CLI: 0xagent server <start|stop|status|logs|purge>
  if (first === 'server' || first === 'llm') {
    const sub = (args[1] || 'status').toLowerCase();
    const client = new CuiClient();
    await client.ensureBackendRunning();
    if (sub === 'start') {
      console.log(`${c.yellow}[*] Starting local inference server...${c.reset}`);
      try {
        await client.api('/api/start-local-server', 'POST', {});
        console.log(`${c.green}[✓] Server start initiated successfully.${c.reset}`);
      } catch (err) {
        console.error(`${c.red}[!] Start failed:${c.reset}`, err.message);
      }
    } else if (sub === 'stop') {
      console.log(`${c.yellow}[*] Stopping local inference server...${c.reset}`);
      await client.api('/api/stop-local-server', 'POST', {}).catch(() => {});
      console.log(`${c.green}[✓] Server stopped.${c.reset}`);
    } else if (sub === 'purge') {
      await cmdPurgeVram();
    } else if (sub === 'logs') {
      const logsData = await client.api('/api/server-logs').catch(() => ({ logs: [] }));
      (logsData.logs || []).slice(-30).forEach((l) => console.log(l));
    } else {
      const st = await client.api('/api/server-status').catch(() => ({ running: false }));
      console.log(`\nLocal Inference Server: ${st.running ? `${c.green}[ONLINE]${c.reset} (Port ${st.port}, Model: ${st.modelName})` : `${c.yellow}[OFFLINE]${c.reset}`}\n`);
    }
    return;
  }

  // Model command from CLI: 0xagent model [name]
  if (first === 'model') {
    const client = new CuiClient({ workspaceDir: process.cwd() });
    if (args.length === 1) {
      const tui = new ModelTui(client, () => process.exit(0));
      tui.start();
      return;
    }

    const probe = await client.probeServer();
    const target = args.slice(1).join(' ').trim();
    const cfg = client.loadConfig();
    const tui = new ModelTui(client);
    const matched = tui.models.find(
      (m) =>
        m.name.toLowerCase() === target.toLowerCase() ||
        m.id.toLowerCase() === target.toLowerCase() ||
        m.name.toLowerCase().includes(target.toLowerCase())
    );

    const chosenId = matched ? matched.id : (target.startsWith('local:') ? target : `local:${target}`);
    const chosenName = matched ? matched.name : target;
    cfg.selectedModel = chosenId;
    cfg.model_name = chosenId;

    if (matched?.fullPath) {
      if (!cfg.local_server) cfg.local_server = {};
      cfg.local_server.model_path = matched.fullPath;
    }

    client.saveConfig(cfg);

    if (probe.ok) {
      if (matched?.fullPath) {
        await client.api('/api/start-local-server', 'POST', {
          modelPath: matched.fullPath,
          host: cfg.local_server?.host || '127.0.0.1',
          port: cfg.local_server?.port || 11434,
        }).catch(() => {});
      }
      await client.api('/api/update-config', 'POST', {
        selectedModel: chosenId,
        model_name: chosenId,
        local_server: cfg.local_server,
      }).catch(() => {});
    }

    console.log(`${c.green}[✓] Model switched to: ${chosenName}${c.reset}`);
    if (matched?.fullPath) {
      console.log(`    ${c.gray}Loaded into local llama-server (:11434).${c.reset}`);
    }
    process.exit(0);
  }

  // Persona command from CLI: 0xagent persona [name]
  if (first === 'persona') {
    const client = new CuiClient({ workspaceDir: process.cwd() });
    if (args.length === 1) {
      const tui = new PersonaTui(client, () => process.exit(0));
      tui.start();
      return;
    }

    const probe = await client.probeServer();
    const query = args.slice(1).join(' ').trim();
    const tui = new PersonaTui(client);
    const matched = tui.personas.find(
      (p) =>
        p.id.toLowerCase() === query.toLowerCase() ||
        p.name.toLowerCase() === query.toLowerCase() ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.id.toLowerCase().includes(query.toLowerCase())
    );

    const targetId = matched ? matched.id : query;
    const targetName = matched ? matched.name : query;
    const cfg = client.loadConfig();
    cfg.active_persona_id = targetId;
    client.saveConfig(cfg);

    // Update disk metadata.json for personas
    const personasDir = path.join(CONFIG_DIR, 'personas');
    if (fs.existsSync(personasDir)) {
      for (const sub of fs.readdirSync(personasDir)) {
        const metaPath = path.join(personasDir, sub, 'metadata.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            meta.is_active = (meta.id === targetId || sub === targetId);
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
          } catch {}
        }
      }
    }

    if (probe.ok) {
      await client.api(`/api/personas/${targetId}/activate`, 'POST').catch(() => {});
    }
    console.log(`${c.green}[✓] Persona switched to: ${targetName} (${targetId})${c.reset}`);
    process.exit(0);
  }

  // Known subcommands
  switch (first) {
    case 'start':
      cmdStart({ foreground: args.includes('--foreground') || args.includes('-f') });
      break;
    case 'stop':
      cmdStop();
      break;
    case 'status':
      cmdStatus();
      break;
    case 'node':
      cmdNode(args.slice(1));
      break;
    case 'config': {
      const subArgs = args.slice(1);
      const cfg = loadConfig();
      if (subArgs.length === 0) {
        if (process.stdin.isTTY) {
          await cmdConfig();
        } else {
          console.log(JSON.stringify(cfg, null, 2));
          process.exit(0);
        }
      } else {
        const action = subArgs[0].toLowerCase();
        if (action === 'show' || action === 'list') {
          console.log(JSON.stringify(cfg, null, 2));
        } else if (action === 'get' && subArgs[1]) {
          console.log(JSON.stringify(cfg[subArgs[1]]));
        } else if ((action === 'set' && subArgs[1]) || subArgs.length >= 2) {
          const key = action === 'set' ? subArgs[1] : subArgs[0];
          let val = (action === 'set' ? subArgs.slice(2) : subArgs.slice(1)).join(' ');
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (!isNaN(Number(val))) val = Number(val);

          cfg[key] = val;
          saveConfig(cfg);
          console.log(`${c.green}[✓] Updated config: ${key} = ${JSON.stringify(val)}${c.reset}`);
        } else {
          console.log(`Usage: 0xagent config [show | get <key> | set <key> <val>]`);
        }
        process.exit(0);
      }
      break;
    }
    case 'update':
    case 'upgrade':
      cmdUpdate();
      break;
    case 'release': {
      const releaseScript = path.join(PROJECT_ROOT, 'scripts', 'release.cjs');
      if (fs.existsSync(releaseScript)) {
        const relProc = spawn('node', [releaseScript, ...args.slice(1)], { cwd: PROJECT_ROOT, stdio: 'inherit' });
        relProc.on('close', (code) => process.exit(code || 0));
      } else {
        console.error(`${c.red}[ERR] Release script not found at ${releaseScript}${c.reset}`);
      }
      break;
    }
    case 'purge-vram':
    case 'purge':
      cmdPurgeVram();
      break;
    case 'settings': {
      await cmdConfig();
      break;
    }
    case '--help':
    case '-h':
    case 'help':
      banner();
      console.log(`${c.bold}Usage:${c.reset} 0xagent [command|prompt] [options]

${c.bold}Interactive & Agent Commands:${c.reset}
  0xagent                      Launch interactive CUI session (default)
  0xagent settings             Open interactive Settings menu (auto-open browser, theme, etc.)
  0xagent model [name]         Open model & reasoning effort picker or switch active model
  0xagent persona [id]         Open persona selector or switch active persona profile
  0xagent chat                 Launch interactive CUI session
  0xagent "your prompt"        Execute prompt directly in current directory
  0xagent -p "..." [--quiet]   One-shot execution for scripts & Veron (--quiet, --json)
  0xagent server [action]      Manage llama-server (start, stop, status, logs, purge)

${c.bold}System & Service Commands:${c.reset}
  0xagent start                Start 0xAgent platform in System Tray (background)
  0xagent start -f             Start 0xAgent dev server in foreground
  0xagent status               Show health, telemetry & active model
  0xagent config [key] [val]   Terminal configuration manager
  0xagent node probe [host]    Probe remote GPU Compute Node in LAN
  0xagent purge-vram           Force release GPU VRAM & stop workers
  0xagent update               Pull latest releases from GitHub & rebuild
  0xagent release [patch|min]  Automated release bump
  0xagent stop                 Terminate all running 0xAgent processes
  0xagent help                 Show this help manual
`);
      break;

    default: {
      // Default fallback: any string is treated as a prompt to execute in current workspace!
      let prompt = args.filter((a) => !a.startsWith('-')).join(' ');
      if (piped) prompt = prompt ? `${prompt}\n\n${piped}` : piped;
      const quiet = args.includes('--quiet') || args.includes('-q');
      const json = args.includes('--json');
      await runCliPrompt(prompt, { quiet, json });
      break;
    }
  }
}

main().catch((err) => {
  console.error(`${c.red}[ERR] Fatal CLI error:${c.reset}`, err);
  process.exit(1);
});


