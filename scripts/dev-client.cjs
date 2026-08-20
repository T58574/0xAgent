const net = require('node:net');
const { spawn } = require('node:child_process');

const PORT = 3001;
const HOST = '127.0.0.1';

function checkServerReady() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(PORT, HOST);
  });
}

async function waitForServerAndStart() {
  process.stdout.write('[CLIENT] Synchronizing startup: waiting for backend (:3001) to become ready...\n');
  const start = Date.now();
  const maxWaitMs = 15000;

  while (Date.now() - start < maxWaitMs) {
    const ready = await checkServerReady();
    if (ready) {
      const elapsed = Date.now() - start;
      process.stdout.write(`[CLIENT] Backend ready on port ${PORT} (${elapsed}ms). Launching Vite dev server...\n`);
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const isWin = process.platform === 'win32';
  const viteCmd = isWin ? 'npx.cmd' : 'npx';
  const viteArgs = ['vite', '--host', '0.0.0.0', ...process.argv.slice(2)];

  const vite = spawn(viteCmd, viteArgs, {
    stdio: 'inherit',
    shell: isWin,
  });

  vite.on('exit', (code) => {
    process.exit(code || 0);
  });

  const cleanup = () => {
    try {
      vite.kill('SIGTERM');
    } catch {}
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

waitForServerAndStart();
