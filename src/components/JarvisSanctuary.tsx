import React, { useEffect, useState } from 'react';
import {
  Bot,
  Sparkles,
  BookOpen,
  FolderTree,
  Folder,
  FileText,
  Plus,
  Compass,
  Zap,
  Volume2,
  RefreshCw,
} from 'lucide-react';
import {
  AppConfig,
  LiveTelemetry,
  PersonaMetadata,
  ChatSession,
  FileNode,
} from '../types';
import { ChatArea } from './ChatArea';
import { CodeEditor, EditorTabItem } from './CodeEditor';
import { ResizableSplitter } from './ResizableSplitter';
import { useToast } from '../context/ToastContext';
import * as api from '../services/api';
import { useI18n } from '../i18n';

const JARVIS_WORKSPACE_PATH = 'c:\\Users\\user\\.0xagent\\workspaces\\Jarvis';

interface JarvisSanctuaryProps {
  config: AppConfig | null;
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  onSelectSession: (id: string) => Promise<void>;
  onCreateSession: (title?: string, workspace_dir?: string | null) => Promise<void>;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onSendMessage: (text: string, images?: string[]) => void;
  onRespondToTool: (toolId: string, approve: boolean | string) => void;
  onCancelAgent?: () => void;
  onRollbackSession?: (targetMessageId: string, mode: 'to_user_edit' | 'to_assistant') => Promise<string>;
  liveTelemetry?: LiveTelemetry | null;
  personas: PersonaMetadata[];
  activePersonaId: string;
  onSelectPersona: (id: string) => void;
  isServerOffline?: boolean;
  onStartServer?: () => Promise<void>;
}

