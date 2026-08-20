import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';

interface BridgeOptions {
  model?: string;
  contextSize?: number;
  customArgs?: string;
  specType?: string;
  specDraftNMax?: number;
  specDraftPMin?: number;
  prompt?: string;
}

const APP_DIR = path.join(os.homedir(), '.0xagent');
const AUTH_FILE = path.join(APP_DIR, 'auth.json');
const CONFIG_FILE = path.join(APP_DIR, 'config.json');

function getAuthToken(): string {
  if (!fs.existsSync(AUTH_FILE)) {
    return '';
  }
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const secret = parsed.secret || '';
    if (!secret) return '';

    const payload = Buffer.from(`${Date.now()}:${crypto.randomBytes(16).toString('hex')}`).toString('base64url');
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `0xagt_${payload}.${hmac}`;
  } catch {
    return '';
  }
}

async function requestBackend(
  method: string,
  apiPath: string,
  body?: any,
  port: number = 3001
): Promise<{ status: number; data: any }> {
  const token = getAuthToken();
  const payload = body ? JSON.stringify(body) : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = token;
  }
  if (payload) {
    headers['Content-Length'] = String(Buffer.byteLength(payload));
  }

  const makeReq = (useHttps: boolean): Promise<{ status: number; data: any }> => {
    const transport = useHttps ? https : http;
    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          hostname: '127.0.0.1',
          port,
          path: apiPath,
          method,
          headers,
          rejectUnauthorized: false,
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(raw);
              resolve({ status: res.statusCode || 200, data: json });
            } catch {
              resolve({ status: res.statusCode || 200, data: raw });
            }
          });
        }
      );

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Backend request timed out'));
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  try {
    return await makeReq(true);
  } catch (err: any) {
    if (err?.code === 'EPROTO' || err?.message?.includes('socket hang up') || err?.message?.includes('ECONNRESET')) {
      return await makeReq(false);
    }
    throw err;
  }
}

