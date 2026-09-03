#!/usr/bin/env node

/**
 * Veronica Model Context Protocol (MCP) Server
 * Exposes 0xAgent & Veronica Orchestrator capabilities (task dispatch, project discovery, doc management, status)
 * as native MCP tools over JSON-RPC stdio transport.
 */

import https from 'node:https';
import http from 'node:http';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const CONFIG_PATH = path.join(os.homedir(), '.0xagent', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function callVeronicaCli(payload) {
  return new Promise((resolve, reject) => {
    const port = process.env.PORT || 3001;
    const postData = JSON.stringify(payload);

    function tryReq(protocolMod, isHttps) {
      const req = protocolMod.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/veronica/cli',
          method: 'POST',
          rejectUnauthorized: false,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 15000,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (json.success) {
                resolve(json.data);
              } else {
                reject(new Error(json.error || 'Request failed'));
              }
            } catch {
              resolve(body);
            }
          });
        }
      );

      req.on('error', (err) => {
        if (isHttps) {
          tryReq(http, false);
        } else {
          reject(new Error(`Failed to connect to 0xAgent server: ${err.message}`));
        }
      });

      req.write(postData);
      req.end();
    }

    tryReq(https, true);
  });
}

const TOOLS = [
  {
    name: 'veronica_task',
    description: 'Dispatch an autonomous background agent task to a project via Veronica Orchestrator (Antigravity agy worker).',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name (e.g. 0xAgent, 0xVoice2Text, T58574, etc.)' },
        prompt: { type: 'string', description: 'Detailed, actionable task prompt for the autonomous agent' },
        skill: { type: 'string', description: 'Optional skill name (default: custom_task)' },
      },
      required: ['project', 'prompt'],
    },
  },
  {
    name: 'veronica_project_list',
    description: 'List all auto-discovered dev projects and workspaces registered in the 0xAgent ecosystem.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'veronica_doc_get',
    description: 'Retrieve project passport, technical metrics, and recent changelog history for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
      },
      required: ['project'],
    },
  },
  {
    name: 'veronica_doc_set',
    description: 'Overwrite or set project passport documentation in Markdown format.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
        content: { type: 'string', description: 'New passport content in Markdown format' },
      },
      required: ['project', 'content'],
    },
  },
  {
    name: 'veronica_doc_append',
    description: 'Append an operational note or changelog entry to a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
        message: { type: 'string', description: 'Changelog message or note' },
      },
      required: ['project', 'message'],
    },
  },
  {
    name: 'veronica_status',
    description: 'Check 0xAgent supervisor health, telemetry, active models, and configuration status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'veronica_purge_vram',
    description: 'Force purge GPU VRAM and terminate all local inference processes.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'veronica_task_list',
    description: 'Query recent and active autonomous agent tasks in 0xAgent ecosystem.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Filter by project name (optional)' },
        status: { type: 'string', description: 'Filter by task status: running, completed, failed, crashed (optional)' },
        limit: { type: 'number', description: 'Max tasks to return (default: 20)' },
      },
    },
  },
  {
    name: 'veronica_task_get',
    description: 'Retrieve detailed status, summary, and telemetry for a specific task.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'veronica_history',
    description: 'Fetch operational journal history and changelogs for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
        limit: { type: 'number', description: 'Number of history items (default: 20)' },
      },
      required: ['project'],
    },
  },
  {
    name: 'veronica_context',
    description: 'Retrieve rich dense project context and architecture metadata for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
        task_id: { type: 'string', description: 'Optional task ID' },
      },
      required: ['project'],
    },
  },
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'veronica_task': {
      const data = await callVeronicaCli({
        command: 'task_create',
        project: args.project,
        custom_prompt: args.prompt,
        skill: args.skill || 'custom_task',
      });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_task_list': {
      const data = await callVeronicaCli({
        command: 'task_list',
        project: args.project,
        status: args.status,
        limit: args.limit || 20,
      });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_task_get': {
      const data = await callVeronicaCli({
        command: 'task_get',
        task_id: args.task_id,
      });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_history': {
      const data = await callVeronicaCli({
        command: 'history',
        project: args.project,
        limit: args.limit || 20,
      });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_context': {
      const data = await callVeronicaCli({
        command: 'context',
        project: args.project,
        task_id: args.task_id,
      });
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }

    case 'veronica_project_list': {
      const data = await callVeronicaCli({ command: 'projects_list' });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_doc_get': {
      const data = await callVeronicaCli({ command: 'doc_get', project: args.project });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_doc_set': {
      const data = await callVeronicaCli({
        command: 'doc_update',
        project: args.project,
        content: args.content,
      });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_doc_append': {
      const data = await callVeronicaCli({
        command: 'doc_append',
        project: args.project,
        message: args.message,
      });
      return JSON.stringify(data, null, 2);
    }

    case 'veronica_status': {
      const cfg = loadConfig();
      const statusData = {
        backendServer: 'https://127.0.0.1:3001',
        activeLanguage: cfg.language || 'ru',
        activeModel: cfg.model_name || 'None',
        activePersona: cfg.active_persona_id || 'veronica',
        configPath: CONFIG_PATH,
        telegramBot: cfg.veronica?.telegram_token ? 'Configured' : 'Disabled',
      };
      return JSON.stringify(statusData, null, 2);
    }

    case 'veronica_purge_vram': {
      try {
        execSync('taskkill /F /IM llama-server.exe', { stdio: 'ignore' });
      } catch {}
      return JSON.stringify({ success: true, message: 'GPU VRAM purged, inference processes terminated.' }, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function sendResponse(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const request = JSON.parse(trimmed);
    const { id, method, params } = request;

    if (method === 'initialize') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'veronica-mcp',
            version: '1.0.0',
          },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      // No response needed for notification
      return;
    }

    if (method === 'ping') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {},
      });
      return;
    }

    if (method === 'tools/list') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS,
        },
      });
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: toolArgs } = params || {};
      try {
        const textResult = await handleToolCall(name, toolArgs || {});
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: textResult,
              },
            ],
          },
        });
      } catch (err) {
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error: ${err.message}`,
              },
            ],
            isError: true,
          },
        });
      }
      return;
    }

    // Default unhandled method
    if (id !== undefined) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      });
    }
  } catch (err) {
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${err.message}`,
      },
    });
  }
});
