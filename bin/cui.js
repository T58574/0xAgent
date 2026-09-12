/**
 * 0xAgent CUI — Character & Console User Interface
 * Comprehensive terminal interactive agent, execution runner, and daemon bridge.
 * Designed for direct CLI usage, Veron / script automation, and full CUI experience.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import https from 'node:https';
import http from 'node:http';
import { WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const USER_HOME = os.homedir();
const CONFIG_DIR = path.join(USER_HOME, '.0xagent');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Color & ANSI formatters
export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  bgDark: '\x1b[48;5;236m',
};

export class CuiClient {
  constructor(options = {}) {
    this.port = options.port || 3001;
    this.host = options.host || '127.0.0.1';
    this.protocol = options.protocol || 'https';
    this.wsProtocol = this.protocol === 'https' ? 'wss' : 'ws';
    this.token = options.token || '';
    this.workspaceDir = options.workspaceDir || process.cwd();
    this.sessionId = options.sessionId || null;
    this.ws = null;
    this.isQuiet = Boolean(options.quiet);
    this.isJson = Boolean(options.json);
    this.pendingConfirmations = new Map();
  }

  // Load persistent config
  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }
    } catch {}
    return {};
  }

  saveConfig(cfg) {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  // Health check probing both HTTPS and HTTP
  async probeServer() {
    const tryProtocol = async (proto) => {
      const module = proto === 'https' ? https : http;
      return new Promise((resolve) => {
        const req = module.request(
          {
            hostname: this.host,
            port: this.port,
            path: '/api/auth/status',
            method: 'GET',
            rejectUnauthorized: false,
            timeout: 1500,
          },
          (res) => {
            let data = '';
            res.on('data', (d) => (data += d));
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                resolve({ ok: res.statusCode === 200, parsed, protocol: proto });
              } catch {
                resolve({ ok: res.statusCode === 200, protocol: proto });
              }
            });
          }
        );
        req.on('error', () => resolve({ ok: false }));
        req.end();
      });
    };

    const resHttps = await tryProtocol('https');
    if (resHttps.ok) {
      this.protocol = 'https';
      this.wsProtocol = 'wss';
      return resHttps;
    }

    const resHttp = await tryProtocol('http');
    if (resHttp.ok) {
      this.protocol = 'http';
      this.wsProtocol = 'ws';
      return resHttp;
    }

    return { ok: false };
  }

  // Auto-supervisor: start 0xAgent backend in background if offline
  async ensureBackendRunning() {
    const initialProbe = await this.probeServer();
    if (initialProbe.ok) {
      return true;
    }

    if (!this.isQuiet) {
      console.log(`${c.yellow}[*] 0xAgent backend (:3001) is offline. Starting background service...${c.reset}`);
    }

    const isWin = process.platform === 'win32';
    const trayExe = path.join(PROJECT_ROOT, '0xAgent.exe');

    let child;
    if (isWin && fs.existsSync(trayExe)) {
      child = spawn(trayExe, [], {
        cwd: PROJECT_ROOT,
        detached: true,
        stdio: 'ignore',
      });
    } else {
      const devServerScript = path.join(PROJECT_ROOT, 'scripts', 'dev-server.cjs');
      if (!fs.existsSync(devServerScript)) {
        throw new Error(`Cannot locate backend launcher script at: ${devServerScript}`);
      }
      child = spawn(process.execPath, [devServerScript], {
        cwd: PROJECT_ROOT,
        detached: true,
        stdio: 'ignore',
        shell: false,
      });
    }
    child.unref();

    // Poll for healthy status for up to 15 seconds
    const start = Date.now();
    while (Date.now() - start < 15000) {
      await new Promise((r) => setTimeout(r, 400));
      const probe = await this.probeServer();
      if (probe.ok) {
        if (!this.isQuiet) {
          console.log(`${c.green}[✓] 0xAgent backend is online (${this.protocol}://127.0.0.1:${this.port})${c.reset}\n`);
        }
        return true;
      }
    }

    throw new Error('0xAgent backend failed to initialize within 15 seconds. Please check logs at ~/.0xagent/logs/server.log');
  }

  // REST API request helper
  async api(endpoint, method = 'GET', body = null) {
    const url = `${this.protocol}://${this.host}:${this.port}${endpoint}`;
    const module = this.protocol === 'https' ? https : http;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: endpoint,
        method,
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (this.token) {
        options.headers['Authorization'] = this.token;
      }

      const req = module.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error || `HTTP ${res.statusCode}: ${raw}`));
            }
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(raw);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
            }
          }
        });
      });

      req.on('error', (err) => reject(err));

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  }

  // Create or attach session bound to active working directory
  async initSession(title = 'CLI Workspace Session') {
    if (this.sessionId) return this.sessionId;

    try {
      const res = await this.api('/api/sessions', 'POST', {
        title,
        workspace_dir: this.workspaceDir,
      });
      this.sessionId = res.id || res.sessionId;
      return this.sessionId;
    } catch {
      // Fallback: generate local ID
      this.sessionId = `cli_${Date.now()}`;
      return this.sessionId;
    }
  }

  // Connect WebSocket stream
  async connectWebSocket(onEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    const wsUrl = `${this.wsProtocol}://${this.host}:${this.port}/ws${this.token ? `?token=${encodeURIComponent(this.token)}` : ''}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        rejectUnauthorized: false,
      });

      this.ws.on('open', () => {
        resolve(this.ws);
      });

      this.ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (onEvent) onEvent(parsed.event, parsed.payload);
        } catch {}
      });

      this.ws.on('error', (err) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(err);
        }
      });
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}

// -------------------------------------------------------------
// Terminal CUI Engine & Formatter
// -------------------------------------------------------------

export class TerminalCui {
  constructor(client) {
    this.client = client;
    this.isRenderingThinking = false;
    this.currentToolCard = null;
    this.isTurnActive = false;
    this.activeAssistantContent = '';
    this.activeToolOutputs = [];
    this.metrics = null;
    this.rl = null;
  }

  renderBanner(cfg = {}, activePersona = null) {
    const width = 64;
    const modelStr = cfg.selectedModel || cfg.model_name || 'auto / local';
    const personaStr = activePersona?.metadata?.name || '0xAgent Core';
    const wsStr = path.basename(this.client.workspaceDir) || this.client.workspaceDir;

    console.log(`
${c.cyan}┌── 0xAgent CUI v0.1.20 ───────────────────────────────────────┐${c.reset}
${c.cyan}│${c.reset} ${c.bold}Model:${c.reset}     ${c.green}${modelStr.padEnd(23)}${c.reset} ${c.bold}Persona:${c.reset}   ${c.magenta}${personaStr.padEnd(17)}${c.reset} ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.bold}Workspace:${c.reset} ${c.yellow}${wsStr.padEnd(23)}${c.reset} ${c.bold}Mode:${c.reset}      ${c.white}${(cfg.permissionPreset || 'prompt').padEnd(17)}${c.reset} ${c.cyan}│${c.reset}
${c.cyan}│${c.reset} ${c.dim}Type /help for slash commands, /clear to reset context${c.reset}        ${c.cyan}│${c.reset}
${c.cyan}└──────────────────────────────────────────────────────────────┘${c.reset}
`);
  }

  renderHelp() {
    console.log(`
${c.bold}0xAgent CUI Commands & Shortcuts:${c.reset}
  ${c.cyan}/settings${c.reset}             Open interactive settings menu (auto-open browser, permissions, etc.)
  ${c.cyan}/model [name]${c.reset}         View or switch active model (local GGUF / cloud) & reasoning effort
  ${c.cyan}/persona [name]${c.reset}       View or switch active persona (SOUL.md)
  ${c.cyan}/server [action]${c.reset}      Manage local llama-server: ${c.yellow}start${c.reset}, ${c.yellow}stop${c.reset}, ${c.yellow}status${c.reset}, ${c.yellow}logs${c.reset}, ${c.yellow}purge${c.reset}
  ${c.cyan}/config [key] [val]${c.reset}   Inspect or set config parameter (e.g. /config preset unrestricted)
  ${c.cyan}/status${c.reset}               Show hardware, GPU VRAM, active session and telemetry
  ${c.cyan}/compact${c.reset}              Compact conversation context and prune tokens
  ${c.cyan}/clear, /reset${c.reset}        Start fresh conversation & clear context history
  ${c.cyan}/help${c.reset}                 Show this command manual
  ${c.cyan}/exit, /quit${c.reset}          Exit 0xAgent CUI

${c.dim}Tips:
- Execute from ANY project directory to bind agent to that project.
- Use Ctrl+C to abort active agent thinking/generation.
- End a prompt line with '\\' for multiline text entry.${c.reset}
`);
  }

  // Format and execute a single prompt turn (streaming + tool calls + interactive confirmation)
  async executePromptTurn(userPrompt, options = {}) {
    const sessionId = await this.client.initSession();
    this.isTurnActive = true;
    this.activeAssistantContent = '';
    this.activeToolOutputs = [];
    this.isRenderingThinking = false;
    this.metrics = null;

    return new Promise(async (resolve, reject) => {
      let turnResolved = false;

      const finishTurn = () => {
        if (turnResolved) return;
        turnResolved = true;
        this.isTurnActive = false;
        if (this.isRenderingThinking) {
          process.stdout.write(`${c.reset}\n${c.gray}╰─────────────────────────────────────────────────────${c.reset}\n\n`);
          this.isRenderingThinking = false;
        }
        resolve({
          content: this.activeAssistantContent,
          tools: this.activeToolOutputs,
          metrics: this.metrics,
        });
      };

      // Connect or reuse WebSocket
      await this.client.connectWebSocket((event, payload) => {
        if (payload?.sessionId && payload.sessionId !== sessionId) {
          return;
        }

        switch (event) {
          case 'agent-token-stream': {
            const token = payload.token || '';
            this.metrics = {
              tokensPerSec: payload.tokensPerSec,
              tokenCount: payload.tokenCount,
              contextUsed: payload.contextUsed,
              contextMax: payload.contextMax,
              modelName: payload.modelName,
            };

            if (options.quiet) {
              // In quiet mode: only output content outside of thinking
              if (token.includes('<think>')) this.isRenderingThinking = true;
              if (token.includes('</think>')) {
                this.isRenderingThinking = false;
                return;
              }
              if (!this.isRenderingThinking) {
                process.stdout.write(token.replace(/<\/?think>/g, ''));
              }
              return;
            }

            // Normal CUI mode: render thinking in dim italics, content normally
            if (token.includes('<think>')) {
              if (!this.isRenderingThinking) {
                process.stdout.write(`\n${c.gray}╭─ Thinking ──────────────────────────────────────────${c.reset}\n${c.gray}${c.italic}`);
                this.isRenderingThinking = true;
              }
              const clean = token.replace(/<think>/g, '');
              if (clean) process.stdout.write(clean);
              return;
            }

            if (token.includes('</think>')) {
              const parts = token.split('</think>');
              if (parts[0]) process.stdout.write(parts[0]);
              process.stdout.write(`${c.reset}\n${c.gray}╰─────────────────────────────────────────────────────${c.reset}\n\n`);
              this.isRenderingThinking = false;
              if (parts[1]) process.stdout.write(parts[1]);
              return;
            }

            process.stdout.write(token);
            this.activeAssistantContent += token;
            break;
          }

          case 'agent-tools-updated': {
            if (options.quiet) return;
            const tools = payload.tools || [];
            for (const tc of tools) {
              console.log(`\n${c.cyan}╭─ [⚙ Tool Call: ${c.bold}${tc.name}${c.reset}${c.cyan}] ──────────────────────────────${c.reset}`);
              let argsStr = tc.arguments || '';
              try {
                const parsed = JSON.parse(argsStr);
                argsStr = Object.entries(parsed)
                  .map(([k, v]) => `  ${c.gray}${k}:${c.reset} ${typeof v === 'string' ? v.slice(0, 120) : JSON.stringify(v)}`)
                  .join('\n');
              } catch {}
              console.log(argsStr || `  ${c.gray}(no arguments)${c.reset}`);
              console.log(`${c.cyan}╰─────────────────────────────────────────────────────${c.reset}`);
            }
            break;
          }

          case 'agent-tool-status-changed': {
            const { tool_id, status, output } = payload;
            if (options.quiet) return;

            if (status === 'completed') {
              let preview = output ? String(output).trim() : '';
              const lines = preview.split('\n');
              if (lines.length > 8) {
                preview = lines.slice(0, 8).join('\n') + `\n${c.gray}... [${lines.length - 8} lines truncated]${c.reset}`;
              } else if (preview.length > 500) {
                preview = preview.slice(0, 500) + `... [truncated]`;
              }
              console.log(`${c.green}  [✓ Completed]${c.reset} ${c.gray}${preview.replace(/\n/g, '\n    ')}${c.reset}`);
              this.activeToolOutputs.push({ tool_id, status, output });
            } else if (status === 'error') {
              console.log(`${c.red}  [✗ Failed]${c.reset} ${c.red}${String(output || 'Tool execution error')}${c.reset}`);
              this.activeToolOutputs.push({ tool_id, status, output });
            } else if (status === 'rejected') {
              console.log(`${c.yellow}  [⊘ Rejected by user]${c.reset}`);
            } else if (status === 'running') {
              console.log(`${c.yellow}  [⚙ Executing in workspace...]${c.reset}`);
            }
            break;
          }

          case 'agent-status-changed': {
            const status = payload.status;
            if (status === 'waiting_approval') {
              // Interactive approval gate
              this.handleInteractiveApproval(sessionId, payload);
            } else if (status === 'idle') {
              if (this.metrics && !options.quiet) {
                const { tokenCount, tokensPerSec, contextUsed, contextMax, modelName } = this.metrics;
                const tokRate = tokensPerSec ? ` | ${tokensPerSec} tok/s` : '';
                const ctx = contextMax ? ` | Context: ${Math.round(contextUsed / 1000)}k/${Math.round(contextMax / 1000)}k` : '';
                console.log(`\n${c.dim}[Tokens: ${tokenCount}${tokRate}${ctx} | Model: ${modelName || 'local'}]${c.reset}\n`);
              }
              finishTurn();
            }
            break;
          }

          case 'agent-error': {
            console.error(`\n${c.red}[!] ${payload.message || 'Agent error encountered'}${c.reset}\n`);
            finishTurn();
            break;
          }
        }
      });

      // Send prompt turn to backend
      try {
        // Save user message to session
        const userMsg = {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: userPrompt,
          timestamp: Date.now(),
        };

        const session = await this.client.api(`/api/sessions/${sessionId}`).catch(() => ({ messages: [] }));
        const messages = session.messages || [];
        messages.push(userMsg);

        await this.client.api(`/api/sessions/${sessionId}/save`, 'POST', {
          messages,
          workspace_dir: this.client.workspaceDir,
        });

        // Trigger agent execution loop
        await this.client.api('/api/send-message', 'POST', { sessionId });
      } catch (err) {
        console.error(`${c.red}[ERR] Failed to dispatch prompt:${c.reset}`, err.message);
        finishTurn();
      }
    });
  }

  // Interactive approval gate for mutating tools in prompt preset
  async handleInteractiveApproval(sessionId, payload) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = `\n${c.yellow}${c.bold}[?] Tool execution requires approval. Allow? [y/n/a(always)]: ${c.reset}`;
    rl.question(question, async (ans) => {
      rl.close();
      const trimmed = ans.trim().toLowerCase();
      const approve = trimmed === 'y' || trimmed === 'yes' || trimmed === 'a' || trimmed === '';

      if (trimmed === 'a') {
        // Switch preset to unrestricted
        const cfg = this.client.loadConfig();
        cfg.permissionPreset = 'unrestricted';
        this.client.saveConfig(cfg);
        console.log(`${c.green}[✓] Switched security preset to 'unrestricted'.${c.reset}`);
      }

      await this.client.api('/api/respond-to-tool', 'POST', {
        sessionId,
        toolCallId: payload.tool_id || payload.toolCallId || 'all',
        approve,
      }).catch(() => {});
    });
  }

  // REPL Interactive Session
  async startRepl() {
    await this.client.ensureBackendRunning();
    const cfg = this.client.loadConfig();
    const personasRes = await this.client.api('/api/personas').catch(() => []);
    const activePersona = Array.isArray(personasRes) ? personasRes.find((p) => p.is_active) : null;

    this.renderBanner(cfg, activePersona);

    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      const prompt = new InteractivePrompt({
        cui: this,
        client: this.client,
        prompt: `> `,
        onLine: async (line) => {
          prompt.pause();
          try {
            await this.executePromptTurn(line);
          } catch (err) {
            console.error(`\n${c.red}[ERR] Turn execution failed:${c.reset}`, err.message);
          } finally {
            prompt.resume();
            prompt.prompt();
          }
        },
        onSlashCommand: async (cmdStr) => {
          prompt.pause();
          await this.executeSlashCommand(cmdStr, prompt, activePersona);
          prompt.resume();
          prompt.prompt();
        },
        onSigInt: async () => {
          if (this.isTurnActive && this.client.sessionId) {
            console.log(`\n${c.yellow}[!] Cancelling active agent turn...${c.reset}`);
            await this.client.api('/api/cancel-agent', 'POST', { sessionId: this.client.sessionId }).catch(() => {});
            this.isTurnActive = false;
            prompt.prompt();
          } else {
            prompt.close();
            console.log(`\n${c.cyan}Exiting 0xAgent CUI.${c.reset}`);
            process.exit(0);
          }
        },
      });

      this.activePrompt = prompt;
      prompt.start();
    } else {
      this.startFallbackRepl(cfg, activePersona);
    }
  }

  startFallbackRepl(cfg, activePersona) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `> `,
    });
    this.rl = rl;

    let multilineBuffer = '';
    rl.prompt();

    rl.on('line', async (line) => {
      const raw = line.trim();
      if (raw.endsWith('\\')) {
        multilineBuffer += raw.slice(0, -1) + '\n';
        rl.setPrompt(`... `);
        rl.prompt();
        return;
      }

      const input = (multilineBuffer + raw).trim();
      multilineBuffer = '';
      rl.setPrompt(`> `);

      if (!input) {
        rl.prompt();
        return;
      }

      if (input.startsWith('/')) {
        await this.executeSlashCommand(input, rl, activePersona);
        return;
      }

      rl.pause();
      try {
        await this.executePromptTurn(input);
      } catch (err) {
        console.error(`${c.red}[ERR] Turn execution failed:${c.reset}`, err.message);
      } finally {
        rl.resume();
        rl.prompt();
      }
    });

    rl.on('SIGINT', async () => {
      if (this.isTurnActive && this.client.sessionId) {
        console.log(`\n${c.yellow}[!] Cancelling active agent turn...${c.reset}`);
        await this.client.api('/api/cancel-agent', 'POST', { sessionId: this.client.sessionId }).catch(() => {});
        this.isTurnActive = false;
        rl.prompt();
      } else {
        console.log(`\n${c.cyan}Exiting 0xAgent CUI.${c.reset}`);
        rl.close();
        process.exit(0);
      }
    });
  }

  async executeSlashCommand(input, promptOrRl, activePersona) {
    const parts = input.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const cmdArgs = parts.slice(1);

    switch (cmd) {
      case '':
      case 'menu':
      case 'commands': {
        promptOrRl.pause();
        const picker = new CommandPickerTui(
          this.client,
          (chosen) => {
            promptOrRl.resume();
            if (chosen) {
              this.executeSlashCommand(chosen, promptOrRl, activePersona);
            } else {
              promptOrRl.prompt();
            }
          },
          () => {
            promptOrRl.resume();
            promptOrRl.prompt();
          }
        );
        picker.start();
        return;
      }

      case 'settings': {
        promptOrRl.pause();
        const tui = new SettingsTui(this.client, () => {
          promptOrRl.resume();
          promptOrRl.prompt();
        });
        tui.start();
        return;
      }

      case 'model': {
        if (cmdArgs.length === 0) {
          promptOrRl.pause();
          const tui = new ModelTui(this.client, () => {
            promptOrRl.resume();
            promptOrRl.prompt();
          });
          tui.start();
          return;
        } else {
          const target = cmdArgs.join(' ');
          const currentCfg = this.client.loadConfig();
          currentCfg.selectedModel = target;
          currentCfg.model_name = target;
          this.client.saveConfig(currentCfg);
          await this.client.api('/api/update-config', 'POST', { selectedModel: target, model_name: target }).catch(() => {});
          console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Active model updated to:${c.reset} ${c.bold}${target}${c.reset}\n`);
        }
        break;
      }

      case 'persona': {
        if (cmdArgs.length === 0) {
          promptOrRl.pause();
          const tui = new PersonaTui(this.client, () => {
            promptOrRl.resume();
            promptOrRl.prompt();
          });
          tui.start();
          return;
        } else {
          const targetId = cmdArgs[0];
          try {
            await this.client.api(`/api/personas/${targetId}/activate`, 'POST');
            console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Persona switched to '${targetId}'.${c.reset}\n`);
          } catch (err) {
            console.log(`  ${c.dim}└${c.reset} ${c.red}[!] Failed to activate persona:${c.reset} ${err.message}\n`);
          }
        }
        break;
      }

      case 'compact': {
        console.log(`${c.yellow}[*] Running conversation context compaction...${c.reset}`);
        if (this.client.sessionId) {
          await this.client.api(`/api/sessions/${this.client.sessionId}/compact`, 'POST', {}).catch(() => {});
        }
        console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Conversation history pruned and compacted.${c.reset}\n`);
        break;
      }

      case 'clear':
      case 'reset': {
        this.client.sessionId = null;
        console.clear();
        this.renderBanner(this.client.loadConfig(), activePersona);
        console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Conversation context cleared. New session started.${c.reset}\n`);
        break;
      }

      case 'status': {
        const health = await this.client.api('/api/server-health').catch(() => ({ ok: false }));
        const llama = await this.client.api('/api/server-status').catch(() => ({ running: false }));
        const currentCfg = this.client.loadConfig();
        const ls = currentCfg.local_server || {};
        console.log(`
${c.bold}System Telemetry & Status:${c.reset}
  Backend Server (:3001)   : ${c.green}[ONLINE]${c.reset} (${this.client.protocol})
  Llama Inference Server   : ${llama.running ? `${c.green}[ONLINE :${llama.port || 11434}]${c.reset}` : `${c.yellow}[OFFLINE / IDLE]${c.reset}`}
  Model Loaded             : ${c.cyan}${llama.modelName || currentCfg.selectedModel || currentCfg.model_name || 'None'}${c.reset}
  Model Path               : ${c.gray}${llama.modelPath || ls.model_path || 'None'}${c.reset}
  Workspace Directory      : ${c.cyan}${this.client.workspaceDir}${c.reset}
  GPU Offload Layers       : ${c.cyan}${ls.gpu_layers ?? 99}${c.reset} (99 = full VRAM offload)
  Context Window (Tokens)  : ${c.cyan}${ls.ctx_size || 16384}${c.reset}
  Flash Attention          : ${ls.flash_attn !== false ? `${c.green}Enabled (-fa on)${c.reset}` : `${c.yellow}Disabled${c.reset}`}
  CPU Threads              : ${ls.threads || 8}
  Auto Open Browser        : ${currentCfg.auto_open_browser ? `${c.green}[ENABLED]${c.reset}` : `${c.yellow}[DISABLED]${c.reset}`}
  Agent Mode (Preset)      : ${c.cyan}${currentCfg.permissionPreset || currentCfg.permission_preset || 'unrestricted'}${c.reset}
  Reasoning Effort         : ${c.cyan}${currentCfg.reasoning_effort || 'auto'}${c.reset}
  Active Session ID        : ${c.gray}${this.client.sessionId || 'None (starts on first query)'}${c.reset}
`);
        break;
      }

      case 'server': {
        const sub = (cmdArgs[0] || 'status').toLowerCase();
        const currentCfg = this.client.loadConfig();
        const ls = currentCfg.local_server || {};

        if (sub === 'status') {
          const st = await this.client.api('/api/server-status').catch(() => ({ running: false }));
          const hl = await this.client.api('/api/server-health').catch(() => ({ ok: false }));
          console.log(`\n${c.bold}Local Inference Server (llama-server.exe):${c.reset}`);
          console.log(`  Process       : ${st.running ? `${c.green}[RUNNING]${c.reset}` : `${c.yellow}[STOPPED / IDLE]${c.reset}`}`);
          console.log(`  Health Check  : ${hl.ok ? `${c.green}[HEALTHY]${c.reset}` : `${c.yellow}[OFFLINE]${c.reset}`}`);
          console.log(`  Endpoint      : http://${ls.host || '127.0.0.1'}:${ls.port || 11434}/v1`);
          console.log(`  Loaded Model  : ${c.cyan}${st.modelName || currentCfg.selectedModel || 'None'}${c.reset}`);
          console.log(`  Model Path    : ${c.gray}${st.modelPath || ls.model_path || 'None'}${c.reset}`);
          console.log(`  GPU Layers    : ${c.cyan}${ls.gpu_layers ?? 99}${c.reset} (99 = full VRAM offload)`);
          console.log(`  Context Size  : ${c.cyan}${ls.ctx_size || 16384}${c.reset} tokens`);
          console.log(`  Flash Attn    : ${ls.flash_attn !== false ? `${c.green}Enabled (-fa on)${c.reset}` : `${c.yellow}Disabled${c.reset}`}`);
          console.log(`  CPU Threads   : ${ls.threads || 8}`);
          console.log(`\n${c.dim}Available commands: /server start, /server stop, /server restart, /server purge, /server logs${c.reset}\n`);
        } else if (sub === 'start') {
          console.log(`${c.yellow}[*] Starting local llama-server with model: ${currentCfg.selectedModel || ls.model_path || 'auto'}...${c.reset}`);
          try {
            const res = await this.client.api('/api/start-local-server', 'POST', {
              modelPath: ls.model_path,
              host: ls.host || '127.0.0.1',
              port: ls.port || 11434,
            });
            console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Server started successfully:${c.reset} PID ${res.pid} on http://${res.host}:${res.port}/v1\n`);
          } catch (err) {
            console.log(`  ${c.dim}└${c.reset} ${c.red}[!] Server start error:${c.reset} ${err.message}\n`);
          }
        } else if (sub === 'stop') {
          console.log(`${c.yellow}[*] Stopping local llama-server process...${c.reset}`);
          await this.client.api('/api/stop-local-server', 'POST', {}).catch(() => {});
          console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Local inference server stopped.${c.reset}\n`);
        } else if (sub === 'restart') {
          console.log(`${c.yellow}[*] Restarting local llama-server...${c.reset}`);
          await this.client.api('/api/stop-local-server', 'POST', {}).catch(() => {});
          try {
            const res = await this.client.api('/api/start-local-server', 'POST', {
              modelPath: ls.model_path,
              host: ls.host || '127.0.0.1',
              port: ls.port || 11434,
            });
            console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Server restarted successfully:${c.reset} PID ${res.pid} on http://${res.host}:${res.port}/v1\n`);
          } catch (err) {
            console.log(`  ${c.dim}└${c.reset} ${c.red}[!] Server restart error:${c.reset} ${err.message}\n`);
          }
        } else if (sub === 'purge') {
          console.log(`${c.yellow}[*] Purging GPU VRAM & terminating inference processes...${c.reset}`);
          const res = await this.client.api('/api/purge-vram', 'POST', {}).catch(() => ({ killedCount: 0 }));
          console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] GPU VRAM released.${c.reset} (${res.killedCount || 0} processes terminated)\n`);
        } else if (sub === 'logs') {
          const logData = await this.client.api('/api/server-logs').catch(() => ({ logs: [] }));
          const lines = logData.logs || [];
          console.log(`\n${c.bold}Recent Server Logs (last ${Math.min(lines.length, 25)} lines):${c.reset}`);
          lines.slice(-25).forEach((l) => console.log(`  ${c.gray}${l}${c.reset}`));
          console.log('');
        } else {
          console.log(`Usage: /server <start|stop|restart|status|logs|purge>\n`);
        }
        break;
      }

      case 'config': {
        if (cmdArgs.length === 0) {
          promptOrRl.pause();
          const tui = new SettingsTui(this.client, () => {
            promptOrRl.resume();
            promptOrRl.prompt();
          });
          tui.start();
          return;
        } else if (cmdArgs.length === 1) {
          const key = cmdArgs[0];
          const currentCfg = this.client.loadConfig();
          console.log(`  ${key}: ${JSON.stringify(currentCfg[key])}\n`);
        } else {
          const key = cmdArgs[0];
          let val = cmdArgs.slice(1).join(' ');
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (!isNaN(Number(val))) val = Number(val);

          const currentCfg = this.client.loadConfig();
          currentCfg[key] = val;
          this.client.saveConfig(currentCfg);
          await this.client.api('/api/update-config', 'POST', { [key]: val }).catch(() => {});
          console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Updated ${key} = ${JSON.stringify(val)}${c.reset}\n`);
        }
        break;
      }

      case 'help': {
        this.renderHelp();
        break;
      }

      case 'exit':
      case 'quit': {
        console.log(`${c.cyan}Exiting 0xAgent CUI.${c.reset}`);
        promptOrRl.close();
        process.exit(0);
        return;
      }

      default: {
        console.log(`${c.red}[!] Unknown slash command: /${cmd}${c.reset}. Type / for interactive menu or /help for manual.\n`);
        break;
      }
    }

    promptOrRl.prompt();
  }
}

// -------------------------------------------------------------
// Interactive CUI Components (Settings, Model, Commands, Personas)
// -------------------------------------------------------------

export function stripAnsi(str) {
  return String(str || '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

export function visibleLength(str) {
  return stripAnsi(str).length;
}

export function padLineToBorder(content, totalWidth = 76) {
  const plain = stripAnsi(content);
  const needed = Math.max(0, totalWidth - 2 - plain.length);
  return `${c.cyan}│${c.reset}${content}${' '.repeat(needed)}${c.cyan}│${c.reset}`;
}

export function wrapText(text, maxLen = 70) {
  const words = String(text || '').split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur ? cur + ' ' + w : w).length <= maxLen) {
      cur = cur ? cur + ' ' + w : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [''];
}

export function clearRenderedLines(count) {
  if (count <= 0) return;
  readline.moveCursor(process.stdout, 0, -count);
  readline.cursorTo(process.stdout, 0);
  readline.clearScreenDown(process.stdout);
}

// -------------------------------------------------------------
// Real-Time Interactive Slash Dropdown & Prompt
// -------------------------------------------------------------

export class InteractivePrompt {
  constructor(options = {}) {
    this.client = options.client;
    this.cui = options.cui;
    this.onLine = options.onLine;
    this.onSlashCommand = options.onSlashCommand;
    this.onSigInt = options.onSigInt;
    this.promptText = options.prompt || `> `;
    this.inputBuffer = '';
    this.cursorPos = 0;
    this.history = [];
    this.historyIdx = -1;
    this.slashSelectedIndex = 0;
    this.renderedDropdownLines = 0;
    this.isRaw = false;
    this.isPaused = false;
    this.boundKeypress = this.handleKeypress.bind(this);

    this.commands = [
      { cmd: '/model', label: '/model', desc: 'Switch active local GGUF model & reasoning effort' },
      { cmd: '/settings', label: '/settings', desc: 'Configure settings (GPU layers, ctx size, auto-open browser)' },
      { cmd: '/persona', label: '/persona', desc: 'Switch active agent persona profile' },
      { cmd: '/server', label: '/server', desc: 'Manage local llama-server (start, stop, restart, purge)' },
      { cmd: '/status', label: '/status', desc: 'Hardware, GPU VRAM & active session telemetry' },
      { cmd: '/compact', label: '/compact', desc: 'Compact conversation context & prune tokens' },
      { cmd: '/clear', label: '/clear', desc: 'Clear session history & restart context' },
      { cmd: '/help', label: '/help', desc: 'Show command manual and shortcuts' },
      { cmd: '/exit', label: '/exit', desc: 'Exit 0xAgent CUI' },
    ];
  }

  getPromptWidth() {
    return visibleLength(this.promptText);
  }

  getMatchingCommands() {
    if (!this.inputBuffer.startsWith('/')) return [];
    const q = this.inputBuffer.slice(1).toLowerCase().trim();
    if (!q) return this.commands;
    return this.commands.filter(
      (c) => c.cmd.slice(1).toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
    );
  }

  start() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      return;
    }
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    this.isRaw = true;
    process.stdin.on('keypress', this.boundKeypress);
    this.prompt();
  }

  pause() {
    this.isPaused = true;
    this.clearDropdown();
    if (this.isRaw) {
      try {
        process.stdin.removeListener('keypress', this.boundKeypress);
        process.stdin.setRawMode(false);
      } catch {}
      this.isRaw = false;
    }
  }

  resume() {
    this.isPaused = false;
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      this.isRaw = true;
      process.stdin.on('keypress', this.boundKeypress);
    }
  }

  close() {
    this.clearDropdown();
    if (this.isRaw) {
      try {
        process.stdin.removeListener('keypress', this.boundKeypress);
        process.stdin.setRawMode(false);
      } catch {}
      this.isRaw = false;
    }
  }

  prompt() {
    this.inputBuffer = '';
    this.cursorPos = 0;
    this.historyIdx = -1;
    this.slashSelectedIndex = 0;
    this.clearDropdown();
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(this.promptText);
  }

  clearDropdown() {
    if (this.renderedDropdownLines > 0) {
      readline.moveCursor(process.stdout, 0, 1);
      readline.cursorTo(process.stdout, 0);
      readline.clearScreenDown(process.stdout);
      readline.moveCursor(process.stdout, 0, -1);
      readline.cursorTo(process.stdout, this.getPromptWidth() + this.cursorPos);
      this.renderedDropdownLines = 0;
    }
  }

  renderLineAndDropdown() {
    this.clearDropdown();

    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(this.promptText + this.inputBuffer);
    const targetCol = this.getPromptWidth() + this.cursorPos;
    readline.cursorTo(process.stdout, targetCol);

    if (this.inputBuffer.startsWith('/')) {
      const matching = this.getMatchingCommands();
      if (matching.length > 0) {
        if (this.slashSelectedIndex >= matching.length) {
          this.slashSelectedIndex = 0;
        }
        const maxDisplay = 7;
        const slice = matching.slice(0, maxDisplay);
        const width = Math.min(process.stdout.columns || 68, 68);
        const divider = `${c.dim}${'─'.repeat(width)}${c.reset}`;

        const dropLines = [];
        dropLines.push(divider);
        slice.forEach((item, idx) => {
          const isSel = idx === this.slashSelectedIndex;
          const ptr = isSel ? `${c.cyan}>${c.reset}` : ' ';
          const cmdFmt = isSel ? `${c.bold}${c.cyan}${item.label.padEnd(16)}${c.reset}` : `${item.label.padEnd(16)}`;
          const descFmt = isSel ? `${c.bold}${c.white}${item.desc}${c.reset}` : `${c.dim}${item.desc}${c.reset}`;
          dropLines.push(`${ptr} ${cmdFmt} ${descFmt}`);
        });
        if (matching.length > maxDisplay) {
          dropLines.push(`  ${c.dim}↓ ${matching.length - maxDisplay} more...${c.reset}`);
        }
        dropLines.push(divider);
        dropLines.push(`${c.dim}↑/↓ Navigate · enter Select · tab Complete · esc Cancel${c.reset}`);

        process.stdout.write('\n' + dropLines.join('\n'));
        this.renderedDropdownLines = dropLines.length + 1;

        readline.moveCursor(process.stdout, 0, -this.renderedDropdownLines);
        readline.cursorTo(process.stdout, targetCol);
      }
    }
  }

  handleKeypress(str, key) {
    if (!key || this.isPaused) return;

    if (key.ctrl && key.name === 'c') {
      if (this.onSigInt) this.onSigInt();
      return;
    }

    if (key.name === 'escape') {
      if (this.renderedDropdownLines > 0) {
        this.clearDropdown();
        this.inputBuffer = '';
        this.cursorPos = 0;
        this.renderLineAndDropdown();
        return;
      }
    }

    if (key.name === 'up') {
      if (this.inputBuffer.startsWith('/')) {
        const matching = this.getMatchingCommands();
        if (matching.length > 0) {
          this.slashSelectedIndex = (this.slashSelectedIndex - 1 + matching.length) % matching.length;
          this.renderLineAndDropdown();
          return;
        }
      } else if (this.history.length > 0) {
        if (this.historyIdx < this.history.length - 1) {
          this.historyIdx++;
          this.inputBuffer = this.history[this.history.length - 1 - this.historyIdx];
          this.cursorPos = this.inputBuffer.length;
          this.renderLineAndDropdown();
        }
        return;
      }
    }

    if (key.name === 'down') {
      if (this.inputBuffer.startsWith('/')) {
        const matching = this.getMatchingCommands();
        if (matching.length > 0) {
          this.slashSelectedIndex = (this.slashSelectedIndex + 1) % matching.length;
          this.renderLineAndDropdown();
          return;
        }
      } else if (this.historyIdx > 0) {
        this.historyIdx--;
        this.inputBuffer = this.history[this.history.length - 1 - this.historyIdx];
        this.cursorPos = this.inputBuffer.length;
        this.renderLineAndDropdown();
        return;
      } else if (this.historyIdx === 0) {
        this.historyIdx = -1;
        this.inputBuffer = '';
        this.cursorPos = 0;
        this.renderLineAndDropdown();
        return;
      }
    }

    if (key.name === 'tab') {
      if (this.inputBuffer.startsWith('/')) {
        const matching = this.getMatchingCommands();
        if (matching.length > 0) {
          const sel = matching[this.slashSelectedIndex];
          this.inputBuffer = sel.cmd + ' ';
          this.cursorPos = this.inputBuffer.length;
          this.clearDropdown();
          this.renderLineAndDropdown();
          return;
        }
      }
    }

    if (key.name === 'left') {
      if (this.cursorPos > 0) {
        this.cursorPos--;
        this.renderLineAndDropdown();
      }
      return;
    }
    if (key.name === 'right') {
      if (this.cursorPos < this.inputBuffer.length) {
        this.cursorPos++;
        this.renderLineAndDropdown();
      }
      return;
    }

    if (key.name === 'return') {
      const trimmed = this.inputBuffer.trim();
      this.clearDropdown();
      process.stdout.write('\n');

      if (this.inputBuffer.startsWith('/') && !this.inputBuffer.includes(' ')) {
        const matching = this.getMatchingCommands();
        const chosen = matching[this.slashSelectedIndex]?.cmd || trimmed;
        this.inputBuffer = '';
        this.cursorPos = 0;
        if (this.onSlashCommand) this.onSlashCommand(chosen);
        return;
      }

      if (trimmed.startsWith('/')) {
        this.inputBuffer = '';
        this.cursorPos = 0;
        if (this.onSlashCommand) this.onSlashCommand(trimmed);
        return;
      }

      if (trimmed) {
        this.history.push(trimmed);
        this.historyIdx = -1;
        this.inputBuffer = '';
        this.cursorPos = 0;
        if (this.onLine) this.onLine(trimmed);
        return;
      }

      this.prompt();
      return;
    }

    if (key.name === 'backspace') {
      if (this.cursorPos > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos - 1) + this.inputBuffer.slice(this.cursorPos);
        this.cursorPos--;
        this.slashSelectedIndex = 0;
        this.renderLineAndDropdown();
      }
      return;
    }

    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + str + this.inputBuffer.slice(this.cursorPos);
      this.cursorPos++;
      this.slashSelectedIndex = 0;
      this.renderLineAndDropdown();
    }
  }
}

// -------------------------------------------------------------
// Interactive Settings TUI (Matching AGY CLI Screenshot 3)
// -------------------------------------------------------------

export class SettingsTui {
  constructor(client, onDone) {
    this.client = client;
    this.onDone = onDone;
    this.cfg = client.loadConfig();
    this.filter = '';
    this.selectedIndex = 0;
    this.isRaw = false;
    this.renderedLinesCount = 0;
    this.boundKeypress = this.handleKeypress.bind(this);

    this.settings = [
      {
        key: 'gpu_layers',
        label: 'GPU Offload Layers',
        type: 'select',
        isServerConfig: true,
        options: [99, 64, 32, 16, 0],
        default: 99,
        format: (v) => (v === 99 ? '99 (All on GPU)' : v === 0 ? '0 (CPU only)' : `${v} layers`),
        desc: 'Number of model layers offloaded to GPU VRAM (99 = full offload to VRAM).',
      },
      {
        key: 'ctx_size',
        label: 'Context Window',
        type: 'select',
        isServerConfig: true,
        options: [4096, 8192, 16384, 32768, 65536],
        default: 16384,
        format: (v) => `${v} tokens`,
        desc: 'Context token limit allocated for local llama-server KV cache.',
      },
      {
        key: 'flash_attn',
        label: 'Flash Attention',
        type: 'boolean',
        isServerConfig: true,
        default: true,
        desc: 'Hardware Flash Attention (-fa on) for high-speed inference on modern GPUs.',
      },
      {
        key: 'threads',
        label: 'CPU Threads',
        type: 'select',
        isServerConfig: true,
        options: [4, 6, 8, 12, 16],
        default: 8,
        desc: 'CPU compute threads for prompt processing and generation.',
      },
      {
        key: 'port',
        label: 'Inference Port',
        type: 'select',
        isServerConfig: true,
        options: [11434, 8080, 5001],
        default: 11434,
        desc: 'Port where local llama-server listens for OpenAI-compatible /v1 requests.',
      },
      {
        key: 'auto_open_browser',
        label: 'Auto Open Browser',
        type: 'boolean',
        default: false,
        desc: 'Automatically open 0xAgent Web-IDE in your default browser on startup.',
      },
      {
        key: 'permission_preset',
        label: 'Agent Mode (Permission)',
        type: 'select',
        options: ['unrestricted', 'prompt'],
        default: 'unrestricted',
        desc: "Security guard policy: 'unrestricted' executes edits autonomously, 'prompt' asks approval.",
      },
      {
        key: 'planning_mode',
        label: 'Planning Mode',
        type: 'boolean',
        default: true,
        desc: 'Require the agent to formulate a step-by-step plan before making workspace modifications.',
      },
      {
        key: 'reasoning_effort',
        label: 'Reasoning Effort',
        type: 'select',
        options: ['auto', 'low', 'medium', 'high'],
        default: 'auto',
        desc: 'Reasoning and Chain-of-Thought budget allocation for local and cloud models.',
      },
      {
        key: 'temperature',
        label: 'Sampling Temperature',
        type: 'select',
        options: [0.2, 0.5, 0.7, 0.9, 1.0],
        default: 0.7,
        desc: 'Sampling temperature for model output (lower is deterministic, higher is creative).',
      },
      {
        key: 'language',
        label: 'Language',
        type: 'select',
        options: ['en', 'ru'],
        default: 'en',
        desc: 'Interface and CUI localization language (en / ru).',
      },
      {
        key: 'active_theme',
        label: 'Active Theme',
        type: 'select',
        options: ['graphite', 'light'],
        default: 'graphite',
        desc: 'Interface visual theme: dark high-contrast Graphite or clean daylight Light.',
      },
    ];
  }

  getFilteredSettings() {
    if (!this.filter.trim()) return this.settings;
    const q = this.filter.toLowerCase().trim();
    return this.settings.filter(
      (s) => s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)
    );
  }

  getValue(item) {
    if (item.isServerConfig) {
      const ls = this.cfg.local_server || {};
      const val = ls[item.key];
      if (val !== undefined && val !== null) return val;
      return item.default;
    }
    const val = this.cfg[item.key];
    if (val !== undefined && val !== null) return val;
    return item.default;
  }

  formatValue(item) {
    const val = this.getValue(item);
    if (item.type === 'boolean') {
      return val ? `${c.green}true${c.reset}` : `${c.yellow}false${c.reset}`;
    }
    if (item.format) {
      return `${c.cyan}${item.format(val)}${c.reset}`;
    }
    return `${c.cyan}${val}${c.reset}`;
  }

  toggleSetting(item, dir = 1) {
    if (!item) return;
    const current = this.getValue(item);
    let nextVal;
    if (item.type === 'boolean') {
      nextVal = !current;
    } else if (item.type === 'select') {
      const idx = item.options.indexOf(current);
      const nextIdx = (idx + dir + item.options.length) % item.options.length;
      nextVal = item.options[nextIdx];
    }
    if (item.isServerConfig) {
      if (!this.cfg.local_server) this.cfg.local_server = {};
      this.cfg.local_server[item.key] = nextVal;
    } else {
      this.cfg[item.key] = nextVal;
    }
  }

  saveAndExit() {
    this.close();
    this.client.saveConfig(this.cfg);
    this.client.api('/api/update-config', 'POST', this.cfg).catch(() => {});
    console.log(`  ${c.dim}└ Settings saved to ~/.0xagent/config.json${c.reset}\n`);
  }

  start() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      this.renderFallback();
      if (this.onDone) this.onDone();
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    this.isRaw = true;
    process.stdin.on('keypress', this.boundKeypress);
    process.stdout.write('\x1b[?25l');
    this.render();
  }

  close() {
    if (this.isRaw) {
      try {
        process.stdin.removeListener('keypress', this.boundKeypress);
        process.stdin.setRawMode(false);
      } catch {}
      this.isRaw = false;
    }
    process.stdout.write('\x1b[?25h');
    clearRenderedLines(this.renderedLinesCount);
    this.renderedLinesCount = 0;
    if (this.onDone) this.onDone();
  }

  handleKeypress(str, key) {
    if (!key) return;

    if (key.ctrl && key.name === 'c') {
      this.close();
      process.exit(0);
      return;
    }

    if (key.name === 'escape') {
      if (this.filter.length > 0) {
        this.filter = '';
        this.selectedIndex = 0;
        this.render();
        return;
      }
      this.saveAndExit();
      return;
    }

    const filtered = this.getFilteredSettings();

    if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
      return;
    }

    if (key.name === 'down') {
      this.selectedIndex = Math.min(Math.max(0, filtered.length - 1), this.selectedIndex + 1);
      this.render();
      return;
    }

    if (key.name === 'left') {
      const item = filtered[this.selectedIndex];
      if (item) this.toggleSetting(item, -1);
      this.render();
      return;
    }

    if (key.name === 'right') {
      const item = filtered[this.selectedIndex];
      if (item) this.toggleSetting(item, 1);
      this.render();
      return;
    }

    if (key.name === 'return' || key.name === 'space') {
      const item = filtered[this.selectedIndex];
      if (item) this.toggleSetting(item, 1);
      this.render();
      return;
    }

    if (key.name === 'backspace') {
      if (this.filter.length > 0) {
        this.filter = this.filter.slice(0, -1);
        this.selectedIndex = 0;
        this.render();
      }
      return;
    }

    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      if (this.filter.length === 0 && (str === 'q' || str === 'Q')) {
        this.saveAndExit();
        return;
      }
      this.filter += str;
      this.selectedIndex = 0;
      this.render();
    }
  }

  render() {
    clearRenderedLines(this.renderedLinesCount);

    const filtered = this.getFilteredSettings();
    if (this.selectedIndex >= filtered.length) {
      this.selectedIndex = Math.max(0, filtered.length - 1);
    }

    const lines = [];
    lines.push('');
    lines.push(`${c.bold}Settings${c.reset}`);
    lines.push('');

    const filterDisplay = this.filter ? this.filter : `${c.gray}Type to filter...${c.reset}`;
    lines.push(`  ${c.bold}Search:${c.reset} ${filterDisplay}`);
    lines.push('');

    if (filtered.length === 0) {
      lines.push(`  ${c.gray}(No settings match filter: "${this.filter}")${c.reset}`);
    } else {
      filtered.forEach((item, idx) => {
        const isFocused = idx === this.selectedIndex;
        const pointer = isFocused ? `${c.cyan}>${c.reset}` : ' ';
        const labelStr = isFocused ? `${c.bold}${c.cyan}${item.label}${c.reset}` : item.label;
        const valStr = this.formatValue(item);
        lines.push(`${pointer} ${labelStr.padEnd(isFocused ? 34 : 26)} ${valStr}`);
      });
    }

    lines.push('');
    const focusedItem = filtered[this.selectedIndex];
    if (focusedItem) {
      lines.push(`  ${c.dim}'${focusedItem.label}': ${focusedItem.desc}${c.reset}`);
      lines.push(`  ${c.gray}[${this.selectedIndex + 1} of ${filtered.length} items]${c.reset}`);
    } else {
      lines.push(`  ${c.dim}No setting selected.${c.reset}`);
    }

    lines.push('');
    const modeStr = this.cfg.permissionPreset || this.cfg.permission_preset || 'unrestricted';
    const modelShort = (this.cfg.selectedModel || this.cfg.model_name || 'auto').replace(/^local:/, '').replace(/\.gguf$/i, '');
    const effort = this.cfg.reasoning_effort || 'auto';
    lines.push(`${c.bold}Keyboard:${c.reset} ${c.cyan}↑/↓${c.reset} Navigate  ${c.cyan}enter/space${c.reset} Toggle  ${c.cyan}←/→${c.reset} Change  ${c.cyan}esc${c.reset} Clear Search/Exit`);
    lines.push(`${' '.repeat(38)}${c.green}${modeStr}${c.reset} · ${modelShort} · ${c.yellow}${effort}${c.reset}`);

    process.stdout.write(lines.join('\n') + '\n');
    this.renderedLinesCount = lines.length;
  }

  renderFallback() {
    console.log(`\n${c.bold}0xAgent Settings:${c.reset}`);
    this.settings.forEach((s) => {
      const val = this.formatValue(s);
      console.log(`  ${s.label.padEnd(25)} : ${val} — ${c.gray}${s.desc}${c.reset}`);
    });
    console.log(`\n${c.dim}Run '0xagent config set <key> <value>' to update.${c.reset}\n`);
  }
}

// -------------------------------------------------------------
// Interactive Model Switcher (Matching AGY CLI Screenshot 2)
// -------------------------------------------------------------

export class ModelTui {
  constructor(client, onDone) {
    this.client = client;
    this.onDone = onDone;
    this.cfg = client.loadConfig();
    this.effortOptions = ['low', 'medium', 'high', 'auto'];
    this.effort = this.cfg.reasoning_effort || 'auto';
    this.models = [];
    this.selectedIndex = 0;
    this.isRaw = false;
    this.renderedLinesCount = 0;
    this.boundKeypress = this.handleKeypress.bind(this);
    this.activeModel = this.cfg.selectedModel || this.cfg.model_name || 'local:qwen2.5-coder-32b.gguf';

    this.initModels();
  }

  initModels() {
    const searchDirs = [
      path.join(process.cwd(), 'models'),
      path.join(CONFIG_DIR, 'models'),
      path.join(PROJECT_ROOT, 'models'),
    ];
    if (this.cfg.models_path && !searchDirs.includes(this.cfg.models_path)) {
      searchDirs.unshift(this.cfg.models_path);
    }

    const seen = new Set();
    const localList = [];

    const scanDir = (d) => {
      if (!fs.existsSync(d)) return;
      try {
        for (const file of fs.readdirSync(d)) {
          if (file.toLowerCase().endsWith('.gguf') && !seen.has(file.toLowerCase()) && !/mmproj|projector|clip/i.test(file)) {
            seen.add(file.toLowerCase());
            const fullPath = path.join(d, file);
            let sizeStr = '';
            try {
              const st = fs.statSync(fullPath);
              sizeStr = `${(st.size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
            } catch {}
            const quantMatch = file.match(/\b(q[0-9]_[a-z0-9_]+|iq[0-9]_[a-z0-9_]+|bf16|f16)\b/i);
            const quant = quantMatch ? quantMatch[1].toUpperCase() : 'GGUF';
            localList.push({
              id: `local:${file}`,
              name: file,
              type: 'local',
              fullPath,
              size: sizeStr,
              quant,
            });
          }
        }
      } catch {}
    };

    for (const d of searchDirs) {
      scanDir(d);
    }

    // Only add Google Gemini cloud models IF the user has a GEMINI_API_KEY configured
    const cloudList = [];
    if (this.cfg.gemini_api_key || process.env.GEMINI_API_KEY) {
      cloudList.push(
        { id: 'gemini-2.0-flash', name: 'gemini-2.0-flash', type: 'cloud', provider: 'Google AI Studio', badge: 'Flash' },
        { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro', type: 'cloud', provider: 'Google AI Studio', badge: 'Pro' }
      );
    }

    this.models = [...localList, ...cloudList];

    if (this.models.length === 0) {
      this.models.push({
        id: 'local:qwen2.5-coder-32b.gguf',
        name: 'qwen2.5-coder-32b.gguf',
        type: 'local',
        size: 'Not downloaded',
        quant: 'GGUF',
      });
    }

    const actIdx = this.models.findIndex((m) => this.isModelActive(m));
    this.selectedIndex = actIdx >= 0 ? actIdx : 0;
  }

  isModelActive(m) {
    if (!m) return false;
    const act = (this.activeModel || '').replace(/^local:/, '');
    const mName = (m.name || '').replace(/^local:/, '');
    const mId = (m.id || '').replace(/^local:/, '');
    return act === mName || act === mId || this.activeModel === m.id || this.activeModel === m.name;
  }

  renderSliderBar(effort) {
    const dots = {
      low: `${c.bold}${c.green}◎${c.reset}──────────────${c.dim}●${c.reset}──────────────${c.dim}●${c.reset}──────────────${c.dim}●${c.reset}`,
      medium: `${c.dim}●${c.reset}──────────────${c.bold}${c.green}◎${c.reset}──────────────${c.dim}●${c.reset}──────────────${c.dim}●${c.reset}`,
      high: `${c.dim}●${c.reset}──────────────${c.dim}●${c.reset}──────────────${c.bold}${c.green}◎${c.reset}──────────────${c.dim}●${c.reset}`,
      auto: `${c.dim}●${c.reset}──────────────${c.dim}●${c.reset}──────────────${c.dim}●${c.reset}──────────────${c.bold}${c.green}◎${c.reset}`,
    };
    return `──${dots[effort] || dots.auto}──`;
  }

  async saveAndExit() {
    const selected = this.models[this.selectedIndex];
    if (selected) {
      this.cfg.selectedModel = selected.id;
      this.cfg.model_name = selected.id;
      this.cfg.reasoning_effort = this.effort;
      if (selected.fullPath) {
        if (!this.cfg.local_server) this.cfg.local_server = {};
        this.cfg.local_server.model_path = selected.fullPath;
      }
      this.client.saveConfig(this.cfg);

      // Trigger automatic launch/switch of model in local llama-server
      if (selected.type === 'local' && selected.fullPath) {
        this.client.api('/api/start-local-server', 'POST', {
          modelPath: selected.fullPath,
          host: this.cfg.local_server?.host || '127.0.0.1',
          port: this.cfg.local_server?.port || 11434,
        }).catch(() => {});
      }

      this.client.api('/api/update-config', 'POST', {
        selectedModel: selected.id,
        model_name: selected.id,
        reasoning_effort: this.effort,
        local_server: this.cfg.local_server,
      }).catch(() => {});

      this.close();
      console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Switched model to:${c.reset} ${c.bold}${selected.name}${c.reset} (Effort: ${this.effort})`);
      if (selected.type === 'local') {
        console.log(`    ${c.gray}Local llama-server (:11434) loaded model.${c.reset}\n`);
      } else {
        console.log('');
      }
    } else {
      this.close();
    }
  }

  start() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      this.renderFallback();
      if (this.onDone) this.onDone();
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    this.isRaw = true;
    process.stdin.on('keypress', this.boundKeypress);
    process.stdout.write('\x1b[?25l');
    this.render();
  }

  close() {
    if (this.isRaw) {
      try {
        process.stdin.removeListener('keypress', this.boundKeypress);
        process.stdin.setRawMode(false);
      } catch {}
      this.isRaw = false;
    }
    process.stdout.write('\x1b[?25h');
    clearRenderedLines(this.renderedLinesCount);
    this.renderedLinesCount = 0;
    if (this.onDone) this.onDone();
  }

  handleKeypress(str, key) {
    if (!key) return;

    if (key.ctrl && key.name === 'c') {
      this.close();
      process.exit(0);
      return;
    }

    if (key.name === 'escape') {
      this.close();
      console.log(`  ${c.dim}└ Exited /model command${c.reset}\n`);
      return;
    }

    if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
      return;
    }

    if (key.name === 'down') {
      this.selectedIndex = Math.min(Math.max(0, this.models.length - 1), this.selectedIndex + 1);
      this.render();
      return;
    }

    if (key.name === 'left') {
      const idx = this.effortOptions.indexOf(this.effort);
      const nextIdx = (idx - 1 + this.effortOptions.length) % this.effortOptions.length;
      this.effort = this.effortOptions[nextIdx];
      this.render();
      return;
    }

    if (key.name === 'right') {
      const idx = this.effortOptions.indexOf(this.effort);
      const nextIdx = (idx + 1) % this.effortOptions.length;
      this.effort = this.effortOptions[nextIdx];
      this.render();
      return;
    }

    if (key.name === 'return' || key.name === 'space') {
      this.saveAndExit();
      return;
    }

    if (str && (str === 'q' || str === 'Q')) {
      this.close();
      console.log(`  ${c.dim}└ Exited /model command${c.reset}\n`);
    }
  }

  render() {
    clearRenderedLines(this.renderedLinesCount);

    const lines = [];
    lines.push('');
    lines.push(`${c.bold}Switch Model${c.reset}`);
    lines.push('');

    this.models.forEach((m, idx) => {
      const isFocused = idx === this.selectedIndex;
      const isActive = this.isModelActive(m);
      const pointer = isFocused ? `${c.cyan}>${c.reset}` : ' ';
      const activeTag = isActive ? ` ${c.green}(current)${c.reset}` : '';
      const badge = m.size ? ` ${c.gray}[${m.quant}, ${m.size}]${c.reset}` : ` ${c.gray}[${m.quant}]${c.reset}`;
      const nameStr = isFocused ? `${c.bold}${c.cyan}${m.name}${c.reset}` : m.name;
      lines.push(`${pointer} ${nameStr}${activeTag}${badge}`);
    });

    lines.push('');
    const sliderBar = this.renderSliderBar(this.effort);
    lines.push(`Effort  ◄  ${sliderBar}  ►`);
    lines.push(`          low            medium          high           auto`);
    lines.push('');

    const modeStr = this.cfg.permissionPreset || this.cfg.permission_preset || 'unrestricted';
    const activeModelShort = (this.models[this.selectedIndex]?.name || this.activeModel || '').replace(/\.gguf$/i, '');
    lines.push(`${c.bold}Keyboard:${c.reset} ${c.cyan}↑/↓${c.reset} Navigate  ${c.cyan}←/→${c.reset} Effort  ${c.cyan}enter${c.reset} Select & Launch  ${c.cyan}esc${c.reset} Go Back`);
    lines.push(`${' '.repeat(38)}${c.green}${modeStr}${c.reset} · ${activeModelShort} · ${c.yellow}${this.effort}${c.reset}`);

    process.stdout.write(lines.join('\n') + '\n');
    this.renderedLinesCount = lines.length;
  }

  renderFallback() {
    console.log(`\n${c.bold}Active Model:${c.reset} ${c.green}${this.activeModel}${c.reset} (Effort: ${this.effort})`);
    console.log(`\n${c.bold}Available Models:${c.reset}`);
    this.models.forEach((m) => {
      const marker = this.isModelActive(m) ? `${c.green}* [ACTIVE]${c.reset}` : `  [ ]`;
      console.log(`  ${marker} ${m.name} (${m.type})`);
    });
    console.log(`\n${c.dim}Run '0xagent model <model-name>' to switch.${c.reset}\n`);
  }
}

// -------------------------------------------------------------
// Interactive Command Picker (Matching AGY CLI Screenshot 1)
// -------------------------------------------------------------

export class CommandPickerTui {
  constructor(client, onSelect, onCancel) {
    this.client = client;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.filter = '';
    this.selectedIndex = 0;
    this.isRaw = false;
    this.renderedLinesCount = 0;
    this.boundKeypress = this.handleKeypress.bind(this);

    this.commands = [
      { cmd: '/model', label: '/model', desc: 'Switch active local GGUF model & reasoning effort' },
      { cmd: '/settings', label: '/settings', desc: 'Configure settings (GPU layers, ctx size, auto-open browser)' },
      { cmd: '/persona', label: '/persona', desc: 'Switch active agent persona profile' },
      { cmd: '/server', label: '/server', desc: 'Manage local llama-server (start, stop, restart, purge)' },
      { cmd: '/status', label: '/status', desc: 'Hardware, GPU VRAM & active session telemetry' },
      { cmd: '/compact', label: '/compact', desc: 'Compact conversation context & prune tokens' },
      { cmd: '/clear', label: '/clear', desc: 'Clear session history & restart context' },
      { cmd: '/help', label: '/help', desc: 'Show command manual and shortcuts' },
      { cmd: '/exit', label: '/exit', desc: 'Exit 0xAgent CUI' },
    ];
  }

  getFilteredCommands() {
    if (!this.filter.trim()) return this.commands;
    const q = this.filter.toLowerCase().trim();
    return this.commands.filter(
      (c) => c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
    );
  }

  start() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      this.renderFallback();
      if (this.onCancel) this.onCancel();
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    this.isRaw = true;
    process.stdin.on('keypress', this.boundKeypress);
    process.stdout.write('\x1b[?25l');
    this.render();
  }

  close() {
    if (this.isRaw) {
      try {
        process.stdin.removeListener('keypress', this.boundKeypress);
        process.stdin.setRawMode(false);
      } catch {}
      this.isRaw = false;
    }
    process.stdout.write('\x1b[?25h');
    clearRenderedLines(this.renderedLinesCount);
    this.renderedLinesCount = 0;
  }

  handleKeypress(str, key) {
    if (!key) return;

    if (key.ctrl && key.name === 'c') {
      this.close();
      process.exit(0);
      return;
    }

    if (key.name === 'escape') {
      this.close();
      if (this.onCancel) this.onCancel();
      return;
    }

    const filtered = this.getFilteredCommands();

    if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
      return;
    }

    if (key.name === 'down') {
      this.selectedIndex = Math.min(Math.max(0, filtered.length - 1), this.selectedIndex + 1);
      this.render();
      return;
    }

    if (key.name === 'return') {
      const chosen = filtered[this.selectedIndex];
      this.close();
      if (this.onSelect && chosen) {
        this.onSelect(chosen.cmd);
      } else if (this.onCancel) {
        this.onCancel();
      }
      return;
    }

    if (key.name === 'backspace') {
      if (this.filter.length > 0) {
        this.filter = this.filter.slice(0, -1);
        this.selectedIndex = 0;
        this.render();
      }
      return;
    }

    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      this.filter += str;
      this.selectedIndex = 0;
      this.render();
    }
  }

  render() {
    clearRenderedLines(this.renderedLinesCount);

    const width = Math.min(process.stdout.columns || 68, 68);
    const divider = `${c.dim}${'─'.repeat(width)}${c.reset}`;
    const filtered = this.getFilteredCommands();

    if (this.selectedIndex >= filtered.length) {
      this.selectedIndex = Math.max(0, filtered.length - 1);
    }

    const lines = [];
    lines.push('');
    lines.push(`> /${this.filter}`);
    lines.push(divider);

    if (filtered.length === 0) {
      lines.push(`  ${c.gray}(No commands match: "${this.filter}")${c.reset}`);
    } else {
      filtered.forEach((item, idx) => {
        const isFocused = idx === this.selectedIndex;
        const pointer = isFocused ? `${c.cyan}>${c.reset}` : ' ';
        const cmdStr = isFocused ? `${c.bold}${c.cyan}${item.label.padEnd(16)}${c.reset}` : item.label.padEnd(16);
        const descStr = isFocused ? `${c.bold}${c.white}${item.desc}${c.reset}` : `${c.dim}${item.desc}${c.reset}`;
        lines.push(`${pointer} ${cmdStr} ${descStr}`);
      });
    }

    lines.push(divider);
    lines.push(`${c.dim}↑/↓ Navigate · enter Select · tab Complete · esc Cancel${c.reset}`);

    process.stdout.write(lines.join('\n') + '\n');
    this.renderedLinesCount = lines.length;
  }

  renderFallback() {
    console.log(`\n${c.bold}Available Commands:${c.reset}`);
    this.commands.forEach((item) => {
      console.log(`  ${c.cyan}${item.label.padEnd(14)}${c.reset} ${item.desc}`);
    });
    console.log('');
  }
}

// -------------------------------------------------------------
// Interactive Persona Switcher (Matching AGY CLI Screenshot 2)
// -------------------------------------------------------------

export class PersonaTui {
  constructor(client, onDone) {
    this.client = client;
    this.onDone = onDone;
    this.cfg = client.loadConfig();
    this.personas = [];
    this.selectedIndex = 0;
    this.isRaw = false;
    this.renderedLinesCount = 0;
    this.boundKeypress = this.handleKeypress.bind(this);

    this.initPersonas();
  }

  initPersonas() {
    const list = [];
    const personasDir = path.join(CONFIG_DIR, 'personas');
    if (fs.existsSync(personasDir)) {
      try {
        for (const sub of fs.readdirSync(personasDir)) {
          const metaPath = path.join(personasDir, sub, 'metadata.json');
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              list.push(meta);
            } catch {}
          }
        }
      } catch {}
    }

    if (list.length === 0) {
      list.push(
        { id: 'core', name: '0xAgent Core', is_active: true, description: 'Autonomous full-stack engineer and coding partner' },
        { id: 'reviewer', name: 'Code Reviewer', is_active: false, description: 'Auditor for code quality, security and correctness' }
      );
    }

    this.personas = list;
    const actIdx = this.personas.findIndex((p) => p.is_active || p.id === this.cfg.active_persona_id);
    this.selectedIndex = actIdx >= 0 ? actIdx : 0;
  }

  saveAndExit() {
    const selected = this.personas[this.selectedIndex];
    if (selected) {
      this.cfg.active_persona_id = selected.id;
      this.client.saveConfig(this.cfg);

      const personasDir = path.join(CONFIG_DIR, 'personas');
      if (fs.existsSync(personasDir)) {
        for (const sub of fs.readdirSync(personasDir)) {
          const metaPath = path.join(personasDir, sub, 'metadata.json');
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              meta.is_active = (meta.id === selected.id || sub === selected.id);
              fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
            } catch {}
          }
        }
      }

      this.client.api(`/api/personas/${selected.id}/activate`, 'POST').catch(() => {});
      this.close();
      console.log(`  ${c.dim}└${c.reset} ${c.green}[✓] Switched persona to:${c.reset} ${c.bold}${selected.name}${c.reset} (${selected.id})\n`);
    } else {
      this.close();
    }
  }

  start() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      this.renderFallback();
      if (this.onDone) this.onDone();
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    this.isRaw = true;
    process.stdin.on('keypress', this.boundKeypress);
    process.stdout.write('\x1b[?25l');
    this.render();
  }

  close() {
    if (this.isRaw) {
      try {
        process.stdin.removeListener('keypress', this.boundKeypress);
        process.stdin.setRawMode(false);
      } catch {}
      this.isRaw = false;
    }
    process.stdout.write('\x1b[?25h');
    clearRenderedLines(this.renderedLinesCount);
    this.renderedLinesCount = 0;
    if (this.onDone) this.onDone();
  }

  handleKeypress(str, key) {
    if (!key) return;

    if (key.ctrl && key.name === 'c') {
      this.close();
      process.exit(0);
      return;
    }

    if (key.name === 'escape') {
      this.close();
      console.log(`  ${c.dim}└ Exited /persona command${c.reset}\n`);
      return;
    }

    if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
      return;
    }

    if (key.name === 'down') {
      this.selectedIndex = Math.min(Math.max(0, this.personas.length - 1), this.selectedIndex + 1);
      this.render();
      return;
    }

    if (key.name === 'return' || key.name === 'space') {
      this.saveAndExit();
      return;
    }

    if (str && (str === 'q' || str === 'Q')) {
      this.close();
      console.log(`  ${c.dim}└ Exited /persona command${c.reset}\n`);
    }
  }

  render() {
    clearRenderedLines(this.renderedLinesCount);

    const lines = [];
    lines.push('');
    lines.push(`${c.bold}Switch Persona${c.reset}`);
    lines.push('');

    this.personas.forEach((p, idx) => {
      const isFocused = idx === this.selectedIndex;
      const isActive = p.is_active || p.id === this.cfg.active_persona_id;
      const pointer = isFocused ? `${c.cyan}>${c.reset}` : ' ';
      const activeTag = isActive ? ` ${c.green}(current)${c.reset}` : '';
      const nameStr = isFocused ? `${c.bold}${c.cyan}${p.name}${c.reset}` : p.name;
      lines.push(`${pointer} ${nameStr}${activeTag}  ${c.gray}(${p.id})${c.reset}`);
    });

    lines.push('');
    const focused = this.personas[this.selectedIndex];
    if (focused && focused.description) {
      lines.push(`  ${c.dim}'${focused.name}': ${focused.description}${c.reset}`);
      lines.push(`  ${c.gray}[${this.selectedIndex + 1} of ${this.personas.length} personas]${c.reset}`);
    }

    lines.push('');
    const modeStr = this.cfg.permissionPreset || this.cfg.permission_preset || 'unrestricted';
    const modelShort = (this.cfg.selectedModel || this.cfg.model_name || 'auto').replace(/^local:/, '').replace(/\.gguf$/i, '');
    const effort = this.cfg.reasoning_effort || 'auto';
    lines.push(`${c.bold}Keyboard:${c.reset} ${c.cyan}↑/↓${c.reset} Navigate  ${c.cyan}enter${c.reset} Activate  ${c.cyan}esc${c.reset} Go Back`);
    lines.push(`${' '.repeat(38)}${c.green}${modeStr}${c.reset} · ${modelShort} · ${c.yellow}${effort}${c.reset}`);

    process.stdout.write(lines.join('\n') + '\n');
    this.renderedLinesCount = lines.length;
  }

  renderFallback() {
    console.log(`\n${c.bold}Available Personas:${c.reset}`);
    this.personas.forEach((p) => {
      const marker = p.is_active ? `${c.green}* [ACTIVE]${c.reset}` : `  [ ]`;
      console.log(`  ${marker} ${p.name} (${p.id}) — ${c.gray}${p.description || ''}${c.reset}`);
    });
    console.log(`\n${c.dim}Run '0xagent persona <id>' to switch.${c.reset}\n`);
  }
}

// -------------------------------------------------------------
// One-Shot CLI Execution Runner (for Scripts, Piping, Veron)
// -------------------------------------------------------------

export async function runCliPrompt(prompt, options = {}) {
  const client = new CuiClient({
    workspaceDir: process.cwd(),
    quiet: options.quiet,
    json: options.json,
  });

  try {
    await client.ensureBackendRunning();
    const cui = new TerminalCui(client);

    if (!options.quiet && !options.json) {
      const cfg = client.loadConfig();
      cui.renderBanner(cfg);
      console.log(`${c.bold}${c.cyan}[›] User Query:${c.reset} ${prompt}\n`);
    }

    const result = await cui.executePromptTurn(prompt, { quiet: options.quiet });
    client.close();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (options.quiet) {
      // In quiet mode, ensure newline at end
      process.stdout.write('\n');
    }

    process.exit(0);
  } catch (err) {
    if (options.json) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(`\n${c.red}[ERR] Execution failed:${c.reset} ${err.message}`);
    }
    client.close();
    process.exit(1);
  }
}