export const JarvisSanctuary: React.FC<JarvisSanctuaryProps> = ({
  config,
  currentSession,
  sessions,
  onSelectSession,
  onCreateSession,
  agentStatus,
  onSendMessage,
  onRespondToTool,
  onCancelAgent,
  onRollbackSession,
  liveTelemetry,
  personas,
  activePersonaId,
  onSelectPersona,
  isServerOffline,
  onStartServer,
}) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  // Personal workspace state
  const [workspaceTree, setWorkspaceTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [openTabs, setOpenTabs] = useState<EditorTabItem[]>([]);
  const [splitPercent, setSplitPercent] = useState<number>(35);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Quick Action Starter Prompts
  const quickConsultations = [
    {
      title: t.jarvis.consult1Title,
      prompt: t.jarvis.consult1Prompt,
      icon: Compass,
    },
    {
      title: t.jarvis.consult2Title,
      prompt: t.jarvis.consult2Prompt,
      icon: BookOpen,
    },
    {
      title: t.jarvis.consult3Title,
      prompt: t.jarvis.consult3Prompt,
      icon: Zap,
    },
    {
      title: t.jarvis.consult4Title,
      prompt: t.jarvis.consult4Prompt,
      icon: FileText,
    },
  ];

  // Load Jarvis Workspace Tree
  const loadJarvisFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const tree = await api.get_workspace_tree(JARVIS_WORKSPACE_PATH);
      setWorkspaceTree(tree);
    } catch (err) {
      console.error('Failed to load Jarvis workspace tree:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Ensure Sanctuary session and persona are active
  useEffect(() => {
    // 1. Activate jarvis_companion persona if not active
    if (activePersonaId !== 'jarvis_companion') {
      const p = personas.find((item) => item.id === 'jarvis_companion');
      if (p) {
        onSelectPersona('jarvis_companion');
      }
    }

    // 2. Load workspace files
    loadJarvisFiles();

    // 3. Find or create sanctuary session
    const isCurrentJarvisSession =
      currentSession &&
      currentSession.workspace_dir &&
      currentSession.workspace_dir.toLowerCase() === JARVIS_WORKSPACE_PATH.toLowerCase();

    if (!isCurrentJarvisSession) {
      const existing = sessions.find(
        (s) => s.workspace_dir && s.workspace_dir.toLowerCase() === JARVIS_WORKSPACE_PATH.toLowerCase()
      );
      if (existing) {
        onSelectSession(existing.id);
      } else {
        onCreateSession('Jarvis: Personal Sanctuary', JARVIS_WORKSPACE_PATH);
      }
    }
  }, []);

  const handleFileClick = async (filePath: string, fileName: string) => {
    try {
      const content = await api.read_file_raw(filePath);
      const newFile = { path: filePath, name: fileName, content };
      setOpenTabs((prev) => {
        if (!prev.some((t) => t.path === filePath)) {
          return [...prev, newFile];
        }
        return prev;
      });
      setSelectedFile(newFile);
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleCreateNewNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    try {
      const slug = newNoteTitle.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё\-]/gi, '');
      const noteFileName = `${slug || 'note'}.md`;
      const notePath = `${JARVIS_WORKSPACE_PATH}\\notes\\${noteFileName}`;
      const initialText = `# ${newNoteTitle.trim()}\n\n*Created: ${new Date().toLocaleString()}*\n\n`;

      await api.write_file_raw(notePath, initialText);
      setNewNoteTitle('');
      setIsCreatingNote(false);
      await loadJarvisFiles();
      await handleFileClick(notePath, noteFileName);
      showToast(`Note ${noteFileName} created`, 'success');
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--theme-bg)] text-[var(--theme-text)] font-sans">
      
      {/* 1. Sanctuary Header Banner */}
      <div className="px-5 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--theme-accent)]/20 border border-[var(--theme-accent)]/30 flex items-center justify-center text-[var(--theme-accent)] shadow-sm">
            <Bot size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--theme-text)] tracking-tight">{t.jarvis.sanctuaryTitle}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 text-[var(--theme-accent)] font-semibold">
                {t.jarvis.sanctuaryBadge}
              </span>
            </div>
            <p className="text-xs text-[var(--theme-text-muted)] font-medium">
              {t.jarvis.sanctuaryDesc}
            </p>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCreateSession('Jarvis: Personal Sanctuary', config?.workspace_dir || JARVIS_WORKSPACE_PATH)}
            className="px-3 py-1.5 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:opacity-90"
            title="Create new session in Jarvis workspace"
          >
            <Plus size={14} className="text-[var(--theme-accent-text)]" />
            <span>{t.jarvis.newSessionBtn}</span>
          </button>

          {config?.tts_config?.enabled && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.speak_category('greeting');
                } catch {}
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Test Voice Intercom"
            >
              <Volume2 size={14} className="text-[var(--theme-accent)]" />
              <span>{t.jarvis.voiceStatusBtn}</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadJarvisFiles}
            disabled={isLoadingFiles}
            className="p-2 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title={t.jarvis.refreshFiles}
          >
            <RefreshCw size={14} className={isLoadingFiles ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Quick Consultation Chips */}
      <div className="px-5 py-2.5 bg-[var(--theme-panel)]/50 border-b border-[var(--theme-border)] flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
        <span className="text-[11px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Sparkles size={12} className="text-[var(--theme-accent)]" />
          <span>{t.jarvis.consultationsTitle}</span>
        </span>

        {quickConsultations.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSendMessage(item.prompt)}
              className="px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/50 text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Icon size={13} className="text-[var(--theme-accent)]" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Sanctuary Split View: Personal Workspace Files on Left, Chat on Right */}
      <div className="flex-1 min-h-0 relative flex flex-row overflow-hidden">
        
        {/* Left Pane: Personal Workspace File Explorer / Editor */}
        <div
          className="h-full overflow-hidden flex flex-col border-r border-[var(--theme-border)] bg-[var(--theme-panel)]/40"
          style={{ width: `${splitPercent}%` }}
        >
          {/* File Explorer Header */}
          <div className="px-4 py-2.5 border-b border-[var(--theme-border)] flex items-center justify-between bg-[var(--theme-card-bg)] shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-text)]">
              <FolderTree size={14} className="text-[var(--theme-accent)]" />
              <span>{t.jarvis.archivesTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatingNote(!isCreatingNote)}
              className="p-1 rounded-lg hover:bg-[var(--theme-border-subtle)] text-[var(--theme-accent)] transition-colors cursor-pointer"
              title="Create note"
            >
              <Plus size={15} />
            </button>
          </div>

          {/* New Note Inline Form */}
          {isCreatingNote && (
            <form onSubmit={handleCreateNewNote} className="p-3 border-b border-[var(--theme-border)] bg-[var(--theme-panel)] space-y-2 animate-fadeIn">
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder={t.jarvis.newNotePlaceholder}
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--theme-border)] text-xs text-[var(--theme-text)] bg-[var(--theme-input-bg)] focus:outline-none focus:border-[var(--theme-accent)]"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreatingNote(false)}
                  className="px-2.5 py-1 rounded-md text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!newNoteTitle.trim()}
                  className="px-3 py-1 rounded-md bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-[11px] font-bold disabled:opacity-40"
                >
                  {t.jarvis.createNoteBtn}
                </button>
              </div>
            </form>
          )}

          {/* Code Editor / Files Tree */}
          <div className="flex-1 w-full h-full overflow-hidden">
            {selectedFile ? (
              <CodeEditor
                selectedFile={selectedFile}
                openTabs={openTabs}
                onSelectTab={(path) => {
                  const tab = openTabs.find((t) => t.path === path);
                  if (tab) setSelectedFile(tab);
                }}
                onCloseTab={(path, e) => {
                  e.stopPropagation();
                  const updated = openTabs.filter((t) => t.path !== path);
                  setOpenTabs(updated);
                  if (selectedFile?.path === path) {
                    setSelectedFile(updated.length > 0 ? updated[updated.length - 1] : null);
                  }
                }}
                onFileSaved={(filePath, newContent) => {
                  setOpenTabs((prev) =>
                    prev.map((t) => (t.path === filePath ? { ...t, content: newContent } : t))
                  );
                  if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, content: newContent });
                  }
                  showToast('File saved', 'success');
                }}
              />
            ) : (
              <div className="p-3 overflow-y-auto h-full space-y-1 scrollbar-thin">
                <div className="text-[11px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider mb-2 px-1">
                  {t.jarvis.sanctuaryFsTitle}
                </div>

                {workspaceTree.map((node) => (
                  <div key={node.path} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => !node.is_dir && handleFileClick(node.path, node.name)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        node.is_dir
                          ? 'font-bold text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] font-mono'
                      }`}
                    >
                      {node.is_dir ? (
                        <Folder size={13} className="text-[var(--theme-accent)] shrink-0" />
                      ) : (
                        <FileText size={13} className="shrink-0" />
                      )}
                      <span className="truncate">{node.name}</span>
                    </button>

                    {node.children && (
                      <div className="pl-4 space-y-0.5 border-l border-[var(--theme-border)] ml-3">
                        {node.children.map((child) => (
                          <button
                            key={child.path}
                            type="button"
                            onClick={() => !child.is_dir && handleFileClick(child.path, child.name)}
                            className="w-full px-2 py-1 rounded-md text-left text-[11.5px] font-mono text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-1.5 transition-colors cursor-pointer truncate"
                          >
                            <FileText size={12} className="shrink-0" />
                            <span className="truncate">{child.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resizable Divider */}
        <ResizableSplitter
          onResize={(pct) => setSplitPercent(pct)}
          minPercent={20}
          maxPercent={60}
        />

        {/* Right Pane: Sanctuary Chat Area */}
        <div
          className="h-full overflow-hidden flex flex-col flex-1"
          style={{ width: `${100 - splitPercent}%` }}
        >
          <ChatArea
            messages={currentSession ? currentSession.messages : []}
            currentSession={currentSession}
            agentStatus={agentStatus}
            onSendMessage={onSendMessage}
            onRespondToTool={onRespondToTool}
            onCancelAgent={onCancelAgent}
            onRollbackSession={onRollbackSession}
            reasoningEnabled={config?.reasoning_enabled !== false}
            groqApiKey={config?.groq_api_key}
            liveTelemetry={liveTelemetry}
            planningMode={config?.planning_mode !== false}
            isServerOffline={isServerOffline}
            onStartServer={onStartServer}
            workspaceDir={JARVIS_WORKSPACE_PATH}
            modelName={config?.model_name}
            config={config}
            personas={personas}
            activePersonaId="jarvis_companion"
            onSelectPersona={onSelectPersona}
          />
        </div>

      </div>

    </div>
  );
};
