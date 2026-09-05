import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { MessageBuilder } from './messageBuilder';
import { resolveAntigravityModelAndEffort, getSafeCliPath } from '../adapters/antigravityAdapter';
import { proxyService } from '../../proxyService';
import { sessionStateManager, UserSessionState } from './sessionStateManager';

export class InferenceGateway {
  /**
   * 2 Strict Execution Engines for Veronica:
   * 1. Antigravity Headless CLI (agy -p --model <model> --effort <effort>)
   * 2. Local LLM (llama-server.exe / local GGUF model via 127.0.0.1:11434)
   * With adaptive stream watchdog and graceful retry.
   */
  public async callLlm(
    config: any,
    messages: { role: string; content: string }[],
    systemPrompt: string,
    userText: string,
    sessionState?: UserSessionState,
    imagePath?: string
  ): Promise<string> {
    // HARD GUARD: Never call real LLM inference during automated test executions
    if (process.env.NODE_ENV === 'test' || process.env.TEST_APP_DIR || process.env.NODE_TEST_CONTEXT) {
      return 'Тестовый мок-ответ: инференс заблокирован тестовым контуром.';
    }

    const activeModel = config.veronica?.model || config.model_name || 'gemini-3.7-flash-high';
    const isAgy = MessageBuilder.isAntigravityModel(activeModel);

    let primaryAgyError: any = null;
    let lastError: any = null;

    // Retry loop: up to 2 attempts
    for (let attempt = 1; attempt <= 2; attempt++) {
      // Engine 1: Antigravity Headless CLI
      if (isAgy) {
        try {
          const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);
          const args = ['--dangerously-skip-permissions', '--output-format', 'stream-json'];

          const resolved = resolveAntigravityModelAndEffort(activeModel, config.veronica?.effort);
          if (resolved.model) {
            args.push('--model', resolved.model);
          }
          if (resolved.effort) {
            args.push('--effort', resolved.effort);
          }
          const agent = config.veronica?.agent;
          if (agent && agent !== 'default' && agent !== 'none') {
            args.push('--agent', agent);
          }

          if (imagePath && fs.existsSync(imagePath)) {
            args.push('--add-dir', path.dirname(imagePath));
          }

          // If retry or continue, reuse active conversation
          const isContinuing = Boolean(sessionState?.antigravityConversationId);
          if (isContinuing && sessionState?.antigravityConversationId) {
            try {
              const lockPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'presence', `${sessionState.antigravityConversationId}.lock`);
              if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
              }
            } catch {}
            args.push('--conversation', sessionState.antigravityConversationId);
          }

          const imagePromptDirective = imagePath
            ? `\n\n[ATTACHED IMAGE FILE: ${imagePath}]\n[DIRECTIVE: Use your multimodal vision capabilities and the view_file tool to thoroughly examine the image at "${imagePath}". Inspect all visual details, text, code, diagrams, or objects in the image, and answer the user question based on the image content.]`
            : '';

          const promptPayload = isContinuing
            ? `USER REQUEST: ${userText}${imagePromptDirective}\n\nREPLY IN RUSSIAN USING TELEGRAM HTML:`
            : `${systemPrompt}\n\nUSER REQUEST: ${userText}${imagePromptDirective}\n\nREPLY IN RUSSIAN USING TELEGRAM HTML:`;

          const proxyUrl = proxyService.getProxyUrlFor('cloud_ai');
          const spawnEnv: NodeJS.ProcessEnv = { ...process.env };
          if (proxyUrl) {
            spawnEnv.HTTP_PROXY = proxyUrl;
            spawnEnv.HTTPS_PROXY = proxyUrl;
            spawnEnv.ALL_PROXY = proxyUrl;
            spawnEnv.http_proxy = proxyUrl;
            spawnEnv.https_proxy = proxyUrl;
            spawnEnv.all_proxy = proxyUrl;
          }

          const agyOutput = await new Promise<string>((resolve, reject) => {
            const child = spawn(cliPath, args, {
              shell: false,
              env: spawnEnv,
              stdio: ['pipe', 'pipe', 'pipe'],
            });

            const killChild = () => {
              try {
                if (process.platform === 'win32' && child.pid) {
                  spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F'], { shell: true });
                } else {
                  child.kill('SIGKILL');
                }
              } catch {}
            };

            let out = '';
            let errOut = '';
            let lineBuffer = '';

            // Stream watchdog: kill if no data received for 45 seconds
            let streamWatchdog: NodeJS.Timeout | null = null;
            const resetWatchdog = () => {
              if (streamWatchdog) clearTimeout(streamWatchdog);
              streamWatchdog = setTimeout(() => {
                killChild();
                reject(new Error('Watchdog: Antigravity stream dropped / stalled for 45s'));
              }, 45000);
            };

            resetWatchdog();

            // Stream prompt over stdin
            child.stdin?.write(promptPayload);
            child.stdin?.end();

            child.stdout?.on('data', (d) => {
              resetWatchdog();
              lineBuffer += d.toString();
              const lines = lineBuffer.split('\n');
              lineBuffer = lines.pop() || '';
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  const ev = JSON.parse(trimmed);
                  if (ev.event === 'init' && ev.conversation_id) {
                    if (sessionState) {
                      sessionState.antigravityConversationId = ev.conversation_id;
                      sessionStateManager.persistSessionMeta(sessionState);
                    }
                  } else if (ev.event === 'step_update' && ev.step_update?.text_delta) {
                    out += ev.step_update.text_delta;
                  } else if (ev.event === 'result') {
                    if (ev.result?.conversation_id && sessionState) {
                      sessionState.antigravityConversationId = ev.result.conversation_id;
                      sessionStateManager.persistSessionMeta(sessionState);
                    }
                    if (ev.result?.usage && sessionState) {
                      sessionState.lastUsage = ev.result.usage;
                    }
                    if (typeof ev.result?.duration_seconds === 'number' && sessionState) {
                      sessionState.lastDurationSeconds = ev.result.duration_seconds;
                    }
                    if (ev.result?.response && !out.trim()) {
                      out = ev.result.response;
                    }
                    if (ev.result?.error) {
                      errOut = (errOut ? errOut + '\n' : '') + ev.result.error;
                    }
                  }
                } catch {
                  if (!trimmed.startsWith('{') && !trimmed.startsWith('warning:') && !trimmed.startsWith('jetski:')) {
                    out += trimmed + '\n';
                  }
                }
              }
            });

            child.stderr?.on('data', (d) => {
              resetWatchdog();
              errOut += d.toString();
            });

            // Hard timeout at 240s total execution limit
            const totalTimer = setTimeout(() => {
              if (streamWatchdog) clearTimeout(streamWatchdog);
              killChild();
              reject(new Error('Antigravity CLI timed out after 240s total execution limit'));
            }, 240000);

            child.on('close', (code) => {
              clearTimeout(totalTimer);
              if (streamWatchdog) clearTimeout(streamWatchdog);

              if (lineBuffer.trim()) {
                try {
                  const ev = JSON.parse(lineBuffer.trim());
                  if (ev.step_update?.text_delta) {
                    out += ev.step_update.text_delta;
                  } else if (ev.result?.response && !out.trim()) {
                    out = ev.result.response;
                  }
                  if (ev.result?.usage && sessionState) {
                    sessionState.lastUsage = ev.result.usage;
                  }
                  if (typeof ev.result?.duration_seconds === 'number' && sessionState) {
                    sessionState.lastDurationSeconds = ev.result.duration_seconds;
                  }
                  if (ev.result?.error) {
                    errOut = (errOut ? errOut + '\n' : '') + ev.result.error;
                  }
                } catch {}
              }
              if (code === 0 && out.trim()) {
                let finalOut = out.trim();
                if (sessionState?.lastUsage && (sessionState.lastUsage.total_tokens || sessionState.lastUsage.input_tokens)) {
                  const u = sessionState.lastUsage;
                  const sec = sessionState.lastDurationSeconds;
                  const details: string[] = [];
                  if (u.input_tokens) details.push(`in: ${Number(u.input_tokens).toLocaleString()}`);
                  if (u.output_tokens) details.push(`out: ${Number(u.output_tokens).toLocaleString()}`);
                  if (u.thinking_tokens) details.push(`think: ${Number(u.thinking_tokens).toLocaleString()}`);
                  if (u.cache_read_tokens) details.push(`cached: ${Number(u.cache_read_tokens).toLocaleString()}`);
                  const secStr = sec ? ` | ${Number(sec).toFixed(1)}с` : '';
                  const badge = `\n\n⚡ <i>${Number(u.total_tokens || 0).toLocaleString()} токенов (${details.join(' | ')})${secStr}</i>`;
                  finalOut += badge;
                }
                resolve(finalOut);
              } else {
                reject(new Error(`agy exited with code ${code}: ${errOut || out || 'no output'}`));
              }
            });

            child.on('error', (err) => {
              clearTimeout(totalTimer);
              if (streamWatchdog) clearTimeout(streamWatchdog);
              reject(err);
            });
          });

          if (agyOutput) return agyOutput;
        } catch (agyErr: any) {
          primaryAgyError = agyErr;
          lastError = agyErr;
          const errMsg = agyErr?.message || String(agyErr);
          console.warn(`[InferenceGateway] [Antigravity CLI Attempt ${attempt} Failed]:`, errMsg);

          // Check if quota error - DO NOT retry immediately and DO NOT reset conversation ID!
          const isQuota = /quota reached|quota exceeded|subscription to increase your limits|rate limit|resets in/i.test(errMsg);
          if (isQuota) {
            console.warn('[InferenceGateway] Quota limit reached, aborting retry loop.');
            break;
          }

          if (sessionState && sessionState.antigravityConversationId) {
            console.warn('[InferenceGateway] Resetting stale/stalled conversation ID:', sessionState.antigravityConversationId);
            try {
              const lockPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'presence', `${sessionState.antigravityConversationId}.lock`);
              if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
              }
            } catch {}
            sessionState.antigravityConversationId = undefined;
            sessionStateManager.persistSessionMeta(sessionState);
          }

          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          console.warn('[InferenceGateway] Antigravity failed. Falling through to Engine 2 (Local LLM)...');
          break;
        }
      }

      // Engine 2: Local llama-server
      const timeoutMs = 8000;
      const localHost = config.local_server?.host || '127.0.0.1';
      const localPort = config.local_server?.port || 11434;

      try {
        const localRes = await fetch(`http://${localHost}:${localPort}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: activeModel.replace(/^local:/, '') || 'local',
            messages,
            temperature: 0.4,
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (localRes.ok) {
          const localJson: any = await localRes.json();
          const text = localJson.choices?.[0]?.message?.content;
          if (text) return text;
        }
        throw new Error(`Local LLM HTTP ${localRes.status}`);
      } catch (localErr: any) {
        lastError = primaryAgyError || localErr;
        const detail = localErr?.cause?.code || localErr?.cause?.message || localErr?.message;
        console.warn(`[InferenceGateway] [Local LLM Offline/Timeout Attempt ${attempt}]:`, detail);
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new Error('All LLM inference attempts exhausted.');
  }

  public formatLlmErrorResponse(err: any, _userText: string, session: UserSessionState): string {
    const rawMsg = err?.cause?.message || err?.cause?.code || err?.message || String(err);
    const isQuota = /quota reached|quota exceeded|subscription to increase your limits|resets in/i.test(rawMsg);
    const isTimeout = /timed out|watchdog|stalled/i.test(rawMsg);
    const isNotFound = /enoent|not found|cannot find/i.test(rawMsg);

    const resetMatch = rawMsg.match(/Resets in ([^\.\n\r]+)/i);
    const resetText = resetMatch ? resetMatch[1].trim() : '';

    const sessionInfo = session.antigravityConversationId
      ? `\n\n📌 <i>Активная сессия сохранена (<code>${session.antigravityConversationId.substring(0, 8)}</code>). После устранения причины диалог продолжится в этой же сессии.</i>`
      : '';

    if (isQuota) {
      return (
        `⚠️ <b>Квота Antigravity CLI исчерпана</b>\n\n` +
        `Запрос к модели отклонён из-за достижения лимита квоты Google AI / Antigravity CLI:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <b>Что делать:</b>\n` +
        (resetText ? `• <b>Автоматический сброс:</b> через <b>${this.escapeHtml(resetText)}</b>\n` : '') +
        `• <b>Сменить аккаунт:</b> выполните в терминале <code>agy auth</code>\n` +
        `• Либо переключите модель/профиль в меню или настройках 0xAgent.` +
        sessionInfo
      );
    }

    if (isTimeout) {
      return (
        `⏱️ <b>Таймаут выполнения команды</b>\n\n` +
        `Движок <code>agy</code> выполнялся дольше лимита или поток данных был прерван:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <i>Сессия сохранена. Попробуйте повторить запрос или разбить задачу на более компактные шаги.</i>` +
        sessionInfo
      );
    }

    if (isNotFound) {
      return (
        `❌ <b>Исполняемый файл agy не найден</b>\n\n` +
        `Операционная система не может найти CLI <code>agy</code>:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <i>Проверьте путь к agy в настройках Вероники или добавьте путь к agy в системную переменную PATH.</i>`
      );
    }

    const isNet = /network issue|issue connecting to the server|error id:\s*[a-f0-9-]+|fetch failed|network error|econnreset|etimedout|enotfound|socket hang up|connection refused|unable to connect|502|503|504|tls handshake timeout|network is unreachable|stream was interrupted/i.test(rawMsg);
    if (isNet) {
      return (
        `🌐 <b>Сетевой сбой связи с Google AI / Antigravity CLI</b>\n\n` +
        `Не удалось установить соединение с сервером инференса:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <b>Что проверить:</b>\n` +
        `• Доступность интернета и прокси / VPN\n` +
        `• Статус подключения к Google AI Studio / Antigravity\n` +
        `• Попробуйте повторить запрос через минуту.` +
        sessionInfo
      );
    }

    return (
      `❌ <b>Сбой инференса Вероники</b>\n\n` +
      `Не удалось получить ответ от движков инференса:\n` +
      `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
      `💡 <i>Проверьте сетевой статус / прокси или повторите запрос через минуту.</i>` +
      sessionInfo
    );
  }

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const inferenceGateway = new InferenceGateway();
