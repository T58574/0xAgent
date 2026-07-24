import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, saveConfig } from './config';
import {
  listSessions,
  loadSession,
  saveSession,
  createNewSession,
  deleteSession,
} from './session';
import {
  getWorkspaceTree,
  executeReadFile,
  executeWriteFile,
  selectWorkspaceNative,
} from './tools';
import {
  runAgentLoop,
  cancelAgentSession,
  respondToToolConfirmation,
} from './agent';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
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

// Config endpoints
app.get('/api/config', (_req, res) => {
  try {
    const cfg = loadConfig();
    res.json(cfg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    saveConfig(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Session endpoints
app.get('/api/sessions', (_req, res) => {
  try {
    const sessions = listSessions();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = loadSession(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/sessions', (req, res) => {
  try {
    const { title } = req.body;
    const newSession = createNewSession(title);
    res.json(newSession);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/save', (req, res) => {
  try {
    saveSession(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Workspace & File endpoints
app.post('/api/select-workspace', (_req, res) => {
  try {
    const folder = selectWorkspaceNative();
    if (folder) {
      const cfg = loadConfig();
      cfg.workspace_dir = folder;
      saveConfig(cfg);
      res.json({ folder });
    } else {
      res.json({ folder: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace-tree', (req, res) => {
  try {
    const workspaceDir = req.query.workspaceDir as string | undefined;
    const tree = getWorkspaceTree(workspaceDir);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/read-file-raw', (req, res) => {
  try {
    const filePath = req.query.path as string;
    const content = executeReadFile(null, filePath);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/write-file-raw', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    executeWriteFile(null, filePath, content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agent execution endpoints
app.post('/api/send-message', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const config = loadConfig();
  // Trigger agent loop asynchronously in background
  runAgentLoop(sessionId, config, broadcast).catch((err) => {
    console.error('Agent loop error:', err);
    broadcast('agent-error', `Agent runtime error: ${err.message}`);
    broadcast('agent-status-changed', 'idle');
  });

  res.json({ success: true });
});

app.post('/api/cancel-agent', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    cancelAgentSession(sessionId);
  }
  res.json({ success: true });
});

app.post('/api/respond-to-tool', (req, res) => {
  const { sessionId, toolCallId, approve } = req.body;
  const ok = respondToToolConfirmation(sessionId, toolCallId, approve);
  res.json({ success: ok });
});

server.listen(PORT, () => {
  console.log(`🚀 0xAgent Local Server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server listening on ws://localhost:${PORT}/ws`);
});
