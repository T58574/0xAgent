import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import { AppConfig, ChatMessage, LiveTelemetry, PersonaMetadata } from '../types';
import {
  cleanContent,
  extractThinkingFromContent,
  formatDateSeparator,
  isSameDay,
  formatTime,
} from '../utils/helpers';
import { ToolCard } from './ToolCard';
import { NotionMarkdown } from './NotionMarkdown';
import { AsciiCanvasEngine } from './common/AsciiCanvasEngine';
import { MaterialIcon } from './common/MaterialIcon';
import { FloatingCommandBar } from './chat/FloatingCommandBar';
import { ReasoningViewer } from './chat/ReasoningViewer';
import { ChatTimelineScrubber } from './chat/ChatTimelineScrubber';
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
  planningMode: _planningMode = true,
  onTogglePlanningMode: _onTogglePlanningMode,
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

  // ASCII thinking animation frames
  const ASCII_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [asciiFrameIndex, setAsciiFrameIndex] = useState(0);

  // Live thinking timer state
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  useEffect(() => {
    if (agentStatus !== 'thinking' && agentStatus !== 'executing_tool') return;
    const interval = setInterval(() => {
      setAsciiFrameIndex((prev) => (prev + 1) % ASCII_FRAMES.length);
    }, 75);
    return () => clearInterval(interval);
  }, [agentStatus]);

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
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 select-text scrollbar-thin relative"
          >
            {/* Interactive Timeline Navigation Scrubber */}
            <ChatTimelineScrubber
              messages={messages}
              containerRef={chatContainerRef}
              isScrolledUp={isUserScrolledUpRef.current}
              isGenerating={agentStatus === 'thinking' || agentStatus === 'executing_tool'}
              onScrollToBottom={() => {
                if (chatContainerRef.current) {
                  chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                  isUserScrolledUpRef.current = false;
                }
              }}
              onScrollToTop={() => {
                if (chatContainerRef.current) {
                  chatContainerRef.current.scrollTop = 0;
                }
              }}
            />

            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isSystem = msg.role === 'system';
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const isFirstOfDay = !prevMsg || (msg.timestamp && prevMsg.timestamp && !isSameDay(prevMsg.timestamp, msg.timestamp));

              if (isSystem) {
                return (
                  <React.Fragment key={msg.id || index}>
                    {isFirstOfDay && msg.timestamp && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono text-[var(--theme-text-muted)] select-none">
                          {formatDateSeparator(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div id={`msg-${msg.id || index}`} className="flex justify-center my-3 transition-all duration-300">
                      <div className="px-3.5 py-1 rounded-full bento-card text-[11px] text-[var(--theme-text-muted)] font-mono flex items-center gap-1.5 shadow-sm">
                        <Terminal size={12} />
                        <span>{msg.content}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              const { thinking, text, isStreamingThink } = !isUser
                ? extractThinkingFromContent(msg.content)
                : { thinking: '', text: msg.content, isStreamingThink: false };

              const isLastAssistantMessage = !isUser && index === messages.length - 1;
              const isActivelyGenerating = isLastAssistantMessage && (agentStatus === 'thinking' || agentStatus === 'executing_tool');
              const hasThinking = Boolean(thinking && thinking.trim().length > 0);
              const hasText = Boolean(text && text.trim().length > 0);
              const hasTools = Boolean(msg.tool_calls && msg.tool_calls.length > 0);

              // Do not render empty bubble if there is no content and message is not actively generating
              if (!isUser && !hasThinking && !hasText && !hasTools && !isActivelyGenerating) {
                return null;
              }

              return (
                <React.Fragment key={msg.id || index}>
                  {/* Date section separator */}
                  {isFirstOfDay && msg.timestamp && (
                    <div className="flex justify-center my-4">
                      <span className="px-3 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono text-[var(--theme-text-muted)] select-none">
                        {formatDateSeparator(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  <div
                    id={`msg-${msg.id || index}`}
                    className={`flex max-w-3xl mx-auto w-full my-3 transition-all duration-300 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {isUser ? (
                      /* User Bubble (Telegram Outgoing Style with Theme Styling) */
                      <div className="relative w-fit max-w-[78%] bg-[var(--theme-accent,#38bdf8)]/15 text-[var(--theme-text)] border border-[var(--theme-accent,#38bdf8)]/30 rounded-2xl rounded-tr-[4px] px-4 py-2.5 shadow-md text-[13.5px] leading-relaxed select-text space-y-1.5 transition-all">
                        {/* Attached Images */}
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-end mb-2">
                            {msg.images.map((imgSrc, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={imgSrc}
                                alt="Attached"
                                className="max-h-48 rounded-xl border border-[var(--theme-border)] shadow-md object-contain"
                              />
                            ))}
                          </div>
                        )}

                        {/* Text & Inline Timestamp with Double Checkmarks */}
                        <div className="flex flex-wrap items-end justify-end gap-x-3 gap-y-1">
                          <span className="whitespace-pre-wrap flex-1 text-left">{text}</span>
                          <span className="text-[10px] text-[var(--theme-text-muted)] font-sans select-none shrink-0 inline-flex items-center gap-1 opacity-80">
                            {formatTime(msg.timestamp)}
                            <CheckCheck size={13} className="text-[var(--theme-accent,#38bdf8)]" />
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Assistant Bubble (Telegram Incoming Style with Bento Glass Theme) */
                      <div className="relative w-fit max-w-[85%] bento-card text-[var(--theme-text)] border border-[var(--theme-border)] rounded-2xl rounded-tl-[4px] px-4.5 py-3 shadow-md text-[13.5px] leading-relaxed select-text space-y-2.5 transition-all">
                        {/* Thinking / Reasoning Block (Active when thinking exists OR while actively generating before text begins) */}
                        {reasoningEnabled && (hasThinking || (isActivelyGenerating && !hasText)) && (
                          <div className="mb-2 w-full">
                            <ReasoningViewer
                              thinking={thinking}
                              isLive={isStreamingThink || isActivelyGenerating}
                              thinkingSeconds={thinkingSeconds}
                              liveTelemetry={liveTelemetry}
                              defaultExpanded={false}
                            />
                          </div>
                        )}

                        {/* Assistant Text & Bottom Right Timestamp */}
                        {text && (
                          <div className="space-y-1">
                            <NotionMarkdown content={cleanContent(text)} />
                            <div className="flex justify-end pt-0.5">
                              <span className="text-[10px] text-[var(--theme-text-muted)] opacity-60 font-sans select-none">
                                {formatTime(msg.timestamp)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Tool Calls Rendering */}
                        {msg.tool_calls && msg.tool_calls.length > 0 && (
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
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* Live Thinking ASCII HUD (displayed while agent is thinking before assistant message tokens arrive) */}
            {agentStatus === 'thinking' && (!messages.some((m) => m.role === 'assistant' && (m.content.trim().length > 0 || (m.tool_calls && m.tool_calls.length > 0)))) && (
              <div className="flex justify-start max-w-3xl mx-auto w-full my-3">
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bento-card border border-[var(--theme-border)] text-xs text-[var(--theme-text)] animate-fadeIn shadow-sm font-mono">
                  <span className="text-[var(--theme-accent)] font-bold text-sm tracking-wider select-none">
                    {ASCII_FRAMES[asciiFrameIndex]}
                  </span>
                  <span className="font-medium text-xs text-[var(--theme-text)]">
                    ИИ-Агент рассуждает...
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--theme-text-muted)] opacity-80">
                    <MaterialIcon name="schedule" size={11} />
                    <span>{thinkingSeconds.toFixed(1)}s</span>
                  </span>
                  {liveTelemetry?.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--theme-accent)] font-semibold pl-1 border-l border-[var(--theme-border)]">
                      <MaterialIcon name="bolt" size={11} />
                      <span>{liveTelemetry.tokensPerSec.toFixed(1)} t/s</span>
                    </span>
                  )}
                  {liveTelemetry?.tokenCount !== undefined && liveTelemetry.tokenCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--theme-text-muted)]">
                      <MaterialIcon name="memory" size={11} />
                      <span>{liveTelemetry.tokenCount} tok</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Live Telemetry Card during Generation */}
            {liveTelemetry && agentStatus !== 'idle' && (
              <div className="flex justify-start max-w-3xl mx-auto w-full my-2">
                <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bento-card border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-text-muted)] shadow-sm">
                  {liveTelemetry.tokensPerSec !== undefined && (
                    <span className="flex items-center gap-1 text-[var(--theme-accent)] font-semibold">
                      <MaterialIcon name="bolt" size={12} />
                      <span>{liveTelemetry.tokensPerSec.toFixed(1)} t/s</span>
                    </span>
                  )}
                  {liveTelemetry.tokenCount !== undefined && (
                    <span className="flex items-center gap-1 text-[var(--theme-text)]">
                      <MaterialIcon name="memory" size={12} className="text-[var(--theme-text-muted)]" />
                      <span>{liveTelemetry.tokenCount} токенов</span>
                    </span>
                  )}
                  {liveTelemetry.contextUsed !== undefined && (
                    <span className="flex items-center gap-1 hidden sm:flex text-[var(--theme-text-muted)]">
                      <MaterialIcon name="storage" size={12} />
                      <span>{liveTelemetry.contextUsed.toLocaleString()}{liveTelemetry.contextMax ? ` / ${liveTelemetry.contextMax.toLocaleString()}` : ''}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            <div ref={historyEndRef} />
          </div>

          {/* Bottom Floating Command Bar for Active Chat */}
          <div className="p-3 sm:p-4 shrink-0 max-w-3xl mx-auto w-full">
            <FloatingCommandBar
              inputText={inputText}
              setInputText={setInputText}
              onSubmit={handleSubmit}
              agentStatus={agentStatus}
              onCancelAgent={onCancelAgent}
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

