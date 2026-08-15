import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

import { isPasswordSet, verifySessionToken } from './auth';

import { authRouter } from './routes/authRoutes';
import { configRouter } from './routes/configRoutes';
import { memoryRouter } from './routes/memoryRoutes';
import { skillsRouter } from './routes/skillsRoutes';
import { createPersonasRouter } from './routes/personasRoutes';
import { workspaceRouter } from './routes/workspaceRoutes';
import { hardwareRouter } from './routes/hardwareRoutes';
import { createLlamaRouter, stopLlamaServerProcess } from './routes/llamaRoutes';
import { createAgentRouter } from './routes/agentRoutes';
import knowledgeRouter from './routes/knowledge';
import { jarvisRouter } from './routes/jarvisRoutes';
import { jarvisSupervisor } from './agent/jarvisSupervisor';
import { voiceDaemonManager } from './agent/voiceDaemonManager';

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));

// Auth verification middleware for API requests
app.use((req, res, next) => {
  const publicAuthPaths = [
    '/api/auth/status',
    '/api/auth/setup',
    '/api/auth/login',
    '/api/jarvis/voice-wake',
    '/api/jarvis/voice-input',
    '/api/jarvis/voice-state',
  ];

  if (!req.path.startsWith('/api/') || publicAuthPaths.includes(req.path) || req.path.startsWith('/api/jarvis/voice-')) {
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

// Wire WS broadcaster to Jarvis & Voice Daemon
jarvisSupervisor.setWsBroadcaster(broadcast);
voiceDaemonManager.setWsBroadcaster(broadcast);
voiceDaemonManager.autoStartIfEnabled();

// Mount Router Modules
app.use('/api', authRouter);
app.use('/api', configRouter);
app.use('/api', memoryRouter);
app.use('/api', skillsRouter);
app.use('/api', createPersonasRouter(broadcast));
app.use('/api', workspaceRouter);
app.use('/api', hardwareRouter);
app.use('/api', createLlamaRouter(broadcast));
app.use('/api', createAgentRouter(broadcast));
app.use('/api', jarvisRouter);
app.use('/api/knowledge', knowledgeRouter);

// Global JSON Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[EXPRESS ERROR]', err);
  res.status(err.status || 500).json({ error: err.message || String(err) });
});

// Graceful process exit handlers for 0xAgent backend node process
const cleanupOnExit = () => {
  voiceDaemonManager.stop();
  jarvisSupervisor.stopLoop();
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

server.listen(Number(PORT), HOST, () => {
  process.stdout.write(`[0xAgent] Local Server running at http://${HOST}:${PORT}\n`);
  process.stdout.write(`[WS] WebSocket server listening on ws://${HOST}:${PORT}/ws\n`);
});
