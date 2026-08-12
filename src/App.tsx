import { useState, useEffect, useRef } from 'react';
import * as api from './services/api';
import { AppConfig, ChatSession, ChatMessage, FileNode, LiveTelemetry, ToolCallInfo } from './types';
import { generateShortId } from './utils/helpers';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ResizableSplitter } from './components/ResizableSplitter';
import { ChatArea } from './components/ChatArea';
import { SettingsPage } from './components/settings/SettingsPage';
import { CodeEditor } from './components/CodeEditor';
import { MemorySkillsModal } from './components/MemorySkillsModal';
import { WorkspacePickerModal } from './components/WorkspacePickerModal';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { LockScreen } from './components/LockScreen';
import { FolderTree, Code, Terminal, X } from 'lucide-react';

export default function App() {
  // Authentication & Security state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isPasswordSet, setIsPasswordSet] = useState<boolean>(false);

  // App Config and Sessions state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isMemorySkillsOpen, setIsMemorySkillsOpen] = useState<boolean>(false);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState<boolean>(false);


  
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
  
  // Navigation view & Sidebar state
  const [activeView, setActiveView] = useState<'chat' | 'workspace' | 'settings' | 'analytics'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [openTabs, setOpenTabs] = useState<{ path: string; name: string; content: string }[]>([]);
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

  const currentSessionRef = useRef<ChatSession | null>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
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

      if (cfg.workspace_dir) {
        loadWorkspaceTree(cfg.workspace_dir);
      }

      const sessionList = await api.list_sessions();
      setSessions(sessionList);

      if (sessionList.length > 0) {
        const firstSession = sessionList[0];
        setCurrentSessionId(firstSession.id);
        const fullSession = await api.load_session(firstSession.id);
        setCurrentSession(fullSession);
        addLog(`Restored session: "${fullSession.title}"`);
      } else {
        await handleCreateSession('Default Session', cfg.workspace_dir || null);
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
      const full = await api.load_session(id);
      setCurrentSession(full);
      addLog(`Switched session to "${full.title}"`);
    } catch (err: any) {
      addLog(`Failed to load session ${id}: ${err.message || err}`);
    }
  };

  const handleCreateSession = async (title?: string, workspace_dir?: string | null) => {
    try {
      const name = title || `Session ${sessions.length + 1}`;
      const targetWs = workspace_dir !== undefined ? workspace_dir : (config?.workspace_dir || null);
      const newSess = await api.create_session(name, targetWs);
      setSessions((prev) => [newSess, ...prev]);
      setCurrentSessionId(newSess.id);
      setCurrentSession(newSess);
      addLog(`Created new session: "${name}"`);
    } catch (err: any) {
      addLog(`Failed to create session: ${err.message || err}`);
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
          handleCreateSession('Default Session', config?.workspace_dir || null);
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
      loadWorkspaceTree(dirPath);
      addLog(`Selected workspace: ${dirPath}`);
    } catch (err: any) {
      addLog(`Failed to select workspace directory: ${err.message || err}`);
      throw err;
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
    if (!currentSession) return;

    const userMsg: ChatMessage = {
      id: generateShortId(),
      role: 'user',
      content: text,
      images: images || null,
      timestamp: Date.now(),
    };

    const updatedSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMsg],
      updated_at: Date.now(),
    };

    setCurrentSession(updatedSession);
    currentSessionRef.current = updatedSession;
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSession.id ? { ...s, updated_at: updatedSession.updated_at } : s))
    );

    try {
      await api.save_session(updatedSession);
      addLog(`Prompt submitted: "${text.substring(0, 30)}..."`);
      
      await api.send_message(currentSession.id);
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
      setCurrentSession(sessWithErr);
      api.save_session(sessWithErr).catch(() => {});
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
    currentSessionRef.current = newSession;
    setCurrentSession(newSession);
  };

  // 8. Listen to SSE completions events streamed from Node.js Backend
  useEffect(() => {
    const un1 = api.listen<{ id: string; role: string }>('agent-message-start', (event) => {
      const sess = currentSessionRef.current;
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

    const un2 = api.listen<any>('agent-token-stream', (event) => {
      const sess = currentSessionRef.current;
      if (!sess) return;

      if (event.payload.tokensPerSec || event.payload.contextUsed) {
        setLiveTelemetry({
          messageId: event.payload.message_id,
          tokensPerSec: event.payload.tokensPerSec,
          tokenCount: event.payload.tokenCount,
          contextUsed: event.payload.contextUsed,
          contextMax: event.payload.contextMax,
          modelName: event.payload.modelName,
        });
      }

      const updatedMessages = sess.messages.map((m) => {
        if (m.id === event.payload.message_id) {
          return {
            ...m,
            content: m.content + event.payload.token,
          };
        }
        return m;
      });

      updateSessionState({
        ...sess,
        messages: updatedMessages,
      });
    });

    const un3 = api.listen<string>('agent-status-changed', async (event) => {
      setAgentStatus(event.payload as 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool');
      addLog(`Agent status changed: ${event.payload}`);
      if (event.payload === 'idle') {
        setLiveTelemetry(null);
        if (currentSessionRef.current) {
          try {
            const fresh = await api.load_session(currentSessionRef.current.id);
            if (currentSessionRef.current && currentSessionRef.current.id === fresh.id) {
              updateSessionState(fresh);
            }
          } catch {}
        }
      }
    });

    const unErr = api.listen<any>('agent-error', async (event) => {
      const payload = event.payload;
      const msgText = typeof payload === 'string' ? payload : payload?.message || JSON.stringify(payload);
      addLog(`Agent error: ${msgText}`);
      
      if (currentSessionRef.current) {
        const targetId = typeof payload === 'object' && payload?.sessionId ? payload.sessionId : currentSessionRef.current.id;
        try {
          const fresh = await api.load_session(targetId);
          if (currentSessionRef.current && currentSessionRef.current.id === targetId) {
            updateSessionState(fresh);
          }
        } catch {}
      }
    });

    const un4 = api.listen<{ message_id: string; tools: any[] }>('agent-tools-updated', (event) => {
      const sess = currentSessionRef.current;
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

    const un5 = api.listen<{ message_id: string; tool_id: string; status: any; output?: string }>(
      'agent-tool-status-changed',
      (event) => {
        const sess = currentSessionRef.current;
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

        if (event.payload.status === 'completed' && config?.workspace_dir) {
          loadWorkspaceTree(config.workspace_dir);
        }
      }
    );

    return () => {
      un1();
      un2();
      un3();
      unErr();
      un4();
      un5();
    };
  }, []);

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

  const isSplitMode = activeView === 'workspace' || (activeView === 'chat' && selectedFile !== null);

  const renderChatComponent = () => (
    <ChatArea
      messages={currentSession ? currentSession.messages : []}
      agentStatus={agentStatus}
      onSendMessage={handleSendMessage}
      onRespondToTool={handleRespondToTool}
      onCancelAgent={handleCancelAgent}
      reasoningEnabled={config?.reasoning_enabled !== false}
      groqApiKey={config?.groq_api_key}
      liveTelemetry={liveTelemetry}
      planningMode={config?.planning_mode !== false}
      onTogglePlanningMode={handleTogglePlanningMode}
      isServerOffline={isServerOffline}
      onStartServer={handleStartServer}
      workspaceDir={config?.workspace_dir}
      onSelectWorkspace={handleSelectWorkspace}
      modelName={config?.model_name}
      config={config}
      onModelChanged={(newModelId) => setConfig((prev) => (prev ? { ...prev, model_name: newModelId } : prev))}
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
          workspaceDir={config?.workspace_dir}
          onSelectWorkspace={handleSelectWorkspace}
          workspaceTreeNodes={workspaceTree}
          onFileClick={handleFileClick}
          onOpenMemorySkills={() => setIsMemorySkillsOpen(true)}
          onOpenSettings={() => setActiveView('settings')}
        />

        {/* CONTENT VIEWPORT */}
        <div className="flex-1 h-full min-w-0 overflow-hidden relative flex flex-col">
          
          {/* SETTINGS VIEW */}
          {activeView === 'settings' && (
            <div className="w-full h-full overflow-hidden bg-theme-bg">
              <SettingsPage
                config={config}
                onSaveConfig={handleSaveConfig}
                onCancel={() => setActiveView('chat')}
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

          {/* SPLIT-SCREEN VIEW MODE (Editor on Left + Chat on Right) */}
          {isSplitMode && (
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
          )}

          {/* FULL SCREEN CHAT MODE (When no split view active) */}
          {!isSplitMode && activeView === 'chat' && (
            <div className="w-full h-full flex flex-col overflow-hidden">
              {renderChatComponent()}
            </div>
          )}

        </div>
      </div>

      {/* CONSOLE LOGS DRAWER OVERLAY */}
      {showLogsDrawer && (
        <div className="fixed bottom-0 left-0 right-0 h-48 bg-slate-950/95 border-t border-white/10 z-40 flex flex-col font-mono text-xs shadow-2xl backdrop-blur-md">
          <div className="px-3 py-1.5 bg-slate-900 border-b border-white/10 flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Terminal size={13} />
              <span>Логи системной консоли</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLogsDrawer(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X size={14} />
            </button>
          </div>
          <div ref={drawerLogsRef} className="p-3 flex-1 overflow-y-auto space-y-1 text-emerald-400 text-[11px] leading-tight font-mono select-text scrollbar-thin">
            {logs.length > 0 ? (
              logs.map((log, idx) => <div key={idx}>{log}</div>)
            ) : (
              <div className="text-slate-500 italic">Логов пока нет.</div>
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
