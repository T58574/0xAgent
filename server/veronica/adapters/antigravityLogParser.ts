import { AntigravityUsage } from '../../../src/types';

export function isNetworkError(text: string): boolean {
  if (!text) return false;
  return /network issue|issue connecting to the server|fetch failed|network error|econnreset|etimedout|enotfound|socket hang up|connection refused|unable to connect|502 bad gateway|503 service unavailable|504 gateway timeout|ssl.*handshake|request to .* failed|abort(?:ed)?|tls handshake timeout|network is unreachable|stream was interrupted|error id:\s*[a-f0-9-]+/i.test(text);
}

export interface ParsedStreamJsonEvent {
  eventType?: 'init' | 'step_update' | 'result' | 'unknown';
  conversationId?: string;
  isToolActive?: boolean;
  isToolError?: boolean;
  toolName?: string;
  response?: string;
  usage?: AntigravityUsage;
  durationSeconds?: number;
  error?: string;
  rawJson?: any;
}

export class AntigravityLogParser {
  public static parseLine(trimmedLine: string): {
    isJson: boolean;
    parsedEvent?: ParsedStreamJsonEvent;
    isNetworkErr: boolean;
    errorSnippet?: string;
  } {
    const isNetworkErr = isNetworkError(trimmedLine);
    let errorSnippet: string | undefined = undefined;

    if (trimmedLine.toLowerCase().startsWith('error:')) {
      errorSnippet = trimmedLine;
    }

    if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
      try {
        const ev = JSON.parse(trimmedLine);
        const result: ParsedStreamJsonEvent = {
          rawJson: ev,
          eventType: ev.event || 'unknown',
        };

        if (ev.event === 'init' && ev.conversation_id) {
          result.conversationId = ev.conversation_id;
        } else if (ev.conversation_id) {
          result.conversationId = ev.conversation_id;
        }

        if (ev.event === 'step_update') {
          const su = ev.step_update;
          if (su?.step_type === 'tool') {
            if (su?.state === 'ACTIVE') {
              result.isToolActive = true;
              result.toolName = su.tool_name || su.tool_info?.name || 'tool';
            } else if (su?.state === 'ERROR') {
              result.isToolError = true;
              const errMsg = su?.tool_info?.error?.message || '';
              if (errMsg) {
                result.error = errMsg;
              }
            }
          }
        }

        if (ev.event === 'result') {
          if (ev.result?.conversation_id) {
            result.conversationId = ev.result.conversation_id;
          }
          if (ev.result?.response) {
            result.response = ev.result.response;
          }
          if (ev.result?.usage) {
            result.usage = ev.result.usage;
          }
          if (typeof ev.result?.duration_seconds === 'number') {
            result.durationSeconds = ev.result.duration_seconds;
          }
          if (ev.result?.error) {
            result.error = ev.result.error;
            errorSnippet = ev.result.error;
          }
        }

        return {
          isJson: true,
          parsedEvent: result,
          isNetworkErr: isNetworkErr || (result.error ? isNetworkError(result.error) : false),
          errorSnippet,
        };
      } catch {
        return { isJson: false, isNetworkErr, errorSnippet };
      }
    }

    return { isJson: false, isNetworkErr, errorSnippet };
  }
}
