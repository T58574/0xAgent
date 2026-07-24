import { useState, useEffect, useRef } from 'react';
import * as api from './services/api';
import { AppConfig, ChatSession, ChatMessage, FileNode, ToolCallInfo } from './types';
import { Header } from './components/Header';
import { WorkspaceTree } from './components/WorkspaceTree';
import { ChatArea } from './components/ChatArea';
import { BottomPanel } from './components/BottomPanel';
import { SettingsPage } from './components/settings/SettingsPage';
import { FileViewer } from './components/FileViewer';
import { CodeEditor } from './components/CodeEditor';
import { FolderTree, Code } from 'lucide-react';

export default function App() {
  // App Config and Sessions state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  
  // Agent loop state
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'waiting_approval' | 'executing_tool'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  
  // Workspace File tree state
  const [workspaceTree, setWorkspaceTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; content: string } | null>(null);
  
  // Navigation view state
  const [activeView, setActiveView] = useState<'chat' | 'workspace' | 'settings'>('chat');
  const [openTabs, setOpenTabs] = useState<{ path: string; name: string; content: string }[]>([]);

  // Mobile Workspace view mode: 'files' tree or 'editor' code tab
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'files' | 'editor'>('files');

  // Mobile keyboard scroll offset reset on input blur (focusout)
  useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      if (activeView !== 'chat') return;
      const target = e.target as HTMLElement;
      if (!target.closest('input, textarea')) {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
      }
    };
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [activeView]);

  // Apply glassmorphism preset theme to document element
  useEffect(() => {
    if (config && config.active_theme) {
      document.documentElement.setAttribute('data-theme', config.active_theme);
    } else {
      document.documentElement.setAttribute('data-theme', 'obsidian');
    }
  }, [config]);

  const handleSelectTab = (path: string) => {
    const tab = openTabs.find(t => t.path === path);
    if (tab) {
      setSelectedFile(tab);
      setMobileWorkspaceTab('editor');
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = openTabs.filter(t => t.path !== path);
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

  // 1. Initial Load Config and Sessions
  useEffect(() => {
    async function init() {
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
          await handleCreateSession('Default Session');
        }
      } catch (err: any) {
        addLog(`Error during startup: ${err.message || err}`);
      }
    }
    init();
  }, []);

  // 2. Fetch workspace file tree recursive
  const loadWorkspaceTree = async (dirPath: string) => {
    try {
      const tree = await api.get_workspace_tree(dirPath);
      setWorkspaceTree(tree);
    } catch (err: any) {
      addLog(`Failed to load file tree: ${err.message || err}`);
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 99)]);
  };

  const handleClearLogs = () => {
    setLogs([]);
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

  const handleCreateSession = async (title?: string) => {
    try {
      const name = title || `Session ${sessions.length + 1}`;
      const newSess = await api.create_session(name);
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
          handleCreateSession('Default Session');
        }
      }
    } catch (err: any) {
      addLog(`Failed to delete session: ${err.message || err}`);
    }
  };

  // 4. Select workspace directory
  const handleSelectWorkspace = async () => {
    try {
      const folder = await api.select_workspace();
      if (folder) {
        addLog(`Selected workspace: ${folder}`);
        const updatedConfig = await api.get_config();
        setConfig(updatedConfig);
        loadWorkspaceTree(folder);
      }
    } catch (err: any) {
      addLog(`Failed to select directory: ${err.message || err}`);
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
      setMobileWorkspaceTab('editor'); // Auto-switch to code editor on mobile
      setActiveView('workspace');
      addLog(`Opened raw file: ${fileName}`);
    } catch (err: any) {
      addLog(`Failed to read file contents: ${err.message || err}`);
    }
  };

  // 7. Chat Send message logic
  const handleSendMessage = async (text: string) => {
    if (!currentSession) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID().substring(0, 8),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMsg],
      updated_at: Date.now(),
    };

    setCurrentSession(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSession.id ? { ...s, updated_at: updatedSession.updated_at } : s))
    );

    try {
      await api.save_session(updatedSession);
      addLog(`Prompt submitted: "${text.substring(0, 30)}..."`);
      
      await api.send_message(currentSession.id);
    } catch (err: any) {
      addLog(`Failed to execute completions: ${err.message || err}`);
    }
  };

  // Approve or Reject write-based tool actions
  const handleRespondToTool = async (toolId: string, approve: boolean) => {
    if (!currentSessionId) return;
    try {
      addLog(`Tool response submitted: [${toolId}] approved=${approve}`);
      await api.respond_to_tool(currentSessionId, toolId, approve);
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

  // 8. Listen to SSE completions events streamed from Node.js Backend
  useEffect(() => {
    let unlisteners: (() => void)[] = [];

    async function setupListeners() {
      const un1 = await api.listen<{ id: string; role: string }>('agent-message-start', (event) => {
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
          setCurrentSession(updated);
        }
      });
      unlisteners.push(un1);

      const un2 = await api.listen<{ message_id: string; token: string }>('agent-token-stream', (event) => {
        const sess = currentSessionRef.current;
        if (!sess) return;

        const updatedMessages = sess.messages.map((m) => {
          if (m.id === event.payload.message_id) {
            return {
              ...m,
              content: m.content + event.payload.token,
            };
          }
          return m;
        });

        setCurrentSession({
          ...sess,
          messages: updatedMessages,
        });
      });
      unlisteners.push(un2);

      const un3 = await api.listen<string>('agent-status-changed', (event) => {
        setAgentStatus(event.payload as any);
        addLog(`Agent status changed: ${event.payload}`);
      });
      unlisteners.push(un3);

      const un4 = await api.listen<{ message_id: string; tools: ToolCallInfo[] }>('agent-tools-updated', (event) => {
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

        setCurrentSession({
          ...sess,
          messages: updatedMessages,
        });
      });
      unlisteners.push(un4);

      const un5 = await api.listen<{ message_id: string; tool_id: string; status: string; output?: string }>(
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
                    status: event.payload.status as any,
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

          setCurrentSession({
            ...sess,
            messages: updatedMessages,
          });

          if (event.payload.status === 'completed' && config?.workspace_dir) {
            loadWorkspaceTree(config.workspace_dir);
          }
        }
      );
      unlisteners.push(un5);

      const un6 = await api.listen<string>('agent-error', (event) => {
        addLog(`Agent Error Alert: ${event.payload}`);
      });
      unlisteners.push(un6);
    }

    setupListeners();

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, [config]);

  return (
    <div className="fixed inset-0 h-[100dvh] flex flex-col bg-theme-bg text-theme-text overflow-hidden font-sans select-none">
      
      {/* TOP SESSION HEADER */}
      {activeView !== 'settings' && (
        <div className="px-3 pt-3 shrink-0 select-none">
          <Header
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onCreateSession={() => handleCreateSession()}
            onDeleteSession={handleDeleteSession}
            onOpenSettings={() => setActiveView('settings')}
          />
        </div>
      )}

      {/* MAIN VIEWPORT SWITCHER */}
      <div className="flex-1 w-full min-h-0 relative flex flex-col mt-2 pb-20">
        
        {activeView === 'chat' && (
          <div className="flex-grow w-full h-full flex flex-col relative px-2 sm:px-6 md:px-12 overflow-hidden">
            <ChatArea
              messages={currentSession ? currentSession.messages : []}
              agentStatus={agentStatus}
              onSendMessage={handleSendMessage}
              onRespondToTool={handleRespondToTool}
              onCancelAgent={handleCancelAgent}
              reasoningEnabled={config?.reasoning_enabled !== false}
              groqApiKey={config?.groq_api_key}
            />
          </div>
        )}

        {activeView === 'workspace' && (
          <div className="flex-grow w-full h-full flex flex-col md:flex-row overflow-hidden border-t border-theme-border">
            
            {/* Mobile Workspace Toggle (Visible on md:hidden) */}
            <div className="flex md:hidden glass-panel p-1 border-b border-white/10 shrink-0 select-none">
              <button
                onClick={() => setMobileWorkspaceTab('files')}
                className={`flex-1 py-1.5 text-xs font-hud font-bold uppercase flex items-center justify-center gap-1.5 rounded-lg transition-colors ${
                  mobileWorkspaceTab === 'files' ? 'bg-slate-800 text-white border border-indigo-500/40' : 'text-slate-400'
                }`}
              >
                <FolderTree size={14} />
                <span>Дерево файлов</span>
              </button>
              <button
                onClick={() => setMobileWorkspaceTab('editor')}
                className={`flex-1 py-1.5 text-xs font-hud font-bold uppercase flex items-center justify-center gap-1.5 rounded-lg transition-colors ${
                  mobileWorkspaceTab === 'editor' ? 'bg-slate-800 text-white border border-indigo-500/40' : 'text-slate-400'
                }`}
              >
                <Code size={14} />
                <span>Редактор ({openTabs.length})</span>
              </button>
            </div>

            {/* Sidebar Workspace tree (Full width on mobile when 'files', 64 width on desktop) */}
            <div className={`w-full md:w-64 h-full flex-col bg-theme-bg border-r border-theme-border overflow-hidden ${
              mobileWorkspaceTab === 'files' ? 'flex' : 'hidden md:flex'
            }`}>
              <div className="flex-grow overflow-hidden">
                <WorkspaceTree
                  workspaceDir={config?.workspace_dir}
                  treeNodes={workspaceTree}
                  onSelectWorkspace={handleSelectWorkspace}
                  onFileClick={handleFileClick}
                />
              </div>
            </div>

            {/* Main code editor area (Full width on mobile when 'editor', flex-1 on desktop) */}
            <div className={`w-full md:flex-1 h-full overflow-hidden ${
              mobileWorkspaceTab === 'editor' ? 'flex flex-col' : 'hidden md:flex'
            }`}>
              <CodeEditor
                selectedFile={selectedFile}
                openTabs={openTabs}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
              />
            </div>
          </div>
        )}

        {activeView === 'settings' && (
          <div className="flex-grow w-full h-full overflow-hidden border-t border-theme-border bg-theme-bg">
            <SettingsPage
              config={config}
              onSaveConfig={handleSaveConfig}
              onCancel={() => setActiveView('chat')}
            />
          </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION FOOTER PANEL */}
      <BottomPanel
        logs={logs}
        systemInstructions={config ? config.system_prompt : ''}
        modelName={config ? config.model_name : 'No model selected'}
        onClearLogs={handleClearLogs}
        onSelectWorkspace={handleSelectWorkspace}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      {/* RAW TEXT FILE VIEWER OVERLAY */}
      {activeView !== 'workspace' && selectedFile && (
        <FileViewer
          fileName={selectedFile.name}
          filePath={selectedFile.path}
          content={selectedFile.content}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
