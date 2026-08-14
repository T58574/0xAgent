import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Sparkles,
  Zap,
  Cpu,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AppConfig, ChatMessage, LiveTelemetry, PersonaMetadata } from '../types';
import { cleanContent } from '../utils/helpers';
import { ToolCard } from './ToolCard';
import { NotionMarkdown } from './NotionMarkdown';
import { MaterialIcon } from './common/MaterialIcon';
import { AsciiCanvasEngine } from './common/AsciiCanvasEngine';
import { FloatingCommandBar } from './chat/FloatingCommandBar';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface ChatAreaProps {
  messages: ChatMessage[];
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onSendMessage: (text: string, images?: string[]) => void;
  onRespondToTool: (toolId: string, approve: boolean | string) => void;
  onCancelAgent?: () => void;
  reasoningEnabled?: boolean;
  groqApiKey?: string | null;
  liveTelemetry?: LiveTelemetry | null;
  planningMode?: boolean;
  onTogglePlanningMode?: () => void;
  isServerOffline?: boolean;
  onStartServer?: () => Promise<void>;
  workspaceDir?: string | null;
  onSelectWorkspace?: () => void;
  modelName?: string;
  config?: AppConfig | null;
  onModelChanged?: (newModelId: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  agentStatus,
  onSendMessage,
  onRespondToTool,
  onCancelAgent,
  reasoningEnabled = true,
  groqApiKey: _groqApiKey,
  liveTelemetry,
  planningMode = true,
  onTogglePlanningMode,
  isServerOffline: _isServerOffline = false,
  onStartServer: _onStartServer,
  workspaceDir: _workspaceDir,
  onSelectWorkspace: _onSelectWorkspace,
  modelName: _modelName,
  config,
  onModelChanged,
}) => {
  const { showToast } = useToast();
  const [inputText, setInputText] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const historyEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  // Summarization state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizePhase, setSummarizePhase] = useState('Инициализация суммаризации...');
  const [summarizePercent, setSummarizePercent] = useState(0);
  const [summarizeMetrics, setSummarizeMetrics] = useState<{ oldTokens?: number; newTokens?: number }>({});

  // Personas
  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersona, setActivePersona] = useState<PersonaMetadata | null>(null);

  // Live thinking timer state
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  useEffect(() => {
    let timer: any = null;
    if (agentStatus === 'thinking' || agentStatus === 'executing_tool') {
      const startTime = Date.now();
      timer = setInterval(() => {
        setThinkingSeconds((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      setThinkingSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [agentStatus]);

  // Load personas list for quick switching
  useEffect(() => {
    api.get_personas().then((list) => {
      setPersonas(list);
      const active = list.find((p) => (config?.active_persona_id ? p.id === config.active_persona_id : p.is_active)) || list[0];
      if (active) setActivePersona(active);
    }).catch((err) => console.error('Failed to load personas in ChatArea:', err));
  }, [config?.active_persona_id]);

  useEffect(() => {
    const u1 = api.listen<{ promptTokens: number; estimatedNewTokens: number }>('agent-summarizing-start', (e) => {
      setIsSummarizing(true);
      setSummarizePercent(15);
      setSummarizePhase('Инициализация сжатия контекста...');
      setSummarizeMetrics({ oldTokens: e.payload.promptTokens });
    });

    const u2 = api.listen<{ phase: string; percent: number }>('agent-summarizing-progress', (e) => {
      setSummarizePhase(e.payload.phase);
      setSummarizePercent(e.payload.percent);
    });

    let sumTimer: any = null;
    const u3 = api.listen<{ oldTokens: number; newTokens: number; summary: string }>('agent-summarizing-end', (e) => {
      setSummarizePercent(100);
      setSummarizePhase('Контекст успешно оптимизирован!');
      setSummarizeMetrics({ oldTokens: e.payload.oldTokens, newTokens: e.payload.newTokens });
      sumTimer = setTimeout(() => {
        setIsSummarizing(false);
      }, 3500);
    });

    return () => {
      if (sumTimer) clearTimeout(sumTimer);
      u1();
      u2();
      u3();
    };
  }, []);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 120;
    isUserScrolledUpRef.current = !isAtBottom;
  };

  useEffect(() => {
    if (chatContainerRef.current && !isUserScrolledUpRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, agentStatus, liveTelemetry]);

  const processImageFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showToast('Выберите файл изображения (PNG, JPEG, WEBP)', 'info');
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast('Размер файла превышает 15 МБ', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachedImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        e.preventDefault();
        processImageFiles(imageFiles);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && attachedImages.length === 0) return;
    onSendMessage(inputText, attachedImages.length > 0 ? attachedImages : undefined);
    setInputText('');
    setAttachedImages([]);
  };

  const handleSelectPersona = async (personaId: string) => {
    const p = personas.find((item) => item.id === personaId);
    if (!p) return;
    try {
      await api.activate_persona(p.id);
      setActivePersona(p);
      showToast(`Персона: ${p.name}`, 'success');
    } catch (err: any) {
      showToast(`Ошибка смены персоны: ${err.message || err}`, 'error');
    }
  };


  const extractThinkingFromContent = (raw: string) => {
    const match = raw.match(/<think>([\s\S]*?)<\/think>/i);
    if (match) {
      return {
        thinking: match[1].trim(),
        text: raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim(),
      };
    }
    const unclosed = raw.match(/<think>([\s\S]*)$/i);
    if (unclosed) {
      return {
        thinking: unclosed[1].trim(),
        text: '',
      };
    }
    return { thinking: '', text: raw };
  };

  const hasMessages = messages.length > 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`w-full h-full flex flex-col overflow-hidden relative font-sans ${
        isDraggingOver ? 'ring-1 ring-[var(--theme-border)] ring-inset' : ''
      }`}
    >
      {/* 1. EMPTY CHAT STATE: CLEAN FLOATING ASCII HERO */}
      {!hasMessages && (
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto scrollbar-none">
          <div className="w-full max-w-2xl space-y-6 text-center">
            {/* Transparent Floating ASCII Animation */}
            <div className="flex flex-col items-center justify-center select-none pointer-events-auto">
              <AsciiCanvasEngine
                effect="hero_wave"
                fps={60}
                color="platinum"
                fontSize={11}
                interactive
              />
            </div>

            {/* Bottom Floating Command Bar for Empty State */}
            <div className="pt-2 w-full max-w-xl mx-auto">
              <FloatingCommandBar
                inputText={inputText}
                setInputText={setInputText}
                onSubmit={handleSubmit}
                agentStatus={agentStatus}
                onCancelAgent={onCancelAgent}
                planningMode={planningMode}
                onTogglePlanningMode={onTogglePlanningMode}
                personas={personas}
                activePersonaId={activePersona?.id || 'default'}
                onSelectPersona={handleSelectPersona}
                attachedImages={attachedImages}
                onAttachImages={(imgs) => setAttachedImages(imgs)}
                onRemoveImage={handleRemoveImage}
                config={config}
                onModelChanged={onModelChanged}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE CHAT MESSAGES STREAM */}
      {hasMessages && (
        <>
          {/* Background Context Compression Banner */}
          {isSummarizing && (
            <div className="px-4 py-2.5 bg-black/40 border-b border-[var(--theme-border)] shrink-0 flex items-center justify-between text-xs z-10 backdrop-blur-md animate-fadeIn">
              <div className="flex items-center gap-2 font-mono">
                <Sparkles size={14} className="animate-spin text-[var(--theme-text-muted)]" />
                <span className="font-semibold text-[var(--theme-text)]">{summarizePhase}</span>
                {summarizeMetrics.oldTokens && (
                  <span className="text-[var(--theme-text-muted)] text-[11px] hidden sm:inline">
                    ({summarizeMetrics.oldTokens.toLocaleString()} токенов)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-32">
                <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-white h-full transition-all duration-300 rounded-full"
                    style={{ width: `${summarizePercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">{summarizePercent}%</span>
              </div>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 select-text scrollbar-thin"
          >
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isSystem = msg.role === 'system';

              if (isSystem) {
                return (
                  <div key={index} className="flex justify-center my-2">
                    <div className="px-3 py-1 rounded-lg bento-card text-[11px] text-[var(--theme-text-muted)] font-mono flex items-center gap-1.5">
                      <Terminal size={12} />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }

              const { thinking, text } = !isUser ? extractThinkingFromContent(msg.content) : { thinking: '', text: msg.content };

              return (
                <div
                  key={index}
                  className={`flex gap-3 max-w-4xl mx-auto ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bento-card flex items-center justify-center shrink-0 mt-0.5 text-[var(--theme-text)]">
                      {activePersona ? (
                        <MaterialIcon name={activePersona.icon || 'smart_toy'} size={15} />
                      ) : (
                        <MaterialIcon name="smart_toy" size={15} />
                      )}
                    </div>
                  )}

                  <div className={`space-y-2 max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* User Attached Images */}
                    {isUser && msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-end mb-2">
                        {msg.images.map((imgSrc, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={imgSrc}
                            alt="Attached"
                            className="max-h-48 rounded-lg border border-[var(--theme-border)] shadow-md object-contain"
                          />
                        ))}
                      </div>
                    )}

                    {/* Thinking / Reasoning Accordion Block */}
                    {!isUser && reasoningEnabled && thinking && (
                      <ThinkingAccordion thinking={thinking} />
                    )}

                    {/* Message Bubble */}
                    {(text || isUser) && (
                      <div
                        className={`p-4 rounded-xl text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? 'bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)] rounded-tr-sm'
                            : 'bento-card text-[var(--theme-text)] rounded-tl-sm'
                        }`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap">{text}</div>
                        ) : (
                          <NotionMarkdown content={cleanContent(text)} />
                        )}
                      </div>
                    )}

                    {/* Tool Calls Rendering */}
                    {!isUser && msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className="space-y-2 pt-1 w-full">
                        {msg.tool_calls.map((tool) => (
                          <ToolCard
                            key={tool.id}
                            tool={tool}
                            onRespond={onRespondToTool}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Thinking Status Indicator */}
            {agentStatus === 'thinking' && (
              <div className="flex items-center gap-3 max-w-4xl mx-auto p-3 rounded-xl bento-card animate-fadeIn">
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center animate-spin">
                  <Sparkles size={12} className="text-[var(--theme-text)]" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-2">
                    <span>ИИ-Агент рассуждает...</span>
                    <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                      {thinkingSeconds.toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Live Telemetry Card during Generation */}
            {liveTelemetry && agentStatus !== 'idle' && (
              <div className="max-w-4xl mx-auto p-2.5 rounded-xl bento-card border border-[var(--theme-border)] flex items-center justify-between text-[11px] font-mono text-[var(--theme-text-muted)]">
                <div className="flex items-center gap-3">
                  {liveTelemetry.tokensPerSec !== undefined && (
                    <span className="flex items-center gap-1">
                      <Zap size={11} />
                      <span>{liveTelemetry.tokensPerSec.toFixed(1)} t/s</span>
                    </span>
                  )}
                  {liveTelemetry.tokenCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Cpu size={11} />
                      <span>{liveTelemetry.tokenCount} токенов</span>
                    </span>
                  )}
                  {liveTelemetry.contextUsed !== undefined && (
                    <span className="flex items-center gap-1 hidden sm:flex">
                      <Layers size={11} />
                      <span>{liveTelemetry.contextUsed} контекст</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            <div ref={historyEndRef} />
          </div>

          {/* Bottom Floating Command Bar for Active Chat */}
          <div className="p-3 sm:p-4 shrink-0 max-w-4xl mx-auto w-full">
            <FloatingCommandBar
              inputText={inputText}
              setInputText={setInputText}
              onSubmit={handleSubmit}
              agentStatus={agentStatus}
              onCancelAgent={onCancelAgent}
              planningMode={planningMode}
              onTogglePlanningMode={onTogglePlanningMode}
              personas={personas}
              activePersonaId={activePersona?.id || 'default'}
              onSelectPersona={handleSelectPersona}
              attachedImages={attachedImages}
              onAttachImages={(imgs) => setAttachedImages(imgs)}
              onRemoveImage={handleRemoveImage}
              config={config}
              onModelChanged={onModelChanged}
            />
          </div>
        </>
      )}
    </div>
  );
};

// Helper: Collapsible Reasoning / Thinking Accordion
const ThinkingAccordion: React.FC<{ thinking: string }> = ({ thinking }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl bento-card border border-[var(--theme-border)] overflow-hidden font-mono text-xs max-w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-black/40 flex items-center justify-between text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-[var(--theme-text-muted)]" />
          <span className="font-semibold text-[11px] text-[var(--theme-text)]">Ход мыслей (CoT Reasoning)</span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div className="p-3 bg-black/30 border-t border-[var(--theme-border)] text-[var(--theme-text-muted)] text-[11px] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto scrollbar-thin select-text font-mono">
          {thinking}
        </div>
      )}
    </div>
  );
};
