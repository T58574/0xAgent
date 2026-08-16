import { useEffect, useRef } from 'react';
import * as api from '../services/api';
import { ChatSession, ChatMessage, LiveTelemetry, ToolCallInfo, PersonaMetadata, TodoItem } from '../types';

interface UseAppWebSocketParams {
  currentSessionIdRef: React.MutableRefObject<string | null>;
  currentSessionRef: React.MutableRefObject<ChatSession | null>;
  activeSessionsMapRef: React.MutableRefObject<Map<string, ChatSession>>;
  updateSessionState: (sess: ChatSession) => void;
  setLiveTelemetry: React.Dispatch<React.SetStateAction<LiveTelemetry | null>>;
  setAgentStatus: React.Dispatch<React.SetStateAction<'idle' | 'thinking' | 'waiting_approval' | 'executing_tool'>>;
  setPersonas: React.Dispatch<React.SetStateAction<PersonaMetadata[]>>;
  setActivePersonaId: React.Dispatch<React.SetStateAction<string>>;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setCurrentSession: React.Dispatch<React.SetStateAction<ChatSession | null>>;
  loadWorkspaceTree: (dir: string) => void;
  addLog: (msg: string) => void;
  workspaceDir?: string;
}

export function useAppWebSocket({
  currentSessionIdRef,
  currentSessionRef,
  activeSessionsMapRef,
  updateSessionState,
  setLiveTelemetry,
  setAgentStatus,
  setPersonas,
  setActivePersonaId,
  setConfig,
  setSessions,
  setCurrentSession,
  loadWorkspaceTree,
  addLog,
  workspaceDir,
}: UseAppWebSocketParams) {
  const pendingTokensRef = useRef<
    Map<string, { sessionId: string; messageId: string; tokens: string[]; telemetry?: any }>
  >(new Map());
  const streamThrottleTimerRef = useRef<any>(null);

  const getTargetSessionForEvent = (payload: any): ChatSession | null => {
    const sid = payload?.sessionId || currentSessionIdRef.current;
    if (!sid) return null;
    if (currentSessionRef.current?.id === sid) return currentSessionRef.current;
    return activeSessionsMapRef.current.get(sid) || null;
  };

  useEffect(() => {
    const un1 = api.listen<any>('agent-message-start', (event) => {
      const sess = getTargetSessionForEvent(event.payload);
      if (!sess) return;

      const hasMsg = sess.messages.some((m) => m.id === event.payload.id);
      if (!hasMsg) {
        const newAssistantMsg: ChatMessage = {
          id: event.payload.id,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          tool_calls: [],
        };
        const updated = {
          ...sess,
          messages: [...sess.messages, newAssistantMsg],
        };
        updateSessionState(updated);
      }
    });

    const flushPendingTokens = () => {
      if (pendingTokensRef.current.size === 0) return;

      pendingTokensRef.current.forEach((val) => {
        const { sessionId, messageId, tokens, telemetry } = val;
        const chunk = tokens.join('');
        val.tokens = [];

        if (telemetry && sessionId === currentSessionIdRef.current) {
          setLiveTelemetry(telemetry);
        }

        if (!chunk) return;

        const targetSession =
          (currentSessionRef.current?.id === sessionId ? currentSessionRef.current : null) ||
          activeSessionsMapRef.current.get(sessionId);
        if (!targetSession) return;

        let hasMsg = false;
        const updatedMessages = targetSession.messages.map((m) => {
          if (m.id === messageId) {
            hasMsg = true;
            return { ...m, content: m.content + chunk };
          }
          return m;
        });

        if (!hasMsg) {
          updatedMessages.push({
            id: messageId,
            role: 'assistant',
            content: chunk,
            timestamp: Date.now(),
            tool_calls: [],
          });
        }

        updateSessionState({
          ...targetSession,
          messages: updatedMessages,
        });
      });

      pendingTokensRef.current.clear();
    };

    const un2 = api.listen<any>('agent-token-stream', (event) => {
      const sess = getTargetSessionForEvent(event.payload);
      if (!sess) return;

      const sid = event.payload.sessionId || currentSessionIdRef.current || sess.id;
      const msgId = event.payload.message_id;
      const token = event.payload.token || '';

      let entry = pendingTokensRef.current.get(msgId);
      if (!entry) {
        entry = { sessionId: sid, messageId: msgId, tokens: [] };
        pendingTokensRef.current.set(msgId, entry);
      }
      entry.tokens.push(token);

      if (
        sid === currentSessionIdRef.current &&
        (event.payload.tokensPerSec || event.payload.contextUsed)
      ) {
        entry.telemetry = {
          messageId: event.payload.message_id,
          tokensPerSec: event.payload.tokensPerSec,
          tokenCount: event.payload.tokenCount,
          contextUsed: event.payload.contextUsed,
          contextMax: event.payload.contextMax,
          modelName: event.payload.modelName,
        };
      }

      if (!streamThrottleTimerRef.current) {
        streamThrottleTimerRef.current = setTimeout(() => {
          streamThrottleTimerRef.current = null;
          flushPendingTokens();
        }, 50);
      }
    });

    const un3 = api.listen<any>('agent-status-changed', async (event) => {
      const payload = event.payload;
      const statusStr = typeof payload === 'string' ? payload : payload?.status;
      const sid = typeof payload === 'object' ? payload?.sessionId : currentSessionIdRef.current;

      if (sid === currentSessionIdRef.current) {
        setAgentStatus(statusStr as any);
      }
      addLog(`Agent status changed [${sid || 'system'}]: ${statusStr}`);

      if (statusStr === 'idle') {
        flushPendingTokens();
        if (sid === currentSessionIdRef.current) {
          setLiveTelemetry(null);
        }
        if (sid) {
          try {
            const fresh = await api.load_session(sid);
            if (fresh && fresh.messages) {
              updateSessionState(fresh);
            }
          } catch (err) {
            console.error('Failed to sync session on idle:', err);
          }
        }
      }
    });

    const unErr = api.listen<any>('agent-error', async (event) => {
      const payload = event.payload;
      const msgText =
        typeof payload === 'string' ? payload : payload?.message || JSON.stringify(payload);
      const sid =
        typeof payload === 'object' && payload?.sessionId
          ? payload.sessionId
          : currentSessionIdRef.current;
      addLog(`Agent error [${sid || 'system'}]: ${msgText}`);

      if (sid) {
        try {
          const fresh = await api.load_session(sid);
          if (fresh && fresh.messages) {
            updateSessionState(fresh);
          }
        } catch {}
      }
    });

    const onWsReconnected = async () => {
      const sid = currentSessionIdRef.current;
      if (sid) {
        try {
          const fresh = await api.load_session(sid);
          if (fresh && fresh.messages) {
            updateSessionState(fresh);
          }
        } catch {}
      }
    };
    window.addEventListener('0xagent-ws-reconnected', onWsReconnected);

    const un4 = api.listen<any>('agent-tools-updated', (event) => {
      const sess = getTargetSessionForEvent(event.payload);
      if (!sess) return;

      const updatedMessages = sess.messages.map((m) => {
        if (m.id === event.payload.message_id) {
          return {
            ...m,
            tool_calls: event.payload.tools,
          };
        }
        return m;
      });

      updateSessionState({
        ...sess,
        messages: updatedMessages,
      });
    });

    const un5 = api.listen<any>('agent-tool-status-changed', (event) => {
      const sess = getTargetSessionForEvent(event.payload);
      if (!sess) return;

      const updatedMessages = sess.messages.map((m) => {
        if (m.id === event.payload.message_id && m.tool_calls) {
          const updatedTools = m.tool_calls.map((t) => {
            if (t.id === event.payload.tool_id) {
              return {
                ...t,
                status: event.payload.status as ToolCallInfo['status'],
                output: event.payload.output !== undefined ? event.payload.output : t.output,
              };
            }
            return t;
          });
          return {
            ...m,
            tool_calls: updatedTools,
          };
        }
        return m;
      });

      updateSessionState({
        ...sess,
        messages: updatedMessages,
      });

      if (event.payload.status === 'completed' && workspaceDir) {
        loadWorkspaceTree(workspaceDir);
      }
    });

    const unPersona = api.listen<{ activePersonaId?: string; personas: PersonaMetadata[] }>(
      'persona-changed',
      (event) => {
        if (event.payload?.personas) {
          setPersonas(event.payload.personas);
        }
        if (event.payload?.activePersonaId) {
          setActivePersonaId(event.payload.activePersonaId);
          setConfig((prev: any) =>
            prev ? { ...prev, active_persona_id: event.payload.activePersonaId } : prev
          );
        }
      }
    );

    const unTodos = api.listen<{ sessionId: string; todos: TodoItem[] }>(
      'session-todos-updated',
      (event) => {
        if (event.payload?.sessionId && event.payload?.todos) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === event.payload.sessionId ? { ...s, active_todos: event.payload.todos } : s
            )
          );
          if (currentSessionIdRef.current === event.payload.sessionId) {
            setCurrentSession((prev) =>
              prev ? { ...prev, active_todos: event.payload.todos } : prev
            );
            if (currentSessionRef.current) {
              currentSessionRef.current.active_todos = event.payload.todos;
            }
          }
        }
      }
    );

    return () => {
      if (streamThrottleTimerRef.current) {
        clearTimeout(streamThrottleTimerRef.current);
        streamThrottleTimerRef.current = null;
      }
      flushPendingTokens();
      un1();
      un2();
      un3();
      unErr();
      un4();
      un5();
      unPersona();
      unTodos();
      window.removeEventListener('0xagent-ws-reconnected', onWsReconnected);
    };
  }, [workspaceDir]);
}
