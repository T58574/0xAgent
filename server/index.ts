import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

import { isPasswordSet, verifySessionToken } from './auth';

import { authRouter } from './routes/authRoutes';
import { configRouter } from './routes/configRoutes';
import { memoryRouter } from './routes/memoryRoutes';
import { skillsRouter } from './routes/skillsRoutes';
import { personasRouter } from './routes/personasRoutes';
import { workspaceRouter } from './routes/workspaceRoutes';
import { hardwareRouter } from './routes/hardwareRoutes';
import { createLlamaRouter, stopLlamaServerProcess } from './routes/llamaRoutes';
import { createAgentRouter } from './routes/agentRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth verification middleware for API requests
app.use((req, res, next) => {
  const publicAuthPaths = [
    '/api/auth/status',
    '/api/auth/setup',
    '/api/auth/login',
  ];

  if (!req.path.startsWith('/api/') || publicAuthPaths.includes(req.path)) {
    return next();
  }

  if (isPasswordSet()) {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    const token = authHeader || queryToken;

    if (!verifySessionToken(token)) {
      res.status(401).json({ error: 'Unauthorized: Требуется авторизация мастер-паролем' });
      return;
    }
  }

  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams((req.url || '').split('?')[1] || '');
  const token = urlParams.get('token') || (req.headers['sec-websocket-protocol'] as string);

  if (isPasswordSet() && !verifySessionToken(token)) {
    console.warn('[WEBSOCKET SECURITY] Rejected unauthenticated WebSocket connection request');
    ws.close(4001, 'Unauthorized');
    return;
  }

  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event: string, payload: any): void {
  const message = JSON.stringify({ event, payload });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Mount Router Modules
app.use('/api', authRouter);
app.use('/api', configRouter);
app.use('/api', memoryRouter);
app.use('/api', skillsRouter);
app.use('/api', personasRouter);
app.use('/api', workspaceRouter);
app.use('/api', hardwareRouter);
app.use('/api', createLlamaRouter(broadcast));
app.use('/api', createAgentRouter(broadcast));

// Graceful process exit handlers for 0xAgent backend node process
const cleanupOnExit = () => {
  stopLlamaServerProcess(broadcast);
};
process.on('SIGINT', () => { cleanupOnExit(); process.exit(0); });
process.on('SIGTERM', () => { cleanupOnExit(); process.exit(0); });
process.on('exit', () => { cleanupOnExit(); });
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  cleanupOnExit();
  process.exit(1);
});

server.listen(Number(PORT), '0.0.0.0', () => {
  process.stdout.write(`🚀 0xAgent Local Server running at http://0.0.0.0:${PORT}\n`);
  process.stdout.write(`🔌 WebSocket server listening on ws://0.0.0.0:${PORT}/ws\n`);
});
