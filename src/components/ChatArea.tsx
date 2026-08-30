import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import {
  AppConfig,
  ChatMessage,
  LiveTelemetry,
  PersonaMetadata,
  JarvisSparkProposal,
  ChatSession,
} from '../types';
import { isSameDay } from '../utils/helpers';
import { FloatingCommandBar } from './chat/FloatingCommandBar';
import { ChatTimelineScrubber } from './chat/ChatTimelineScrubber';
import { JarvisSparkCard } from './chat/JarvisSparkCard';
import { PlanProgressStrip } from './chat/PlanProgressStrip';
import { EmptyChatHero } from './chat/EmptyChatHero';
import { TelemetryHUD } from './chat/TelemetryHUD';
import { ChatMessageItem } from './chat/ChatMessageItem';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { sounds } from '../services/soundEffects';

interface ChatAreaProps {
  messages: ChatMessage[];
  currentSession?: ChatSession | null;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onSendMessage: (text: string, images?: string[]) => void;
  onRespondToTool: (toolId: string, approve: boolean | string) => void;
  onCancelAgent?: () => void;
  onRollbackSession?: (targetMessageId: string, mode: 'to_user_edit' | 'to_assistant') => Promise<string>;
  reasoningEnabled?: boolean;
  liveTelemetry?: LiveTelemetry | null;
  config?: AppConfig | null;
  onModelChanged?: (newModelId: string) => void;
  onConfigChanged?: (newConfig: AppConfig) => void;
  onAcceptSpark?: (spark: JarvisSparkProposal) => void;
  personas?: PersonaMetadata[];
  activePersonaId?: string;
  onSelectPersona?: (id: string) => void;
  onOpenCustomizations?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = React.memo(({
  messages,
  currentSession,
  agentStatus,
  onSendMessage,
  onRespondToTool,
  onCancelAgent,
  onRollbackSession,
  onAcceptSpark,
  reasoningEnabled = true,
  liveTelemetry,
  config,
  onModelChanged,
  onConfigChanged,
  personas: personasProp = [],
  activePersonaId: activePersonaIdProp,
  onSelectPersona: onSelectPersonaProp,
  onOpenCustomizations,
}) => {
  const { showToast } = useToast();
  const { t, formatString } = useI18n();
  const [inputText, setInputText] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const historyEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  // Summarization state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizePhase, setSummarizePhase] = useState(t.chat.summarizedContext);
  const [summarizePercent, setSummarizePercent] = useState(0);
  const [summarizeMetrics, setSummarizeMetrics] = useState<{ oldTokens?: number; newTokens?: number }>({});

  // Personas
  const [localPersonas, setLocalPersonas] = useState<PersonaMetadata[]>([]);

  // Jarvis Proactive Sparks
  const [activeSparks, setActiveSparks] = useState<JarvisSparkProposal[]>([]);

  // Load fallback personas if not passed via props
  useEffect(() => {
    if (personasProp.length === 0) {
      api.get_personas().then((list) => {
        setLocalPersonas(list);
      }).catch((err) => console.error('Failed to load personas in ChatArea:', err));
    }
  }, [personasProp.length]);

  const personas = personasProp.length > 0 ? personasProp : localPersonas;
  const activePersonaId = activePersonaIdProp || config?.active_persona_id || 'default';

  // Listeners for summarization, proactive sparks and audio
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

    const u4 = api.listen<JarvisSparkProposal>('jarvis_spark_proposal', (e) => {
      setActiveSparks((prev) => [e.payload, ...prev.filter((s) => s.id !== e.payload.id)]);
    });

    const u5 = api.listen<JarvisSparkProposal>('jarvis_spark_updated', (e) => {
      if (e.payload.status !== 'pending') {
        setActiveSparks((prev) => prev.filter((s) => s.id !== e.payload.id));
      } else {
        setActiveSparks((prev) => prev.map((s) => (s.id === e.payload.id ? e.payload : s)));
      }
    });

    const u6 = api.listen<{ text: string; audioBase64?: string }>('jarvis_speak', (e) => {
      if (config?.tts_config?.play_in_browser && !config?.tts_config?.play_on_speaker && e.payload.audioBase64) {
        try {
          const audio = new Audio(e.payload.audioBase64);
          audio.volume = 0.6;
          audio.play().catch(() => {});
        } catch {}
      }
    });

    api.get_jarvis_state().then((st) => {
      if (st?.activeSparks) {
        setActiveSparks(st.activeSparks.filter((s) => s.status === 'pending'));
      }
    }).catch(() => {});

    return () => {
      if (sumTimer) clearTimeout(sumTimer);
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [config?.tts_config?.play_in_browser]);

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
  }, [messages, agentStatus]);

