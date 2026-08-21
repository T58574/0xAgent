import { useState, useRef, useEffect } from 'react';
import * as api from '../services/api';
import { AppConfig, ChatSession, ChatMessage, JarvisSparkProposal } from '../types';
import { generateShortId } from '../utils/helpers';
import { useI18n } from '../i18n';

interface UseSessionManagerOptions {
  config: AppConfig | null;
  loadWorkspaceTree: (dirPath: string) => Promise<void>;
  setWorkspaceTree: React.Dispatch<React.SetStateAction<any[]>>;
  setHas0xAgentMd: React.Dispatch<React.SetStateAction<boolean>>;
  addLog: (msg: string) => void;
  showToast: (msg: string, type: 'info' | 'success' | 'error' | 'warning') => void;
  setActiveView: (view: 'chat' | 'workspace' | 'settings' | 'analytics' | 'knowledge') => void;
  setIsJarvisOpen: (open: boolean) => void;
}

export function useSessionManager({
  config,
  loadWorkspaceTree,
  setWorkspaceTree,
  setHas0xAgentMd,
  addLog,
  showToast,
  setActiveView,
  setIsJarvisOpen,
}: UseSessionManagerOptions) {
  const { t, formatString } = useI18n();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);

  const activeSessionsMapRef = useRef<Map<string, ChatSession>>(new Map());
  const currentSessionIdRef = useRef<string | null>(null);
  const currentSessionRef = useRef<ChatSession | null>(null);

  useEffect(() => {
    currentSessionRef.current = currentSession;
    if (currentSession) {
      activeSessionsMapRef.current.set(currentSession.id, currentSession);
    }
  }, [currentSession]);

  const updateSessionState = (newSession: ChatSession) => {
    activeSessionsMapRef.current.set(newSession.id, newSession);
    if (currentSessionIdRef.current === newSession.id || !currentSessionRef.current) {
      currentSessionRef.current = newSession;
      setCurrentSession(newSession);
    }
  };

  const handleSelectSession = async (id: string) => {
    try {
      setCurrentSessionId(id);
      currentSessionIdRef.current = id;
      const cached = activeSessionsMapRef.current.get(id);
      if (cached) {
        currentSessionRef.current = cached;
        setCurrentSession(cached);
      }
      const full = await api.load_session(id);
      const activeCached = activeSessionsMapRef.current.get(id);
      if (activeCached && activeCached.messages.length >= full.messages.length) {
        updateSessionState(activeCached);
      } else {
        updateSessionState(full);
      }
      if (full.workspace_dir) {
        loadWorkspaceTree(full.workspace_dir);
      } else {
        setWorkspaceTree([]);
        setHas0xAgentMd(false);
      }
      addLog(`Switched session to "${full.title}"`);
    } catch (err: any) {
      addLog(`Failed to load session ${id}: ${err.message || err}`);
    }
  };

  const handleCreateSession = async (title?: string, workspace_dir?: string | null) => {
    try {
      let targetWs = workspace_dir;
      let name = title;

      if (targetWs === 'auto') {
        const autoWs = await api.create_auto_workspace();
        targetWs = autoWs.path;
        name = title && title !== 'Новый диалог' && title !== 'Быстрый чат' && title !== 'Новый чат' ? title : `Чат (${autoWs.slug})`;
      } else if (targetWs === undefined) {
        targetWs = config?.workspace_dir || null;
      }

      const newSess = await api.create_session(name || `Session ${sessions.length + 1}`, targetWs);
      activeSessionsMapRef.current.set(newSess.id, newSess);
      currentSessionIdRef.current = newSess.id;
      currentSessionRef.current = newSess;
      setCurrentSessionId(newSess.id);
      setCurrentSession(newSess);
      setSessions((prev) => [newSess, ...prev.filter((s) => s.id !== newSess.id)]);

      if (newSess.workspace_dir) {
        loadWorkspaceTree(newSess.workspace_dir);
      } else {
        setWorkspaceTree([]);
        setHas0xAgentMd(false);
      }
      addLog(`Created new session: "${newSess.title}"`);
    } catch (err: any) {
      addLog(`Failed to create session: ${err.message || err}`);
    }
  };

  const handleUpdateCurrentSessionWorkspace = async (workspace_dir: string | null) => {
    if (!currentSessionId) return;
    try {
      const updated = await api.update_session_workspace(currentSessionId, workspace_dir);
      updateSessionState(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (workspace_dir) {
        loadWorkspaceTree(workspace_dir);
        addLog(`Привязана папка: "${workspace_dir}"`);
      } else {
        setWorkspaceTree([]);
        setHas0xAgentMd(false);
        addLog(`Сессия переведена в общий режим (без файлов)`);
      }
    } catch (err: any) {
      addLog(`Ошибка обновления воркспейса: ${err.message || err}`);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete_session(id);
      const updatedList = sessions.filter((s) => s.id !== id);
      setSessions(updatedList);
      addLog(`Deleted session: ${id}`);

      if (currentSessionId === id) {
        if (updatedList.length > 0) {
          handleSelectSession(updatedList[0].id);
        } else {
          handleCreateSession('Default Session', 'auto');
        }
      }
    } catch (err: any) {
      addLog(`Failed to delete session: ${err.message || err}`);
    }
  };

  const handleSendMessage = async (text: string, images?: string[]) => {
    const activeSessionId = currentSessionIdRef.current || currentSession?.id;
    const activeSess = (activeSessionId ? activeSessionsMapRef.current.get(activeSessionId) : null) || currentSessionRef.current || currentSession;
    if (!activeSess) return;

    const userMsg: ChatMessage = {
      id: generateShortId(),
      role: 'user',
      content: text,
      images: images || null,
      timestamp: Date.now(),
    };

    let title = activeSess.title;
    if (
      activeSess.messages.length === 0 ||
      title.startsWith('Чат (') ||
      title === 'Новый чат' ||
      title === 'Default Session'
    ) {
      const cleanPrompt = text.replace(/\n+/g, ' ').trim();
      if (cleanPrompt) {
        title = cleanPrompt.length > 32 ? cleanPrompt.substring(0, 30) + '...' : cleanPrompt;
      }
    }

    const updatedSession = {
      ...activeSess,
      title,
      messages: [...activeSess.messages, userMsg],
      updated_at: Date.now(),
    };

    updateSessionState(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSess.id ? { ...s, title, updated_at: updatedSession.updated_at } : s))
    );

    try {
      await api.save_session(updatedSession);
      addLog(`Prompt submitted: "${text.substring(0, 30)}..."`);
      await api.send_message(activeSess.id);
    } catch (err: any) {
      addLog(`Failed to execute completions: ${err.message || err}`);
      const errText = `**Системная ошибка подключения:** ${err.message || err}`;
      const sessWithErr: ChatSession = {
        ...updatedSession,
        messages: [
          ...updatedSession.messages,
          {
            id: generateShortId(),
            role: 'assistant',
            content: errText,
            timestamp: Date.now(),
          },
        ],
        updated_at: Date.now(),
      };
      updateSessionState(sessWithErr);
      api.save_session(sessWithErr).catch(() => {});
    }
  };

  const handleAcceptSpark = async (spark: JarvisSparkProposal) => {
    try {
      await api.accept_spark(spark.id);

      const sparkTitle = `[Джарвис] ${spark.title}`;
      const newSession = await api.create_session(sparkTitle, config?.workspace_dir);

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      currentSessionRef.current = newSession;
      setCurrentSession(newSession);
      activeSessionsMapRef.current.set(newSession.id, newSession);

      setActiveView('chat');
      setIsJarvisOpen(false);

      const directive = spark.directivePrompt || spark.suggestedAction || spark.description;

      const userMsg: ChatMessage = {
        id: generateShortId(),
        role: 'user',
        content: directive,
        timestamp: Date.now(),
      };

      const updatedSession: ChatSession = {
        ...newSession,
        messages: [userMsg],
        updated_at: Date.now(),
      };

      updateSessionState(updatedSession);
      await api.save_session(updatedSession);
      await api.send_message(newSession.id);

      showToast(formatString(t.toasts.sparkStarted, { title: spark.title }), 'success');
      addLog(`Initiative dispatched in dedicated session ${newSession.id}`);
    } catch (err: any) {
      console.error('Failed to accept spark:', err);
      showToast(formatString(t.toasts.launchError, { error: err.message || err }), 'error');
    }
  };

  const handleRollbackSession = async (
    targetMessageId: string,
    mode: 'to_user_edit' | 'to_assistant' = 'to_user_edit'
  ): Promise<string> => {
    if (!currentSession) return '';
    try {
      const res = await api.rollback_session(currentSession.id, targetMessageId, mode);
      updateSessionState(res.session);
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSession.id ? { ...s, messages: res.session.messages, updated_at: res.session.updated_at } : s))
      );
      addLog(`Session rolled back to message: ${targetMessageId}`);
      return res.restoredContent || '';
    } catch (err: any) {
      addLog(`Failed to rollback session: ${err.message || err}`);
      throw err;
    }
  };

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    setCurrentSession,
    activeSessionsMapRef,
    currentSessionIdRef,
    currentSessionRef,
    updateSessionState,
    handleSelectSession,
    handleCreateSession,
    handleUpdateCurrentSessionWorkspace,
    handleDeleteSession,
    handleSendMessage,
    handleAcceptSpark,
    handleRollbackSession,
  };
}
