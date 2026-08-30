import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import * as api from './services/api';
import { sounds } from './services/soundEffects';
import { AppConfig, LiveTelemetry, JarvisState, PersonaMetadata } from './types';
import { getWorkspaceBaseName } from './utils/helpers';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ResizableSplitter } from './components/ResizableSplitter';
import { ChatArea } from './components/ChatArea';
import { LockScreen } from './components/LockScreen';
import { InstallAppBanner } from './components/InstallAppBanner';
import { JarvisIntercomHud } from './components/chat/JarvisIntercomHud';

const SettingsPage = lazy(() => import('./components/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const CodeEditor = lazy(() => import('./components/CodeEditor').then((m) => ({ default: m.CodeEditor })));
const MemorySkillsModal = lazy(() => import('./components/MemorySkillsModal').then((m) => ({ default: m.MemorySkillsModal })));
const WorkspacePickerModal = lazy(() => import('./components/WorkspacePickerModal').then((m) => ({ default: m.WorkspacePickerModal })));
const AnalyticsPage = lazy(() => import('./components/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const KnowledgeVault = lazy(() => import('./components/KnowledgeVault').then((m) => ({ default: m.KnowledgeVault })));
const JarvisSanctuary = lazy(() => import('./components/JarvisSanctuary').then((m) => ({ default: m.JarvisSanctuary })));
const JarvisWidget = lazy(() => import('./components/JarvisWidget').then((m) => ({ default: m.JarvisWidget })));
import { FolderTree, Code, Terminal, X, ChevronRight } from 'lucide-react';
import { useToast } from './context/ToastContext';
import { useI18n } from './i18n';
import { useAppWebSocket } from './hooks/useAppWebSocket';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useSessionManager } from './hooks/useSessionManager';
import { useWorkspaceManager } from './hooks/useWorkspaceManager';
import { useServerController } from './hooks/useServerController';
import { useResponsive } from './hooks/useResponsive';

export default function App() {
  const { showToast } = useToast();
  const { isMobile } = useResponsive();
  const { language, setLanguage, t, formatString } = useI18n();

  // Authentication & Security state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isPasswordSet, setIsPasswordSet] = useState<boolean>(false);

  // App Config & Persona state
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (config?.language && config.language !== language) {
      setLanguage(config.language);
    }
  }, [config?.language]);
  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');

  // Modal Dialogs & Sub-views
  const [isMemorySkillsOpen, setIsMemorySkillsOpen] = useState<boolean>(false);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState<boolean>(false);
  const [isJarvisOpen, setIsJarvisOpen] = useState<boolean>(false);
  const [jarvisState, setJarvisState] = useState<JarvisState | null>(null);
  const [settingsSubtab, setSettingsSubtab] = useState<'general' | 'personas' | 'customizations' | 'themes' | 'local_server' | undefined>(undefined);

  // Agent loop & telemetry state
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'waiting_approval' | 'executing_tool'>('idle');
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetry | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogsDrawer, setShowLogsDrawer] = useState<boolean>(false);

  // Navigation view & Sidebar state
  const [activeView, setActiveView] = useState<'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return window.innerWidth >= 768;
    return true;
  });
  const drawerLogsRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 99)]);
  };

  // Session Manager Hook
  const {
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
  } = useSessionManager({
    config,
    loadWorkspaceTree: (dir) => loadWorkspaceTree(dir),
    setWorkspaceTree: (tree) => setWorkspaceTree(tree),
    setHas0xAgentMd: (has) => setHas0xAgentMd(has),
    addLog,
    showToast,
    setActiveView,
    setIsJarvisOpen,
  });

  const activeSessionWorkspace = currentSession?.workspace_dir !== undefined ? currentSession.workspace_dir : config?.workspace_dir;

  // Workspace Manager Hook
  const {
    workspaceTree,
    setWorkspaceTree,
    selectedFile,
    setHas0xAgentMd,
    splitLeftWidthPercent,
    setSplitLeftWidthPercent,
    openTabs,
    mobileWorkspaceTab,
    setMobileWorkspaceTab,
    loadWorkspaceTree,
    handleSelectTab,
    handleCloseTab,
    handleFileSaved,
    handleFileClick,
  } = useWorkspaceManager({ addLog, activeWorkspaceDir: activeSessionWorkspace });

  // Local Server Controller Hook
  const { isServerOffline, handleStartServer } = useServerController({
    config,
    addLog,
    setActiveView,
  });

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

  useEffect(() => {
    if (showLogsDrawer && drawerLogsRef.current) {
      drawerLogsRef.current.scrollTop = drawerLogsRef.current.scrollHeight;
    }
  }, [logs, showLogsDrawer]);

  // Apply glassmorphism preset theme to document element & sync audio
  useEffect(() => {
    if (config && config.active_theme) {
      document.documentElement.setAttribute('data-theme', config.active_theme);
    } else {
      document.documentElement.setAttribute('data-theme', 'obsidian');
    }
    if (config) {
      sounds.setEnabled(config.sound_notifications !== false);
    }
  }, [config]);

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

  // Initial Load Config and Sessions
  useEffect(() => {
    async function init() {
      const isAuth = await checkAuth();
      if (isAuth) {
        await loadInitialData();
      }
    }
    init();
  }, []);

  const handleSelectPersona = async (id: string) => {
    try {
      const updatedList = await api.activate_persona(id);
      setPersonas(updatedList);
      setActivePersonaId(id);
      setConfig((prev) => (prev ? { ...prev, active_persona_id: id } : prev));
      const p = updatedList.find((item) => item.id === id);
      if (p) {
        addLog(`Persona activated: ${p.name}`);
        showToast(formatString(t.toasts.personaActivated, { name: p.name }), 'success');
      }
    } catch (err: any) {
      addLog(`Failed to switch persona: ${err.message || err}`);
      showToast(formatString(t.toasts.personaSwitchError, { error: err.message || err }), 'error');
    }
  };

  const handleSelectWorkspace = () => {
    setIsWorkspacePickerOpen(true);
  };

  const handleSelectWorkspaceDir = async (dirPath: string, openInNewChat = true) => {
    try {
      let currentCfg = config;
      if (!currentCfg) {
        currentCfg = await api.get_config();
      }
      const updated = { ...currentCfg, workspace_dir: dirPath };
      await api.save_config(updated);
      setConfig(updated);

      // 1. Immediately load workspace tree
      await loadWorkspaceTree(dirPath);

      if (openInNewChat) {
        // Create clean dedicated session with project title
        const baseName = getWorkspaceBaseName(dirPath);
        await handleCreateSession(baseName, dirPath);
        showToast(formatString(t.toasts.workspaceOpenedNewChat, { name: baseName }), 'success');
      } else if (currentSessionId) {
        await handleUpdateCurrentSessionWorkspace(dirPath);
        showToast(t.toasts.workspaceLinked, 'info');
      }
      addLog(`Workspace opened: ${dirPath}`);
    } catch (err: any) {
      addLog(`Failed to open workspace directory: ${err.message || err}`);
      showToast(formatString(t.toasts.workspaceOpenError, { error: err.message || err }), 'error');
    }
  };

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

  const handleRespondToTool = async (toolId: string, approve: boolean | string) => {
    const targetSessionId = currentSessionId || currentSessionRef.current?.id || '';
    try {
      addLog(`Tool response submitted: [${toolId}] approved=${approve}`);
      await api.respond_to_tool(targetSessionId, toolId, approve);
    } catch (err: any) {
      addLog(`Failed to submit tool confirmation: ${err.message || err}`);
    }
  };

  const handleCancelAgent = async () => {
    if (!currentSessionId) return;
    try {
      addLog(`Cancellation request submitted for session ${currentSessionId}`);
      await api.cancel_agent(currentSessionId);
    } catch (err: any) {
      addLog(`Failed to cancel agent: ${err.message || err}`);
    }
  };

  // WebSocket Event Subscriptions
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

  // Global Keyboard Shortcuts (Ctrl+N, Ctrl+B, Ctrl+,, Escape)
  useAppShortcuts({
    onCreateSession: () => handleCreateSession('Новый диалог', 'auto'),
    onToggleSidebar: () => setSidebarOpen((prev) => !prev),
    onOpenSettings: () => setActiveView('settings'),
    onCancelAgent: handleCancelAgent,
  });

  const isSplitMode = activeView === 'workspace' || (activeView === 'chat' && selectedFile !== null);

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
      liveTelemetry={liveTelemetry}
      config={config}
      onModelChanged={(newModelId) => setConfig((prev) => (prev ? { ...prev, model_name: newModelId } : prev))}
      onConfigChanged={(updated) => setConfig(updated)}
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
    <div className="fixed inset-0 h-[100dvh] flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] overflow-hidden font-sans p-0 sm:p-2.5 gap-0 sm:gap-2.5">
      
      {/* 1. TOP FLOATING SCI-FI CAPSULE NAVBAR */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        activeView={activeView}
        onChangeView={setActiveView}
        config={config}
        currentSession={currentSession}
        workspaceDir={activeSessionWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onUpdateSessionWorkspace={handleUpdateCurrentSessionWorkspace}
        onToggleLogs={() => setShowLogsDrawer(!showLogsDrawer)}
        isServerOffline={isServerOffline}
        onStartServer={handleStartServer}
        onConfigChanged={(updated) => setConfig(updated)}
        onNewChat={() => handleCreateSession('Новый диалог', 'auto')}
        onOpenMemorySkills={() => setIsMemorySkillsOpen(true)}
        liveTelemetry={liveTelemetry}
      />

      {/* 2. MAIN APPLICATION WORKSPACE AREA */}
      <div className="flex-1 w-full min-h-0 relative flex flex-row overflow-hidden gap-0 sm:gap-2.5">
        
        {/* LEFT COLLAPSIBLE / MOBILE DRAWER SIDEBAR */}
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
          activeView={activeView}
          onChangeView={setActiveView}
        />

        {/* Collapsed Sidebar Outer Edge Expand Button (Desktop Only) */}
        {!sidebarOpen && !isMobile && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="fixed left-2 top-1/2 -translate-y-1/2 z-40 w-7 h-12 rounded-r-2xl border-r border-y border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center justify-center shadow-lg transition-all cursor-pointer group hover:w-8"
            style={{ backgroundColor: 'var(--theme-panel-solid)' }}
            title="Развернуть боковое меню"
          >
            <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* CONTENT VIEWPORT */}
        <div className="flex-1 h-full min-w-0 overflow-hidden relative flex flex-col rounded-none sm:rounded-[26px] border-0 sm:border border-[var(--theme-border)] bg-[var(--theme-panel)]/90 backdrop-blur-2xl shadow-sm">
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs font-mono text-[var(--theme-text-muted)] animate-pulse">LOADING...</div>}>
            {/* SETTINGS VIEW */}
            {activeView === 'settings' && (
              <div className="w-full h-full overflow-hidden bg-[var(--theme-bg)] rounded-none sm:rounded-[26px]">
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
              <div className="w-full h-full overflow-hidden bg-[var(--theme-bg)] rounded-none sm:rounded-[26px]">
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

            {/* JARVIS SANCTUARY VIEW */}
            {activeView === 'jarvis' && (
              <div className="w-full h-full overflow-hidden bg-[var(--theme-bg)] rounded-none sm:rounded-[26px]">
                <JarvisSanctuary
                  config={config}
                  currentSession={currentSession}
                  sessions={sessions}
                  onSelectSession={handleSelectSession}
                  onCreateSession={handleCreateSession}
                  agentStatus={agentStatus}
                  onSendMessage={handleSendMessage}
                  onRespondToTool={handleRespondToTool}
                  onCancelAgent={handleCancelAgent}
                  onRollbackSession={handleRollbackSession}
                  liveTelemetry={liveTelemetry}
                  personas={personas}
                  activePersonaId={activePersonaId}
                  onSelectPersona={handleSelectPersona}
                  isServerOffline={isServerOffline}
                  onStartServer={handleStartServer}
                />
              </div>
            )}

            {/* MAIN CHAT & SPLIT VIEW */}
            <div className={`w-full h-full ${activeView === 'chat' || activeView === 'workspace' ? 'flex flex-col overflow-hidden' : 'hidden'}`}>
              {isSplitMode && !isMobile ? (
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
                        workspaceDir={activeSessionWorkspace}
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
                  {activeView === 'workspace' ? (
                    <div className="w-full h-full flex flex-col overflow-hidden">
                      <CodeEditor
                        selectedFile={selectedFile}
                        openTabs={openTabs}
                        onSelectTab={handleSelectTab}
                        onCloseTab={handleCloseTab}
                        onFileSaved={handleFileSaved}
                        workspaceDir={activeSessionWorkspace}
                      />
                    </div>
                  ) : (
                    renderChatComponent()
                  )}
                </div>
              )}
            </div>
          </Suspense>
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

      <Suspense fallback={null}>
        {/* MEMORY & SKILLS MODAL */}
        {isMemorySkillsOpen && (
          <MemorySkillsModal
            isOpen={isMemorySkillsOpen}
            onClose={() => setIsMemorySkillsOpen(false)}
          />
        )}

        {/* WORKSPACE DIRECTORY PICKER MODAL */}
        {isWorkspacePickerOpen && (
          <WorkspacePickerModal
            isOpen={isWorkspacePickerOpen}
            onClose={() => setIsWorkspacePickerOpen(false)}
            onSelectWorkspaceDir={handleSelectWorkspaceDir}
            currentWorkspaceDir={config?.workspace_dir}
            recentWorkspaces={sessions.map((s) => s.workspace_dir).filter((d): d is string => Boolean(d))}
          />
        )}

        {/* JARVIS MULTI-AGENT ORCHESTRATOR WIDGET */}
        {isJarvisOpen && (
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
        )}
      </Suspense>

      {/* JARVIS OLED MORPHIZM ASCII INTERCOM HUD */}
      <JarvisIntercomHud />

      {/* Mobile PWA "Add to Home Screen" prompt (after auth, never over lock screen) */}
      {isAuthenticated && isPasswordSet && <InstallAppBanner />}

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