  const processImageFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showToast(t.toasts.selectImageFile, 'info');
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast(t.toasts.fileSizeExceedsLimit, 'error');
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
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
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
    if (e.dataTransfer?.files) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && attachedImages.length === 0) return;
    sounds.playSend();
    onSendMessage(inputText, attachedImages.length > 0 ? attachedImages : undefined);
    setInputText('');
    setAttachedImages([]);
  };

  const handleSelectPersona = async (personaId: string) => {
    if (onSelectPersonaProp) {
      onSelectPersonaProp(personaId);
      return;
    }
    const p = personas.find((item) => item.id === personaId);
    if (!p) return;
    try {
      const updatedList = await api.activate_persona(p.id);
      setLocalPersonas(updatedList);
      showToast(formatString(t.toasts.personaActivated, { name: p.name }), 'success');
    } catch (err: any) {
      showToast(formatString(t.toasts.personaSwitchError, { error: err.message || err }), 'error');
    }
  };

  const handleAcceptSpark = async (spark: JarvisSparkProposal) => {
    setActiveSparks((prev) => prev.filter((s) => s.id !== spark.id));
    if (onAcceptSpark) {
      onAcceptSpark(spark);
      return;
    }
    try {
      await api.accept_spark(spark.id);
      const directive = spark.directivePrompt || spark.suggestedAction || spark.description;
      onSendMessage(directive);
    } catch (err: any) {
      showToast(formatString(t.toasts.launchError, { error: err.message || err }), 'error');
    }
  };

  const handleDismissSpark = async (sparkId: string) => {
    try {
      await api.dismiss_spark(sparkId);
      setActiveSparks((prev) => prev.filter((s) => s.id !== sparkId));
    } catch (err: any) {
      console.error('Failed to dismiss spark:', err);
    }
  };

  const handleSpeakPhrase = async (text: string) => {
    try {
      await api.speak_text(text, {
        voice: config?.tts_config?.voice,
        rate: config?.tts_config?.rate,
      });
    } catch (err: any) {
      console.error('Failed to speak phrase:', err);
    }
  };

  const visibleMessages = React.useMemo(() => {
    return messages.filter((m) => m.role !== 'tool');
  }, [messages]);

  const hasMessages = visibleMessages.length > 0;

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
      {/* 1. EMPTY CHAT STATE */}
      {!hasMessages && (
        <EmptyChatHero
          inputText={inputText}
          setInputText={setInputText}
          onSubmit={handleSubmit}
          agentStatus={agentStatus}
          onCancelAgent={onCancelAgent}
          personas={personas}
          activePersonaId={activePersonaId}
          onSelectPersona={handleSelectPersona}
          attachedImages={attachedImages}
          onAttachImages={(imgs) => setAttachedImages(imgs)}
          onRemoveImage={handleRemoveImage}
          config={config}
          onModelChanged={onModelChanged}
          onConfigChanged={onConfigChanged}
          activeSparks={activeSparks}
          onAcceptSpark={handleAcceptSpark}
          onDismissSpark={handleDismissSpark}
          onSpeakPhrase={handleSpeakPhrase}
          currentSession={currentSession}
        />
      )}

      {/* 2. ACTIVE CHAT MESSAGES STREAM */}
      {hasMessages && (
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          {/* Background Context Compression Banner */}
          {isSummarizing && (
            <div className="px-4 py-2.5 bg-[var(--theme-panel)] border-b border-[var(--theme-border)] shrink-0 flex items-center justify-between text-xs z-10 backdrop-blur-md animate-fadeIn">
              <div className="flex items-center gap-2 font-mono">
                <Sparkles size={14} className="animate-spin text-[var(--theme-accent)]" />
                <span className="font-bold text-[var(--theme-text)]">{summarizePhase}</span>
                {summarizeMetrics.oldTokens && (
                  <span className="text-[var(--theme-text-muted)] text-[11px] hidden sm:inline">
                    ({summarizeMetrics.oldTokens.toLocaleString()} {t.chat.tokens})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-32">
                <div className="flex-1 bg-[var(--theme-border-subtle)] h-1.5 rounded-full overflow-hidden border border-[var(--theme-border)]">
                  <div
                    className="bg-[var(--theme-accent)] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${summarizePercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--theme-text-muted)] font-bold">{summarizePercent}%</span>
              </div>
            </div>
          )}

          {/* Interactive Timeline Navigation Scrubber */}
          <ChatTimelineScrubber
            messages={visibleMessages}
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

          {/* Messages Scroll Area */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto p-2.5 sm:p-4 md:p-6 space-y-4 sm:space-y-6 select-text scrollbar-thin"
          >
            {visibleMessages.map((msg, index) => {
              const prevMsg = index > 0 ? visibleMessages[index - 1] : null;
              const isFirstOfDay = Boolean(!prevMsg || (msg.timestamp && prevMsg.timestamp && !isSameDay(prevMsg.timestamp, msg.timestamp)));
              const isLastAssistantMessage = msg.role === 'assistant' && index === visibleMessages.length - 1;

              return (
                <ChatMessageItem
                  key={msg.id || index}
                  msg={msg}
                  index={index}
                  isFirstOfDay={isFirstOfDay}
                  currentSession={currentSession}
                  reasoningEnabled={reasoningEnabled}
                  isLastAssistantMessage={isLastAssistantMessage}
                  agentStatus={agentStatus}
                  liveTelemetry={liveTelemetry}
                  onRespondToTool={onRespondToTool}
                  onRollbackSession={onRollbackSession}
                  onSetInputText={setInputText}
                  showToast={showToast}
                />
              );
            })}

            {/* Live Telemetry & Thinking Indicator via TelemetryHUD */}
            <TelemetryHUD
              liveTelemetry={liveTelemetry}
              agentStatus={agentStatus}
              showThinkingBanner={
                agentStatus === 'thinking' &&
                !visibleMessages.some(
                  (m) =>
                    m.role === 'assistant' &&
                    (m.content.trim().length > 0 || (m.tool_calls && m.tool_calls.length > 0))
                )
              }
              onOpenCustomizations={onOpenCustomizations}
            />

            <div ref={historyEndRef} />
          </div>

          {/* Bottom Floating Command Bar for Active Chat */}
          <div className="p-2 sm:p-4 shrink-0 max-w-3xl mx-auto w-full pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {config?.proactive_companion_enabled !== false && activeSparks.length > 0 && (
              <div className="space-y-2 mb-3">
                {activeSparks.map((spark) => (
                  <JarvisSparkCard
                    key={spark.id}
                    spark={spark}
                    onAccept={handleAcceptSpark}
                    onDismiss={handleDismissSpark}
                    onSpeak={handleSpeakPhrase}
                  />
                ))}
              </div>
            )}

            {currentSession?.active_todos && currentSession.active_todos.length > 0 && (
              <PlanProgressStrip todos={currentSession.active_todos} />
            )}

            <FloatingCommandBar
              inputText={inputText}
              setInputText={setInputText}
              onSubmit={handleSubmit}
              agentStatus={agentStatus}
              onCancelAgent={onCancelAgent}
              personas={personas}
              activePersonaId={activePersonaId}
              onSelectPersona={handleSelectPersona}
              attachedImages={attachedImages}
              onAttachImages={(imgs) => setAttachedImages(imgs)}
              onRemoveImage={handleRemoveImage}
              config={config}
              onModelChanged={onModelChanged}
              onConfigChanged={onConfigChanged}
            />
          </div>
        </div>
      )}
    </div>
  );
});
