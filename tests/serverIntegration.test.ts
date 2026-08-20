import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import https from 'node:https';
import http from 'node:http';
import { WebSocket } from 'ws';
import express from 'express';
import { getOrCreateSslCertificates } from '../server/sslHelper';
import { authRouter } from '../server/routes/authRoutes';
import { WebSocketServer } from 'ws';

describe('Server & WebSocket HTTPS Integration Test Suite', () => {
  let server: https.Server | http.Server;
  let wss: WebSocketServer;
  let port: number;
  let sslCerts: any;

  before(async () => {
    sslCerts = await getOrCreateSslCertificates();
    const app = express();
    app.use(express.json());
    app.use('/api', authRouter);

    server = https.createServer({ key: sslCerts.key, cert: sslCerts.cert }, app);
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ event: 'connected', payload: { status: 'ready' } }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => resolve());
      });
    });
  });

  it('should respond to HTTPS GET /api/auth/status without socket hang up', async () => {
    const data = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = https.request(
        `https://127.0.0.1:${port}/api/auth/status`,
        {
          method: 'GET',
          rejectUnauthorized: false, // Accept local self-signed cert
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        }
      );
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(data.status, 200);
    const json = JSON.parse(data.body);
    assert.ok('isPasswordSet' in json && 'isAuthenticated' in json);
  });

  it('should establish secure WebSocket (wss://) connection and receive events', async () => {
    const received = await new Promise<any>((resolve, reject) => {
      const client = new WebSocket(`wss://127.0.0.1:${port}/ws`, {
        rejectUnauthorized: false,
      });

      client.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          client.close();
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });

      client.on('error', reject);
    });

    assert.strictEqual(received.event, 'connected');
    assert.strictEqual(received.payload?.status, 'ready');
  });
});
