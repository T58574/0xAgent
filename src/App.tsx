import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AppConfig, ChatSession, ChatMessage, FileNode, ToolCallInfo } from './types';
import { Header } from './components/Header';
import { WorkspaceTree } from './components/WorkspaceTree';
import { ChatArea } from './components/ChatArea';
import { BottomPanel } from './components/BottomPanel';
import { SettingsPage } from './components/SettingsModal';
import { FileViewer } from './components/FileViewer';
import { CodeEditor } from './components/CodeEditor';

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

  // Mobile keyboard scroll offset reset on input blur (focusout) - FIXED: only on chat view inputs
  useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      if (activeView !== 'chat') return;
      const target = e.target as HTMLElement;
      // Only scroll when focus leaves input fields in chat area
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

  // Apply manual hex colors configuration to document element custom properties
  useEffect(() => {
    if (config && config.theme_colors) {
      const root = document.documentElement;
      root.style.setProperty('--theme-bg', config.theme_colors.bg_color);
      root.style.setProperty('--theme-text', config.theme_colors.text_color);
      root.style.setProperty('--theme-border', config.theme_colors.border_color);
      root.style.setProperty('--theme-active', config.theme_colors.active_color);
      root.style.setProperty('--theme-send-btn', config.theme_colors.send_btn_color);
    } else {
      const root = document.documentElement;
      root.style.setProperty('--theme-bg', '#ffffff');
      root.style.setProperty('--theme-text', '#000000');
      root.style.setProperty('--theme-border', '#000000');
      root.style.setProperty('--theme-active', '#f5f5f5');
      root.style.setProperty('--theme-send-btn', '#86efac');
    }
  }, [config]);

  const handleSelectTab = (path: string) => {
    const tab = openTabs.find(t => t.path === path);
    if (tab) setSelectedFile(tab);
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

  // Latest status ref to avoid event listener closures issues
  const currentSessionRef = useRef<ChatSession | null>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // 1. Initial Load Config and Sessions
  useEffect(() => {
    async function init() {
      try {
        addLog('Initializing system configurations...');
        const cfg = await invoke<AppConfig>('get_config');
        setConfig(cfg);
        addLog(`Loaded settings. Model: ${cfg.model_name}`);

        if (cfg.workspace_dir) {
          loadWorkspaceTree(cfg.workspace_dir);
        }

        const sessionList = await invoke<ChatSession[]>('list_sessions');
        setSessions(sessionList);

        if (sessionList.length > 0) {
          const firstSession = sessionList[0];
          setCurrentSessionId(firstSession.id);
          const fullSession = await invoke<ChatSession>('load_session', { id: firstSession.id });
          setCurrentSession(fullSession);
          addLog(`Restored session: "${fullSession.title}"`);
        } else {
          // Create initial session if list is empty
          await handleCreateSession('Default Session');
        }
      } catch (err) {
        addLog(`Error during startup: ${err}`);
      }
    }
    init();
  }, []);

  // 2. Fetch workspace file tree recursive
  const loadWorkspaceTree = async (dirPath: string) => {
    try {
      const tree = await invoke<FileNode[]>('get_workspace_tree', { workspaceDir: dirPath });
      setWorkspaceTree(tree);
    } catch (err) {
      addLog(`Failed to load file tree: ${err}`);
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
      const full = await invoke<ChatSession>('load_session', { id });
      setCurrentSession(full);
      addLog(`Switched session to "${full.title}"`);
    } catch (err) {
      addLog(`Failed to load session ${id}: ${err}`);
    }
  };

  const handleCreateSession = async (title?: string) => {
    try {
      const name = title || `Session ${sessions.length + 1}`;
      const newSess = await invoke<ChatSession>('create_session', { title: name });
      setSessions((prev) => [newSess, ...prev]);
      setCurrentSessionId(newSess.id);
      setCurrentSession(newSess);
      addLog(`Created new session: "${name}"`);
    } catch (err) {
      addLog(`Failed to create session: ${err}`);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('delete_session', { id });
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
    } catch (err) {
      addLog(`Failed to delete session: ${err}`);
    }
  };

  // 4. Select workspace directory via native picker RFD
  const handleSelectWorkspace = async () => {
    try {
      const folder = await invoke<string | null>('select_workspace');
      if (folder) {
        addLog(`Selected workspace: ${folder}`);
        const updatedConfig = await invoke<AppConfig>('get_config');
        setConfig(updatedConfig);
        loadWorkspaceTree(folder);
      }
    } catch (err) {
      addLog(`Failed to select directory: ${err}`);
    }
  };

  // 5. Save settings config updates
  const handleSaveConfig = async (updated: AppConfig) => {
    try {
      await invoke('save_config', { config: updated });
      setConfig(updated);
      addLog(`Settings updated. Active Model: ${updated.model_name}`);
      if (updated.workspace_dir) {
        loadWorkspaceTree(updated.workspace_dir);
      } else {
        setWorkspaceTree([]);
      }
    } catch (err) {
      addLog(`Failed to save configuration: ${err}`);
      throw err;
    }
  };

  // 6. View raw text file onClick
  const handleFileClick = async (filePath: string, fileName: string) => {
    try {
      const content = await invoke<string>('read_file_raw', { path: filePath });
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
      setActiveView('workspace');
      addLog(`Opened raw file: ${fileName}`);
    } catch (err) {
      addLog(`Failed to read file contents: ${err}`);
    }
  };

  // 7. Chat Send message logic
  const handleSendMessage = async (text: string) => {
    if (!currentSession) return;

    // Create User message
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
      // Save session representation on disk
      await invoke('save_session', { session: updatedSession });
      addLog(`Prompt submitted: "${text.substring(0, 30)}..."`);
      
      // Start background agent runner
      await invoke('send_message', { sessionId: currentSession.id });
    } catch (err) {
      addLog(`Failed to execute completions: ${err}`);
    }
  };

  // Approve or Reject write-based tool actions
  const handleRespondToTool = async (toolId: string, approve: boolean) => {
    if (!currentSessionId) return;
    try {
      addLog(`Tool response submitted: [${toolId}] approved=${approve}`);
      await invoke('respond_to_tool', {
        sessionId: currentSessionId,
        toolCallId: toolId,
        approve,
      });
    } catch (err) {
      addLog(`Failed to submit tool confirmation: ${err}`);
    }
  };

  // Cancel running agent completions
  const handleCancelAgent = async () => {
    if (!currentSessionId) return;
    try {
      addLog(`Cancellation request submitted for session ${currentSessionId}`);
      await invoke('cancel_agent', { sessionId: currentSessionId });
    } catch (err) {
      addLog(`Failed to cancel agent: ${err}`);
    }
  };

  // 8. Listen to SSE completions events streamed from Rust Backend
  useEffect(() => {
    let unlisteners: (() => void)[] = [];

    async function setupListeners() {
      // Message start
      const un1 = await listen<{ id: string; role: string }>('agent-message-start', (event) => {
        const sess = currentSessionRef.current;
        if (!sess) return;
        
        // Append empty assistant container if not present
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

      // Token streaming
      const un2 = await listen<{ message_id: string; token: string }>('agent-token-stream', (event) => {
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

      // Status change
      const un3 = await listen<string>('agent-status-changed', (event) => {
        setAgentStatus(event.payload as any);
        addLog(`Agent status changed: ${event.payload}`);
      });
      unlisteners.push(un3);

      // Tools layout updated
      const un4 = await listen<{ message_id: string; tools: ToolCallInfo[] }>('agent-tools-updated', (event) => {
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

      // Single tool execution details updated
      const un5 = await listen<{ message_id: string; tool_id: string; status: string; output?: string }>(
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

          // Refresh workspace file tree on completed writes/patches
          if (event.payload.status === 'completed' && config?.workspace_dir) {
            loadWorkspaceTree(config.workspace_dir);
          }
        }
      );
      unlisteners.push(un5);

      // System agent errors
      const un6 = await listen<string>('agent-error', (event) => {
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
    <div className="fixed inset-0 flex flex-col bg-theme-bg text-theme-text overflow-hidden font-sans select-none">
      
      {/* TOP SESSION HEADER (Hidden on Settings page to keep it clean) */}
      {activeView !== 'settings' && (
        <div className="px-4 pt-4 shrink-0 select-none">
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
      <div className="flex-1 w-full min-h-0 relative flex flex-col mt-4 pb-20">
        
        {activeView === 'chat' && (
          <div className="flex-grow w-full h-full flex flex-col relative px-4 md:px-12 overflow-hidden">
            <ChatArea
              messages={currentSession ? currentSession.messages : []}
              agentStatus={agentStatus}
              onSendMessage={handleSendMessage}
              onRespondToTool={handleRespondToTool}
              onCancelAgent={handleCancelAgent}
              reasoningEnabled={config?.reasoning_enabled !== false}
            />
          </div>
        )}

        {activeView === 'workspace' && (
          <div className="flex-grow w-full h-full flex overflow-hidden border-t border-theme-border">
            {/* Sidebar Workspace tree (main theme) */}
            <div className="w-64 h-full flex flex-col bg-theme-bg border-r border-theme-border overflow-hidden">
              <div className="flex-grow overflow-hidden">
                <WorkspaceTree
                  workspaceDir={config?.workspace_dir}
                  treeNodes={workspaceTree}
                  onSelectWorkspace={handleSelectWorkspace}
                  onFileClick={handleFileClick}
                />
              </div>
            </div>

            {/* Main code editor area */}
            <div className="flex-grow h-full overflow-hidden">
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

      {/* raw text file viewer OVERLAY (fallback) */}
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
