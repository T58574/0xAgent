import { useState, useEffect, useRef } from 'react';
import * as api from './services/api';
import { AppConfig, ChatSession, ChatMessage, FileNode, LiveTelemetry, JarvisState, JarvisSparkProposal, PersonaMetadata } from './types';
import { generateShortId } from './utils/helpers';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ResizableSplitter } from './components/ResizableSplitter';
import { ChatArea } from './components/ChatArea';
import { SettingsPage } from './components/settings/SettingsPage';
import { CodeEditor, EditorTabItem } from './components/CodeEditor';
import { MemorySkillsModal } from './components/MemorySkillsModal';
import { WorkspacePickerModal } from './components/WorkspacePickerModal';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { KnowledgeVault } from './components/KnowledgeVault';
import { LockScreen } from './components/LockScreen';
import { JarvisWidget } from './components/JarvisWidget';
import { JarvisIntercomHud } from './components/chat/JarvisIntercomHud';
import { FolderTree, Code, Terminal, X, ChevronRight } from 'lucide-react';
import { useToast } from './context/ToastContext';
import { useAppWebSocket } from './hooks/useAppWebSocket';
import { useAppShortcuts } from './hooks/useAppShortcuts';

export default function App() {
  const { showToast } = useToast();
  // Authentication & Security state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isPasswordSet, setIsPasswordSet] = useState<boolean>(false);

  // App Config and Sessions state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');
  const [isMemorySkillsOpen, setIsMemorySkillsOpen] = useState<boolean>(false);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState<boolean>(false);
  const [isJarvisOpen, setIsJarvisOpen] = useState<boolean>(false);
  const [jarvisState, setJarvisState] = useState<JarvisState | null>(null);
  const [settingsSubtab, setSettingsSubtab] = useState<'general' | 'personas' | 'customizations' | 'themes' | 'local_server' | undefined>(undefined);

  const fetchJarvisData = async () => {
    try {
      const jState = await api.get_jarvis_state();
      setJarvisState(jState);
    } catch {}
  };

  useEffect(() => {
    fetchJarvisData();
    const un1 = api.listen<JarvisState>('jarvis_state_update', (e) => {
      setJarvisState(e.payload);
    });
    return () => { un1(); };
  }, []);


  
  // Agent loop & telemetry state
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'waiting_approval' | 'executing_tool'>('idle');
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetry | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogsDrawer, setShowLogsDrawer] = useState<boolean>(false);
  
  // Workspace File tree & Split View state
  const [workspaceTree, setWorkspaceTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [has0xAgentMd, setHas0xAgentMd] = useState<boolean>(false);
  const [splitLeftWidthPercent, setSplitLeftWidthPercent] = useState<number>(45);
  
  // Navigation view, Mode & Sidebar state
  const [activeView, setActiveView] = useState<'chat' | 'workspace' | 'settings' | 'analytics' | 'knowledge'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [openTabs, setOpenTabs] = useState<EditorTabItem[]>([]);
  const [isServerOffline, setIsServerOffline] = useState<boolean>(true);

  // Monitor llama server health
  useEffect(() => {
    const checkServer = async () => {
      try {
        const host = config?.local_server?.host || '127.0.0.1';
        const port = config?.local_server?.port || 11434;
        const h = await api.get_server_health(host, port);
        setIsServerOffline(!h.ok);
      } catch {
        setIsServerOffline(true);
      }
    };

    checkServer();
    const timer = setInterval(checkServer, 3000);

    const un = api.listen<{ status: string }>('llama-server-status', (event) => {
      if (event.payload.status === 'running') {
        setIsServerOffline(false);
      } else if (event.payload.status === 'stopped') {
        setIsServerOffline(true);
      }
    });

    return () => {
      clearInterval(timer);
      un();
    };
  }, [config]);

  const handleStartServer = async () => {
    try {
      let currentCfg = config;
      if (!currentCfg) {
        try { currentCfg = await api.get_config(); } catch {}
      }
      const ls = currentCfg?.local_server;
      const serverConfig = ls ? {
        exePath: ls.exe_path || undefined,
        modelPath: ls.model_path || undefined,
        host: ls.host || '127.0.0.1',
        port: ls.port || 11434,
        ctxSize: ls.ctx_size,
        gpuLayers: ls.gpu_layers,
        threads: ls.threads,
        batchSize: ls.batch_size,
        ubatchSize: ls.ubatch_size,
        temp: ls.temp,
        repeatPenalty: ls.repeat_penalty,
        minP: ls.min_p,
        topK: ls.top_k,
        topP: ls.top_p,
        predict: ls.predict,
        flashAttn: ls.flash_attn,
        mmap: ls.mmap,
        mlock: ls.mlock,
        embedding: ls.embedding,
        contBatching: ls.cont_batching,
        parallelSlots: ls.parallel_slots,
        cacheReuse: ls.cache_reuse,
        slotSavePath: ls.slot_save_path,
        customArgs: ls.custom_args,
      } : {};

      addLog('Sending launch request to local llama-server process...');
      const res = await api.start_local_server(serverConfig);
      if (res && res.success) {
        setIsServerOffline(false);
        addLog('Local llama.cpp server spawned successfully.');
      }
    } catch (err: any) {
      console.error('Failed to start server:', err);
      const errMsg = err.message || String(err);
      addLog(`[SERVER START ERROR] ${errMsg}`);
      if (errMsg.includes('не найден') || errMsg.includes('не задан') || errMsg.includes('GGUF')) {
        setActiveView('settings');
      }
      throw err;
    }
  };

  // Mobile Workspace view mode: 'files' tree or 'editor' code tab
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'files' | 'editor'>('editor');
  const drawerLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showLogsDrawer && drawerLogsRef.current) {
      drawerLogsRef.current.scrollTop = drawerLogsRef.current.scrollHeight;
    }
  }, [logs, showLogsDrawer]);

  // Apply glassmorphism preset theme to document element
  useEffect(() => {
    if (config && config.active_theme) {
      document.documentElement.setAttribute('data-theme', config.active_theme);
    } else {
      document.documentElement.setAttribute('data-theme', 'obsidian');
    }
  }, [config]);

  const handleSelectTab = (path: string) => {
    const tab = openTabs.find((t) => t.path === path);
    if (tab) {
      setSelectedFile(tab);
      setMobileWorkspaceTab('editor');
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = openTabs.filter((t) => t.path !== path);
    setOpenTabs(updated);
    if (selectedFile && selectedFile.path === path) {
      if (updated.length > 0) {
        setSelectedFile(updated[updated.length - 1]);
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleFileSaved = (filePath: string, newContent: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === filePath ? { ...t, content: newContent, isDirty: false } : t))
    );
    if (selectedFile && selectedFile.path === filePath) {
      setSelectedFile({ ...selectedFile, content: newContent });
    }
    addLog(`File saved: ${filePath}`);
  };

  const activeSessionsMapRef = useRef<Map<string, ChatSession>>(new Map());
  const currentSessionIdRef = useRef<string | null>(null);

  const currentSessionRef = useRef<ChatSession | null>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
    if (currentSession) {
      activeSessionsMapRef.current.set(currentSession.id, currentSession);
    }
  }, [currentSession]);

  const checkAuth = async (): Promise<boolean> => {
    try {
      const status = await api.get_auth_status();
      setIsPasswordSet(status.isPasswordSet);
      setIsAuthenticated(status.isAuthenticated);
      return status.isAuthenticated;
    } catch (err) {
      console.error('Failed to query auth status:', err);
      return true;
    }
  };

  const loadInitialData = async () => {
    try {
      addLog('Initializing system configurations...');
      const cfg = await api.get_config();
      setConfig(cfg);
      addLog(`Loaded settings. Model: ${cfg.model_name}`);

      try {
        const pList = await api.get_personas();
        setPersonas(pList);
        const activeP = pList.find((p) => (cfg.active_persona_id ? p.id === cfg.active_persona_id : p.is_active)) || pList[0];
        if (activeP) {
          setActivePersonaId(activeP.id);
        }
      } catch (pErr) {
        console.error('Failed to load personas on init:', pErr);
      }

      const sessionList = await api.list_sessions();
      setSessions(sessionList);

      if (sessionList.length > 0) {
        const firstSession = sessionList[0];
        setCurrentSessionId(firstSession.id);
        currentSessionIdRef.current = firstSession.id;
        const fullSession = await api.load_session(firstSession.id);
        updateSessionState(fullSession);
        if (fullSession.workspace_dir) {
          loadWorkspaceTree(fullSession.workspace_dir);
        } else if (cfg.workspace_dir) {
          loadWorkspaceTree(cfg.workspace_dir);
        }
        addLog(`Restored session: "${fullSession.title}"`);
      } else {
        await handleCreateSession('Default Session', 'auto');
      }
    } catch (err: any) {
      addLog(`Error during startup: ${err.message || err}`);
    }
  };

  // 1. Initial Load Config and Sessions
  useEffect(() => {
    async function init() {
      const isAuth = await checkAuth();
      if (isAuth) {
        await loadInitialData();
      }
    }
    init();
  }, []);

  // 2. Fetch workspace file tree recursive
  const loadWorkspaceTree = async (dirPath: string) => {
    try {
      const tree = await api.get_workspace_tree(dirPath);
      setWorkspaceTree(tree);
      const ctx = await api.get_workspace_context(dirPath);
      setHas0xAgentMd(ctx.loaded);
      if (ctx.loaded) {
        addLog(`Auto-loaded workspace context from ${ctx.filename}`);
      }
    } catch (err: any) {
      addLog(`Failed to load file tree: ${err.message || err}`);
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 99)]);
  };

  // 3. Session management commands
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

  const handleSelectPersona = async (id: string) => {
    try {
      const updatedList = await api.activate_persona(id);
      setPersonas(updatedList);
      setActivePersonaId(id);
      setConfig((prev) => (prev ? { ...prev, active_persona_id: id } : prev));
      const p = updatedList.find((item) => item.id === id);
      if (p) {
        addLog(`Активирована персона: ${p.name}`);
        showToast(`Персона: ${p.name}`, 'success');
      }
    } catch (err: any) {
      addLog(`Ошибка активации персоны: ${err.message || err}`);
      showToast(`Ошибка смены персоны: ${err.message || err}`, 'error');
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

  // 4. Select workspace directory modal handler
  const handleSelectWorkspace = () => {
    setIsWorkspacePickerOpen(true);
  };

  const handleSelectWorkspaceDir = async (dirPath: string) => {
    try {
      let currentCfg = config;
      if (!currentCfg) {
        currentCfg = await api.get_config();
      }
      const updated = { ...currentCfg, workspace_dir: dirPath };
      await api.save_config(updated);
      setConfig(updated);
      if (currentSessionId) {
        await handleUpdateCurrentSessionWorkspace(dirPath);
      } else {
        loadWorkspaceTree(dirPath);
      }
      addLog(`Selected workspace: ${dirPath}`);
    } catch (err: any) {
      addLog(`Failed to select workspace directory: ${err.message || err}`);
    }
  };

  // 5. Save settings config updates
  const handleSaveConfig = async (updated: AppConfig) => {
    try {
      await api.save_config(updated);
      setConfig(updated);
      addLog(`Settings updated. Active Model: ${updated.model_name}`);
      if (updated.workspace_dir) {
        loadWorkspaceTree(updated.workspace_dir);
      } else {
        setWorkspaceTree([]);
      }
    } catch (err: any) {
      addLog(`Failed to save configuration: ${err.message || err}`);
      throw err;
    }
  };

  // 6. View raw text file onClick
  const handleFileClick = async (filePath: string, fileName: string) => {
    try {
      const content = await api.read_file_raw(filePath);
      const newFile = {
        path: filePath,
        name: fileName,
        content,
      };
      
      setOpenTabs((prev) => {
        const exists = prev.some((t) => t.path === filePath);
        if (!exists) {
          return [...prev, newFile];
        }
        return prev;
      });

      setSelectedFile(newFile);
      setMobileWorkspaceTab('editor');
      addLog(`Opened file: ${fileName}`);
    } catch (err: any) {
      addLog(`Failed to read file contents: ${err.message || err}`);
    }
  };

  // 7. Chat Send message logic
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

  // Launch proactive initiative in dedicated session with rich context
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

      showToast(`Инициатива запущена: ${spark.title}`, 'success');
      addLog(`Initiative dispatched in dedicated session ${newSession.id}`);
    } catch (err: any) {
      console.error('Failed to accept spark:', err);
      showToast(`Ошибка запуска: ${err.message || err}`, 'error');
    }
  };

  // Approve or Reject write-based tool actions
  const handleRespondToTool = async (toolId: string, approve: boolean | string) => {
    const targetSessionId = currentSessionId || currentSessionRef.current?.id || '';
    try {
      addLog(`Tool response submitted: [${toolId}] approved=${approve}`);
      await api.respond_to_tool(targetSessionId, toolId, approve);
    } catch (err: any) {
      addLog(`Failed to submit tool confirmation: ${err.message || err}`);
    }
  };

  // Cancel running agent completions
  const handleCancelAgent = async () => {
    if (!currentSessionId) return;
    try {
      addLog(`Cancellation request submitted for session ${currentSessionId}`);
      await api.cancel_agent(currentSessionId);
    } catch (err: any) {
      addLog(`Failed to cancel agent: ${err.message || err}`);
    }
  };

  const updateSessionState = (newSession: ChatSession) => {
    activeSessionsMapRef.current.set(newSession.id, newSession);
    if (currentSessionIdRef.current === newSession.id || !currentSessionRef.current) {
      currentSessionRef.current = newSession;
      setCurrentSession(newSession);
    }
  };

  // 8. WebSocket Event Subscriptions
  useAppWebSocket({
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
    workspaceDir: config?.workspace_dir || undefined,
  });

  // 9. Global Keyboard Shortcuts (Ctrl+N, Ctrl+B, Ctrl+,, Escape)
  useAppShortcuts({
    onCreateSession: () => handleCreateSession('Новый диалог', 'auto'),
    onToggleSidebar: () => setSidebarOpen((prev) => !prev),
    onOpenSettings: () => setActiveView('settings'),
    onCancelAgent: handleCancelAgent,
  });

  const handleTogglePlanningMode = async () => {
    if (!config) return;
    const newPlanning = config.planning_mode === false ? true : false;
    const updated = { ...config, planning_mode: newPlanning };
    setConfig(updated);
    try {
      await api.save_config(updated);
      addLog(`Planning mode switched to: ${newPlanning ? 'ENABLED' : 'DISABLED'}`);
    } catch (err: any) {
      console.error('Failed to save planning mode:', err);
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

  const isSplitMode = activeView === 'workspace' || (activeView === 'chat' && selectedFile !== null);
  const activeSessionWorkspace = currentSession?.workspace_dir !== undefined ? currentSession.workspace_dir : config?.workspace_dir;

  const renderChatComponent = () => (
    <ChatArea
      messages={currentSession ? currentSession.messages : []}
      currentSession={currentSession}
      agentStatus={agentStatus}
      onSendMessage={handleSendMessage}
      onRespondToTool={handleRespondToTool}
      onCancelAgent={handleCancelAgent}
      onRollbackSession={handleRollbackSession}
      reasoningEnabled={config?.reasoning_enabled !== false}
      groqApiKey={config?.groq_api_key}
      liveTelemetry={liveTelemetry}
      planningMode={config?.planning_mode !== false}
      onTogglePlanningMode={handleTogglePlanningMode}
      isServerOffline={isServerOffline}
      onStartServer={handleStartServer}
      workspaceDir={activeSessionWorkspace}
      onSelectWorkspace={handleSelectWorkspace}
      onUpdateSessionWorkspace={handleUpdateCurrentSessionWorkspace}
      modelName={config?.model_name}
      config={config}
      onModelChanged={(newModelId) => setConfig((prev) => (prev ? { ...prev, model_name: newModelId } : prev))}
      onAcceptSpark={handleAcceptSpark}
      personas={personas}
      activePersonaId={activePersonaId}
      onSelectPersona={handleSelectPersona}
      onOpenCustomizations={() => {
        setSettingsSubtab('customizations');
        setActiveView('settings');
      }}
    />
  );

  return (
    <div className="fixed inset-0 h-[100dvh] flex flex-col bg-theme-bg text-theme-text overflow-hidden font-sans">
      
      {/* 1. TOP EDGE-TO-EDGE GLASS NAVBAR */}
      <Navbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        activeView={activeView}
        onChangeView={setActiveView}
        config={config}
        onSelectWorkspace={handleSelectWorkspace}
        has0xAgentMd={has0xAgentMd}
        onToggleLogs={() => setShowLogsDrawer(!showLogsDrawer)}
        isServerOffline={isServerOffline}
        onStartServer={handleStartServer}
        onModelChanged={(newModelId) => setConfig((prev) => (prev ? { ...prev, model_name: newModelId } : prev))}
        onOpenJarvis={() => setIsJarvisOpen(true)}
        onNewChat={() => handleCreateSession('Новый диалог', 'auto')}
        onOpenMemorySkills={() => setIsMemorySkillsOpen(true)}
      />

      {/* 2. MAIN APPLICATION WORKSPACE AREA */}
      <div className="flex-1 w-full min-h-0 relative flex flex-row overflow-hidden">
        
        {/* LEFT COLLAPSIBLE SIDEBAR */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          workspaceDir={activeSessionWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          workspaceTreeNodes={workspaceTree}
          onFileClick={handleFileClick}
        />

        {/* Collapsed Sidebar Outer Edge Expand Button */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 w-6 h-11 rounded-r-xl border-r border-y border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center justify-center shadow-md transition-all cursor-pointer group hover:w-7.5"
            style={{ backgroundColor: 'var(--theme-panel-solid)' }}
            title="Развернуть боковое меню"
          >
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}



        {/* CONTENT VIEWPORT */}
        <div className="flex-1 h-full min-w-0 overflow-hidden relative flex flex-col">
          
          {/* SETTINGS VIEW */}
          {activeView === 'settings' && (
            <div className="w-full h-full overflow-hidden bg-theme-bg">
              <SettingsPage
                config={config}
                onSaveConfig={handleSaveConfig}
                onCancel={() => setActiveView('chat')}
                initialSubtab={settingsSubtab}
                currentSessionId={currentSessionId}
              />
            </div>
          )}

          {/* ANALYTICS VIEW */}
          {activeView === 'analytics' && (
            <div className="w-full h-full overflow-hidden bg-theme-bg">
              <AnalyticsPage
                sessions={sessions}
                serverLogs={logs}
                onRefresh={() => window.location.reload()}
              />
            </div>
          )}

          {/* KNOWLEDGE VAULT VIEW */}
          {activeView === 'knowledge' && (
            <div className="w-full h-full overflow-hidden bg-theme-bg">
              <KnowledgeVault />
            </div>
          )}

          {/* MAIN CHAT & SPLIT VIEW (Preserved in DOM to maintain stream state & scroll position) */}
          <div className={`w-full h-full ${activeView === 'chat' || activeView === 'workspace' ? 'flex flex-col overflow-hidden' : 'hidden'}`}>
            {isSplitMode ? (
              <div className="w-full h-full flex flex-col md:flex-row overflow-hidden">
                {/* Left Pane: Code Editor / Workspace Tree */}
                <div
                  className="h-full overflow-hidden flex flex-col border-r border-white/10"
                  style={{ width: `${splitLeftWidthPercent}%` }}
                >
                  {/* Mobile Tab Switcher */}
                  <div className="flex md:hidden glass-panel p-1 border-b border-white/10 shrink-0 select-none">
                    <button
                      type="button"
                      onClick={() => setMobileWorkspaceTab('files')}
                      className={`flex-1 py-1 text-xs font-bold flex items-center justify-center gap-1 rounded ${
                        mobileWorkspaceTab === 'files' ? 'bg-slate-800 text-white' : 'text-slate-400'
                      }`}
                    >
                      <FolderTree size={13} />
                      <span>Файлы</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileWorkspaceTab('editor')}
                      className={`flex-1 py-1 text-xs font-bold flex items-center justify-center gap-1 rounded ${
                        mobileWorkspaceTab === 'editor' ? 'bg-slate-800 text-white' : 'text-slate-400'
                      }`}
                    >
                      <Code size={13} />
                      <span>Редактор ({openTabs.length})</span>
                    </button>
                  </div>

                  <div className="flex-1 w-full h-full overflow-hidden">
                    <CodeEditor
                      selectedFile={selectedFile}
                      openTabs={openTabs}
                      onSelectTab={handleSelectTab}
                      onCloseTab={handleCloseTab}
                      onFileSaved={handleFileSaved}
                    />
                  </div>
                </div>

                {/* Draggable Divider Handle */}
                <ResizableSplitter
                  onResize={(pct) => setSplitLeftWidthPercent(pct)}
                  minPercent={20}
                  maxPercent={80}
                />

                {/* Right Pane: Chat Window */}
                <div
                  className="h-full overflow-hidden flex flex-col flex-1"
                  style={{ width: `${100 - splitLeftWidthPercent}%` }}
                >
                  {renderChatComponent()}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col overflow-hidden">
                {renderChatComponent()}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* CONSOLE LOGS DRAWER OVERLAY */}
      {showLogsDrawer && (
        <div className="fixed bottom-0 left-0 right-0 h-48 bg-[var(--theme-panel)]/95 border-t border-[var(--theme-border)] z-40 flex flex-col font-mono text-xs shadow-2xl backdrop-blur-md">
          <div className="px-3 py-1.5 bg-black/40 border-b border-[var(--theme-border)] flex items-center justify-between text-[var(--theme-text)]">
            <span className="flex items-center gap-1.5 text-[var(--theme-text)] font-medium">
              <Terminal size={13} className="text-[var(--theme-text-muted)]" />
              <span>Логи системной консоли</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLogsDrawer(false)}
              className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div ref={drawerLogsRef} className="p-3 flex-1 overflow-y-auto space-y-1 text-[var(--theme-text)] text-[11px] leading-tight font-mono select-text scrollbar-thin">
            {logs.length > 0 ? (
              logs.map((log, idx) => <div key={idx}>{log}</div>)
            ) : (
              <div className="text-[var(--theme-text-muted)] italic">Логов пока нет.</div>
            )}
          </div>
        </div>
      )}

      {/* MEMORY & SKILLS MODAL */}
      <MemorySkillsModal
        isOpen={isMemorySkillsOpen}
        onClose={() => setIsMemorySkillsOpen(false)}
      />

      {/* WORKSPACE DIRECTORY PICKER MODAL */}
      <WorkspacePickerModal
        isOpen={isWorkspacePickerOpen}
        onClose={() => setIsWorkspacePickerOpen(false)}
        onSelectWorkspaceDir={handleSelectWorkspaceDir}
        currentWorkspaceDir={config?.workspace_dir}
        recentWorkspaces={sessions.map((s) => s.workspace_dir).filter((d): d is string => Boolean(d))}
      />

      {/* JARVIS MULTI-AGENT ORCHESTRATOR WIDGET */}
      <JarvisWidget
        isOpen={isJarvisOpen}
        onClose={() => setIsJarvisOpen(false)}
        jarvisState={jarvisState}
        onRefresh={fetchJarvisData}
        onAcceptSpark={handleAcceptSpark}
        onDismissSpark={async (sparkId: string) => {
          try {
            await api.dismiss_spark(sparkId);
            fetchJarvisData();
          } catch (err: any) {
            console.error('Failed to dismiss spark:', err);
          }
        }}
      />

      {/* JARVIS OLED MORPHIZM ASCII INTERCOM HUD */}
      <JarvisIntercomHud />

      {(!isAuthenticated || !isPasswordSet) && (
        <LockScreen
          isPasswordSet={isPasswordSet}
          onAuthenticated={async () => {
            setIsAuthenticated(true);
            setIsPasswordSet(true);
            await loadInitialData();
          }}
        />
      )}
    </div>
  );
}
