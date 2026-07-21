import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Folder, Settings } from 'lucide-react';
import { AppConfig, ChatSession, ChatMessage, FileNode, ToolCallInfo } from './types';
import { Header } from './components/Header';
import { WorkspaceTree } from './components/WorkspaceTree';
import { ChatArea } from './components/ChatArea';
import { BottomPanel } from './components/BottomPanel';
import { SettingsModal } from './components/SettingsModal';
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
  
  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [openTabs, setOpenTabs] = useState<{ path: string; name: string; content: string }[]>([]);

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
      setIsWorkspaceOpen(true);
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
    <>
      {isWorkspaceOpen ? (
        <div className="w-screen h-screen flex bg-white text-black overflow-hidden relative select-none">
          {/* Left Split Pane: Dark Mock IDE */}
          <div className="w-[50%] h-full flex overflow-hidden bg-[#1e1e1e] border-r border-black relative shrink-0">
            {/* Sidebar Workspace tree (dark theme) */}
            <div className="w-56 h-full flex flex-col bg-[#121214] border-r border-[#2d2d2d] overflow-hidden">
              <div className="p-3 border-b border-[#2d2d2d] flex items-center justify-between shrink-0 select-none text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                <span>Explorer</span>
              </div>
              <div className="flex-1 overflow-hidden">
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

          {/* Right Split Pane: Chat Area (Styled using custom colors) */}
          <div className="w-[50%] h-full flex flex-col items-center relative overflow-hidden px-4 md:px-6 pt-4 pb-20 bg-theme-bg text-theme-text border-l border-theme-border">
            
            {/* TOP SESSION HEADER */}
            <Header
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onCreateSession={() => handleCreateSession()}
              onDeleteSession={handleDeleteSession}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* TIMELINE VIEWPORT */}
            <div className="flex-1 w-full min-h-0 relative flex flex-col mt-4">
              <ChatArea
                messages={currentSession ? currentSession.messages : []}
                agentStatus={agentStatus}
                onSendMessage={handleSendMessage}
                onRespondToTool={handleRespondToTool}
              />
            </div>

            {/* BOTTOM FLOATING UTILITY STATUS STRIP */}
            <BottomPanel
              logs={logs}
              systemInstructions={config ? config.system_prompt : ''}
              modelName={config ? config.model_name : 'No model selected'}
              onClearLogs={handleClearLogs}
              onSelectWorkspace={handleSelectWorkspace}
            />
          </div>

          {/* Corner Toggles absolute floating */}
          <div className="absolute top-4 left-4 z-40">
            <button 
              onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)} 
              className="w-10 h-10 rounded-full border border-black bg-neutral-200 hover:bg-neutral-300 transition-all cursor-pointer shadow-sm flex items-center justify-center text-black focus:outline-none"
              title="Toggle Workspace Code View"
            >
              <Folder size={16} />
            </button>
          </div>

          <div className="absolute top-4 right-4 z-40">
            <button 
              onClick={() => setIsSettingsOpen(true)} 
              className="w-10 h-10 rounded-full border border-black bg-neutral-200 hover:bg-neutral-300 transition-all cursor-pointer shadow-sm flex items-center justify-center text-black focus:outline-none"
              title="Developer Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="w-screen h-screen flex flex-col bg-theme-bg text-theme-text overflow-hidden font-sans relative select-none">
          
          {/* Corner Buttons */}
          <div className="absolute top-4 left-4 z-40">
            <button 
              onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)} 
              className="w-10 h-10 rounded-full border border-black bg-neutral-200 hover:bg-neutral-300 transition-all cursor-pointer shadow-sm flex items-center justify-center text-black focus:outline-none"
              title="Toggle Workspace Code View"
            >
              <Folder size={16} />
            </button>
          </div>

          <div className="absolute top-4 right-4 z-40">
            <button 
              onClick={() => setIsSettingsOpen(true)} 
              className="w-10 h-10 rounded-full border border-black bg-neutral-200 hover:bg-neutral-300 transition-all cursor-pointer shadow-sm flex items-center justify-center text-black focus:outline-none"
              title="Developer Settings"
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Main Centered Content */}
          <div className="flex-1 w-full h-full flex flex-col items-center relative overflow-hidden px-4 md:px-12 pt-4 pb-20">
            
            {/* TOP SESSION HEADER */}
            <Header
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onCreateSession={() => handleCreateSession()}
              onDeleteSession={handleDeleteSession}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* TIMELINE VIEWPORT */}
            <div className="flex-1 w-full min-h-0 relative flex flex-col mt-4">
              <ChatArea
                messages={currentSession ? currentSession.messages : []}
                agentStatus={agentStatus}
                onSendMessage={handleSendMessage}
                onRespondToTool={handleRespondToTool}
              />
            </div>

            {/* BOTTOM FLOATING UTILITY STATUS STRIP */}
            <BottomPanel
              logs={logs}
              systemInstructions={config ? config.system_prompt : ''}
              modelName={config ? config.model_name : 'No model selected'}
              onClearLogs={handleClearLogs}
              onSelectWorkspace={handleSelectWorkspace}
            />
          </div>
        </div>
      )}

      {/* settings panel MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />

      {/* raw text file viewer OVERLAY (fallback) */}
      {!isWorkspaceOpen && selectedFile && (
        <FileViewer
          fileName={selectedFile.name}
          filePath={selectedFile.path}
          content={selectedFile.content}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </>
  );
}
