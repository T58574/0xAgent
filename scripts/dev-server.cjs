const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const LOG_DIR = path.join(os.homedir(), '.0xagent', 'logs');
const SERVER_LOG = path.join(LOG_DIR, 'server.log');
const CRASH_LOG = path.join(LOG_DIR, 'server-crash.log');

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch {}
}

function appendToLog(file, text) {
  ensureLogDir();
  try {
    fs.appendFileSync(file, text, 'utf-8');
  } catch {}
}

ensureLogDir();

// Header banner for fresh run
const startBanner = `\n=== 0xAgent Dev Server Session Started at ${new Date().toISOString()} ===\n`;
appendToLog(SERVER_LOG, startBanner);

const isWin = process.platform === 'win32';
const tsxCmd = isWin ? 'npx.cmd' : 'npx';
const tsxArgs = ['tsx', 'watch', 'server/index.ts'];

const child = spawn(tsxCmd, tsxArgs, {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: isWin,
});

child.stdout.on('data', (data) => {
  const str = data.toString();
  process.stdout.write(str);
  appendToLog(SERVER_LOG, str);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  process.stderr.write(str);
  appendToLog(SERVER_LOG, str);

  // If compiler error or unhandled exception detected, record in server-crash.log
  if (
    /error|failed|syntax|transform failed|exception|crash|cannot find module/i.test(str)
  ) {
    const crashEntry = `[${new Date().toISOString()}] [CRASH DETECTED]\n${str}\n`;
    appendToLog(CRASH_LOG, crashEntry);
  }
});

child.on('exit', (code, signal) => {
  const exitMsg = `\n[SERVER] tsx process exited with code ${code} (signal: ${signal})\n`;
  process.stderr.write(exitMsg);
  appendToLog(SERVER_LOG, exitMsg);
  if (code !== 0 && code !== null) {
    appendToLog(CRASH_LOG, `[${new Date().toISOString()}] Server exited abnormally with code ${code}\n`);
  }
  process.exit(code || 0);
});

const cleanup = () => {
  try {
    if (isWin && child.pid) {
      spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F'], { shell: true });
    } else {
      child.kill('SIGTERM');
    }
  } catch {}
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