async function runBridge(options: BridgeOptions = {}) {
  console.log('====================================================');
  console.log('[*] 0xAgent Diagnostics & Server Test Bridge');
  console.log('====================================================\n');

  let currentConfig: any = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {}
  }

  const lsConfig = currentConfig.local_server || {};
  const targetModel = options.model || lsConfig.model_path || path.join(process.cwd(), 'models', 'RVN-IQ3_S-multilingual-mtp.gguf');
  const contextSize = options.contextSize || lsConfig.ctx_size || 16384;
  const customArgs = options.customArgs !== undefined ? options.customArgs : (lsConfig.custom_args || '-ctk q8_0 -ctv q8_0');
  const specType = options.specType || lsConfig.spec_type || 'draft-mtp';
  const specDraftNMax = options.specDraftNMax !== undefined ? options.specDraftNMax : (lsConfig.spec_draft_n_max || 3);
  const specDraftPMin = options.specDraftPMin !== undefined ? options.specDraftPMin : (lsConfig.spec_draft_p_min || 0.05);

  console.log(`[›] Target Model: ${path.basename(targetModel)}`);
  console.log(`[›] Context Size: ${contextSize} tokens`);
  console.log(`[›] Custom Flags: ${customArgs}`);
  console.log(`[›] Speculative : ${specType} (n-max: ${specDraftNMax}, p-min: ${specDraftPMin})\n`);

  console.log('[*] Step 1: Starting llama-server through 0xAgent Backend API (/api/start-local-server)...');

  try {
    const startRes = await requestBackend('POST', '/api/start-local-server', {
      modelPath: targetModel,
      ctxSize: contextSize,
      customArgs,
      specType,
      specDraftNMax,
      specDraftPMin,
      gpuLayers: 99,
      parallelSlots: 1,
      flashAttn: true,
      jinja: true,
      reasoningPreserve: true,
      reasoningFormat: 'deepseek',
    });

    if (startRes.status !== 200) {
      console.error(`[FAIL] Backend returned error:`, startRes.data);
      return;
    }
    console.log(`[OK] Server start initiated (PID: ${startRes.data.pid || 'running'})\n`);
  } catch (err: any) {
    console.error(`[FAIL] Could not connect to 0xAgent backend on port 3001: ${err.message}`);
    return;
  }

  console.log('[*] Step 2: Waiting for model to load in VRAM and health check (/api/server-health)...');
  let isReady = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const health = await requestBackend('GET', '/api/server-health');
      if (health.data?.ok && health.data?.status === 'ok') {
        isReady = true;
        console.log(`[OK] llama-server is healthy and ready! (after ${(i + 1) * 1.5}s)\n`);
        break;
      } else {
        process.stdout.write(`... status: ${health.data?.status || 'loading'}\n`);
      }
    } catch {}
  }

  if (!isReady) {
    console.error('[FAIL] Timeout waiting for llama-server to become ready.');
    return;
  }

  const promptText = options.prompt || 'Привет! Назови свое имя и напиши короткую функцию быстрой сортировки на Python.';
  console.log(`[*] Step 3: Sending inference prompt: "${promptText}"`);

  const reqBody = JSON.stringify({
    model: path.basename(targetModel),
    messages: [
      {
        role: 'system',
        content: 'Ты — 0xAgent, продвинутый ИИ-ассистент разработчика. Отвечай на чистом русском языке.',
      },
      {
        role: 'user',
        content: promptText,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
    stream: false,
    chat_template_kwargs: {
      enable_thinking: true,
      reasoning_effort: 'medium',
    },
  });

  const serverHost = lsConfig.host || '127.0.0.1';
  const serverPort = lsConfig.port || 11434;

  const t0 = Date.now();
  const rawRes = await new Promise<string>((resolve, reject) => {
    const req = http.request(
      {
        hostname: serverHost,
        port: serverPort,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(reqBody),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      }
    );
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error('Inference request timed out after 45s'));
    });
    req.on('error', reject);
    req.write(reqBody);
    req.end();
  });

  const totalDurationMs = Date.now() - t0;

  try {
    const json = JSON.parse(rawRes);
    const msg = json.choices?.[0]?.message;
    const usage = json.usage;
    const timings = json.timings;

    console.log('\n====================================================');
    console.log('[+] Live Telemetry & Benchmark Results');
    console.log('====================================================');
    if (timings) {
      console.log(`[›] Prompt Eval Speed  : ${(timings.prompt_per_second || 0).toFixed(2)} t/s (${timings.prompt_n || 0} tokens in ${(timings.prompt_ms || 0).toFixed(1)} ms)`);
      console.log(`[›] Generation Speed   : ${(timings.predicted_per_second || 0).toFixed(2)} t/s (${timings.predicted_n || 0} tokens in ${(timings.predicted_ms || 0).toFixed(1)} ms)`);
      if (timings.draft_n > 0) {
        const acceptRate = ((timings.draft_n_accepted / timings.draft_n) * 100).toFixed(1);
        console.log(`[›] MTP Draft Accepted : ${timings.draft_n_accepted} / ${timings.draft_n} (${acceptRate}%)`);
      }
    } else if (usage) {
      const tps = (usage.completion_tokens / (totalDurationMs / 1000)).toFixed(2);
      console.log(`[›] Total Tokens       : ${usage.total_tokens} (completion: ${usage.completion_tokens})`);
      console.log(`[›] Generation Speed   : ${tps} t/s`);
    }

    console.log('\n--- Model Output Preview ---');
    const content = msg?.content || '';
    console.log(content.length > 300 ? content.substring(0, 300) + '...' : content);
    console.log('-----------------------------\n');
  } catch (err: any) {
    console.log('Raw output:', rawRes);
  }
}

// Support CLI execution with arguments
const args = process.argv.slice(2);
const options: BridgeOptions = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ctx' && args[i + 1]) options.contextSize = Number(args[++i]);
  if (args[i] === '--custom-args' && args[i + 1]) options.customArgs = args[++i];
  if (args[i] === '--draft-n' && args[i + 1]) options.specDraftNMax = Number(args[++i]);
  if (args[i] === '--model' && args[i + 1]) options.model = args[++i];
  if (args[i] === '--prompt' && args[i + 1]) options.prompt = args[++i];
}

runBridge(options);
