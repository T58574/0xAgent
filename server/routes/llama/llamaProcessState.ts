import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';

export type BroadcastFn = (event: string, payload: any) => void;

export const serverLogsBuffer: string[] = [];
export const LLAMA_LOG_FILE = path.join(os.homedir(), '.0xagent', 'llama-server.log');

export let activeLlamaProcess: ChildProcess | null = null;
export let isIntentionalStop = false;
export let lastLaunchParams: { targetExe: string; args: string[]; host: string; port: number } | null = null;

export function appendServerLog(msg: string, broadcast?: BroadcastFn): void {
  if (!msg) return;
  const timeStr = new Date().toLocaleTimeString();
  const formatted = msg.startsWith('[') ? msg : `[${timeStr}] ${msg}`;

  serverLogsBuffer.push(formatted);
  if (serverLogsBuffer.length > 1000) {
    serverLogsBuffer.shift();
  }

  if (broadcast) {
    broadcast('llama-server-log', formatted);
  }

  try {
    const dir = path.dirname(LLAMA_LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LLAMA_LOG_FILE, `${formatted}\n`, 'utf-8');
  } catch {}
}

export function stopLlamaServerProcess(broadcast: BroadcastFn): void {
  isIntentionalStop = true;
  lastLaunchParams = null;

  if (activeLlamaProcess) {
    appendServerLog('[llama.cpp] Stopping server process...', broadcast);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(activeLlamaProcess.pid), '/f', '/t']);
      } else {
        activeLlamaProcess.kill('SIGKILL');
      }
    } catch (err: any) {
      appendServerLog(`[ERROR] Failed to kill process: ${err.message}`, broadcast);
    }
    activeLlamaProcess = null;
  }
  broadcast('llama-server-status', { status: 'stopped' });
}

export function stripAnsiCodes(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export function setActiveLlamaProcess(proc: ChildProcess | null): void {
  activeLlamaProcess = proc;
}

export function setIntentionalStop(val: boolean): void {
  isIntentionalStop = val;
}

export function setLastLaunchParams(params: { targetExe: string; args: string[]; host: string; port: number } | null): void {
  lastLaunchParams = params;
}
