import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Send,
  Brain,
  Terminal,
  Sparkles,
  Zap,
  Cpu,
  Play,
  AlertCircle,
  Plus,
  Folder,
  Layers,
  X,
  Code,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { AppConfig, ChatMessage, LiveTelemetry } from '../types';
import { cleanContent, getWorkspaceBaseName } from '../utils/helpers';
import { ToolCard } from './ToolCard';
import { NotionMarkdown } from './NotionMarkdown';
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
  groqApiKey,
  liveTelemetry,
  planningMode = true,
  onTogglePlanningMode,
  isServerOffline = false,
  onStartServer,
  workspaceDir,
  onSelectWorkspace,
  modelName,
  config,
  onModelChanged: _onModelChanged,
}) => {
  const { showToast } = useToast();
  const [inputText, setInputText] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const historyEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Summarization WebSocket events state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizePhase, setSummarizePhase] = useState('Инициализация фоновой суммаризации...');
  const [summarizePercent, setSummarizePercent] = useState(0);
  const [summarizeMetrics, setSummarizeMetrics] = useState<{ oldTokens?: number; newTokens?: number }>({});

  const activeModelId = config?.model_name || modelName || 'gemini-3.6-flash';
  const isLocalModelActive = activeModelId.startsWith('local:') || activeModelId.endsWith('.gguf');
  const showOfflineBanner = isServerOffline && isLocalModelActive;

  useEffect(() => {
    const u1 = api.listen<{ promptTokens: number; estimatedNewTokens: number }>('agent-summarizing-start', (e) => {
      setIsSummarizing(true);
      setSummarizePercent(15);
      setSummarizePhase('Инициализация фоновой LLM-суммаризации...');
      setSummarizeMetrics({ oldTokens: e.payload.promptTokens });
    });

    const u2 = api.listen<{ phase: string; percent: number }>('agent-summarizing-progress', (e) => {
      setSummarizePhase(e.payload.phase);
      setSummarizePercent(e.payload.percent);
    });

    let sumTimer: any = null;
    const u3 = api.listen<{ oldTokens: number; newTokens: number; summary: string }>('agent-summarizing-end', (e) => {
      setSummarizePercent(100);
      setSummarizePhase('Контекст успешно сжат!');
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
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
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

  const handleMicClick = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size < 2000) {
          showToast('Аудиозапись слишком короткая', 'info');
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          if (!base64Audio) return;

          const keyToUse = groqApiKey || '';
          if (!keyToUse) {
            showToast('Укажите Groq API Key в Настройках для использования распознавания речи Whisper', 'error');
            return;
          }

          setIsTranscribing(true);
          try {
            const transcribedText = await api.transcribe_audio(base64Audio, keyToUse);
            if (transcribedText.trim()) {
              setInputText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
              showToast('Речь успешно распознана!', 'success');
            }
          } catch (err: any) {
            console.error('STT Transcription error:', err);
            showToast(`Ошибка распознавания речи: ${err.message || err}`, 'error');
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      showToast('Не удалось получить доступ к микрофону', 'error');
    }
  };

  const hasMessages = messages.length > 0;

  const renderAttachedImagesPreview = () => {
    if (attachedImages.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 p-2 bg-slate-950/60 rounded-lg border border-white/10 max-h-32 overflow-y-auto">
        {attachedImages.map((img, idx) => (
          <div key={idx} className="relative group shrink-0">
            <img
              src={img}
              alt={`Прикрепленное изображение ${idx + 1}`}
              className="w-14 h-14 object-cover rounded-md border border-white/20"
            />
            <button
              type="button"
              onClick={() => handleRemoveImage(idx)}
              className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-rose-500 text-white shadow hover:bg-rose-600 cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderStreamingBanner = () => {
    if (!liveTelemetry || agentStatus !== 'thinking') return null;
    return (
      <div className="p-3 rounded-xl bg-slate-900/90 border border-sky-500/30 text-xs font-mono text-slate-200 flex items-center justify-between gap-3 shadow-lg animate-pulse my-2">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="animate-spin text-sky-400" />
          <span className="text-sky-300 font-semibold">Генерация ответа ИИ...</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          {liveTelemetry.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Zap size={11} />
              <span>{liveTelemetry.tokensPerSec} t/s</span>
            </span>
          )}
          {liveTelemetry.contextUsed !== undefined && (
            <span className="text-blue-300 flex items-center gap-1">
              <Brain size={11} />
              <span>{liveTelemetry.contextUsed.toLocaleString()} tok</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSummarizingBanner = () => {
    if (!isSummarizing) return null;
    return (
      <div className="p-3 rounded-xl bg-purple-950/80 border border-purple-500/40 text-xs font-mono text-purple-200 flex flex-col gap-1.5 shadow-lg my-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="animate-spin text-purple-400" />
            <span className="font-bold text-purple-300">{summarizePhase}</span>
          </div>
          <span className="text-[10px] font-bold text-purple-400">{summarizePercent}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-purple-900/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-300"
            style={{ width: `${summarizePercent}%` }}
          />
        </div>
        {summarizeMetrics.oldTokens && (
          <div className="text-[10px] text-purple-300/80 flex items-center justify-between">
            <span>Сжатие контекста: {summarizeMetrics.oldTokens.toLocaleString()} токенов</span>
            {summarizeMetrics.newTokens && (
              <span className="text-emerald-400 font-bold">➔ {summarizeMetrics.newTokens.toLocaleString()} токенов</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`w-full h-full flex flex-col overflow-hidden relative font-sans ${
        isDraggingOver ? 'bg-sky-500/5 ring-2 ring-sky-500/40 ring-inset' : ''
      }`}
    >
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && processImageFiles(e.target.files)}
      />

      {/* OFFLINE LOCAL SERVER WARNING BANNER (Only displayed if a LOCAL model is active AND server is offline) */}
      {showOfflineBanner && (
        <div className="p-2.5 bg-rose-950/80 border-b border-rose-500/30 text-xs text-rose-200 flex items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span>Локальный ИИ-сервер llama.cpp не запущен для модели <code className="font-mono text-white bg-black/40 px-1 py-0.5 rounded">{activeModelId}</code></span>
          </div>
          {onStartServer && (
            <button
              type="button"
              onClick={onStartServer}
              className="flat-btn px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold cursor-pointer flex items-center gap-1 text-xs shrink-0"
            >
              <Play size={11} />
              <span>Запустить сервер</span>
            </button>
          )}
        </div>
      )}

      {/* 1. EMPTY CHAT STATE */}
      {!hasMessages && (
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto scrollbar-none">
          <div className="w-full max-w-2xl space-y-6 text-center">
            
            {/* Hero Brand Icon & Title */}
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-purple-500/20 border border-white/15 shadow-xl backdrop-blur-xl">
                <Sparkles size={28} className="text-sky-400 animate-pulse" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                0xAgent <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-400">Autonomous Developer</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                Локальный автономный ИИ-ассистент. Поддержка вызова облачных моделей Google AI Studio и локальных .gguf файлов.
              </p>
            </div>

            {/* Workspace Bar */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {onSelectWorkspace && (
                <button
                  type="button"
                  onClick={onSelectWorkspace}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 text-xs text-slate-200 transition-colors cursor-pointer"
                  title={workspaceDir || 'Выбрать папку проекта'}
                >
                  <Folder size={13} className="text-emerald-400" />
                  <span className="font-mono text-xs">{getWorkspaceBaseName(workspaceDir)}</span>
                </button>
              )}
            </div>

            {/* Quick Action Prompt Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left max-w-xl mx-auto pt-2">
              <button
                type="button"
                onClick={() => setInputText('Создай новое веб-приложение React с современным стеклом и анимациями.')}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-xs text-slate-300 hover:text-white flex items-start gap-2.5 cursor-pointer group"
              >
                <Code size={16} className="text-sky-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-semibold text-slate-100">Создать веб-приложение</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Разработка интерфейса React с CSS-стилями</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setInputText('Проведи аудит безопасности и найди баги в активном проекте.')}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-xs text-slate-300 hover:text-white flex items-start gap-2.5 cursor-pointer group"
              >
                <ShieldAlert size={16} className="text-purple-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-semibold text-slate-100">Поиск и исправление багов</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Анализ кода, типов и потенциальных уязвимостей</div>
                </div>
              </button>
            </div>

            {/* Input Form Box */}
            <div className="pt-2 w-full max-w-xl mx-auto">
              <form onSubmit={handleSubmit} className="w-full">
                <div className="rounded-2xl bg-[#111319] border border-white/10 p-3 focus-within:border-white/25 transition-all flex flex-col gap-2 shadow-2xl">
                  {renderAttachedImagesPreview()}

                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Спросите что угодно"
                    rows={2}
                    className="w-full p-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed font-sans"
                  />

                  <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        title="Прикрепить изображение"
                      >
                        <Plus size={18} />
                      </button>

                      {onTogglePlanningMode && (
                        <button
                          type="button"
                          onClick={onTogglePlanningMode}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                            planningMode
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          <Brain size={14} />
                          <span>Размышление</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleMicClick}
                        className={`p-2 rounded-full transition-colors cursor-pointer ${
                          isRecording ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                        title="Голосовой ввод"
                      >
                        {isRecording ? <Square size={16} /> : <Mic size={18} />}
                      </button>

                      <button
                        type="submit"
                        disabled={(!inputText.trim() && attachedImages.length === 0) || isTranscribing}
                        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow cursor-pointer shrink-0"
                        title="Отправить"
                      >
                        <Send size={14} className="translate-x-[0.5px]" />
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* 2. MAIN CHAT HISTORY LIST */}
      {hasMessages && (
        <div className="flex-grow flex flex-col justify-between overflow-hidden relative w-full max-w-4xl mx-auto select-text">
          
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-none flex flex-col min-h-0 select-text"
          >
            {messages.map((msg) => {
              const textOutput = cleanContent(msg.content);
              return (
                <div key={msg.id} className="flex flex-col space-y-1 w-full select-text">
                  {msg.role === 'user' && (
                    <div className="self-end max-w-[85%] rounded-2xl glass-card border border-[var(--theme-accent)]/30 bg-[var(--theme-card-bg)] px-4 py-2.5 text-theme-text text-xs sm:text-sm leading-relaxed font-sans select-text shadow-md flex flex-col gap-2">
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 my-1">
                          {msg.images.map((imgUrl, i) => (
                            <img
                              key={i}
                              src={imgUrl}
                              alt={`Прикрепленное изображение ${i + 1}`}
                              className="max-w-[240px] max-h-[180px] rounded-lg border border-white/20 object-contain bg-slate-950/60 shadow-md"
                            />
                          ))}
                        </div>
                      )}
                      {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
                    </div>
                  )}

                  {msg.role === 'tool' && (
                    <div className="self-start max-w-[95%] w-full rounded-xl glass-card border border-[var(--theme-border)] p-3 bg-black/40 text-theme-muted font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap my-1 select-text">
                      <div className="text-[10px] text-theme-muted font-medium uppercase tracking-wider mb-1 flex items-center gap-1 font-sans">
                        <Terminal size={10} />
                        <span>Результат выполнения инструмента</span>
                      </div>
                      {msg.content}
                    </div>
                  )}

                  {msg.role === 'assistant' && (() => {
                    let thinkText = '';
                    let bodyText = textOutput;

                    if (textOutput) {
                      // 1. Standard <think>...</think> (closed)
                      const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
                      const match = textOutput.match(thinkRegex);
                      if (match) {
                        thinkText = match[1].trim();
                        bodyText = textOutput.replace(thinkRegex, '').trim();
                      }
                      // 2. Gemma 4 <|channel>thought...<channel|> (closed)
                      else {
                        const gemmaThinkRegex = /<\|channel>thought([\s\S]*?)<channel\|>/i;
                        const gemmaMatch = textOutput.match(gemmaThinkRegex);
                        if (gemmaMatch) {
                          thinkText = gemmaMatch[1].trim();
                          bodyText = textOutput.replace(gemmaThinkRegex, '').trim();
                        }
                        // 3. Standard <think> (unclosed / streaming)
                        else if (textOutput.includes('<think>')) {
                          const startIdx = textOutput.indexOf('<think>');
                          thinkText = textOutput.substring(startIdx + 7).trim();
                          bodyText = textOutput.substring(0, startIdx).trim();
                        }
                        // 4. Gemma 4 <|channel>thought (unclosed / streaming)
                        else {
                          const gemmaOpenMatch = textOutput.match(/<\|channel>thought/i);
                          if (gemmaOpenMatch && gemmaOpenMatch.index !== undefined) {
                            const startIdx = gemmaOpenMatch.index;
                            thinkText = textOutput.substring(startIdx + '<|channel>thought'.length).trim();
                            bodyText = textOutput.substring(0, startIdx).trim();
                          }
                        }
                      }
                    }

                    return (
                      <div className="self-start max-w-[95%] w-full rounded-xl glass-panel border border-white/10 p-4 text-slate-100 text-xs sm:text-sm leading-relaxed my-1.5 select-text">
                        {reasoningEnabled && thinkText && (
                          <details open className="mb-3 border border-white/10 rounded-lg bg-slate-950/40 overflow-hidden group">
                            <summary className="px-3 py-1.5 text-[11px] font-medium text-slate-300 select-none cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between font-sans">
                              <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
                                <Sparkles size={12} className="text-purple-400" />
                                Ход мыслей модели
                              </span>
                              <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="p-3 border-t border-white/5 font-mono text-xs text-purple-200/90 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto bg-slate-950/60">
                              {thinkText}
                            </div>
                          </details>
                        )}
                        <NotionMarkdown content={bodyText} />

                        {msg.tool_calls && msg.tool_calls.length > 1 && (() => {
                          let totalAdds = 0;
                          let totalDels = 0;
                          msg.tool_calls.forEach((t) => {
                            try {
                              const args = JSON.parse(t.arguments);
                              if (t.name === 'write_file' && args.content) {
                                totalAdds += (args.content as string).split(/\r?\n/).length;
                              } else if (t.name === 'patch_file' && args.content) {
                                const raw = args.content as string;
                                const s = raw.match(/<<<<<<< SEARCH([\s\S]*?)=======/g) || [];
                                for (const m of s) totalDels += Math.max(0, m.split(/\r?\n/).length - 2);
                                const r = raw.match(/=======([\s\S]*?)>>>>>>> REPLACE/g) || [];
                                for (const m of r) totalAdds += Math.max(0, m.split(/\r?\n/).length - 2);
                              }
                            } catch {}
                          });

                          return (
                            <div className="my-2 p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-200 flex items-center gap-1.5 font-sans">
                                  <Layers size={14} className="text-amber-400" />
                                  <span>{msg.tool_calls.length} файлов изменено</span>
                                </span>
                                {(totalAdds > 0 || totalDels > 0) && (
                                  <span className="text-[11px] font-bold">
                                    {totalAdds > 0 && <span className="text-emerald-400">+{totalAdds} </span>}
                                    {totalDels > 0 && <span className="text-rose-400">-{totalDels}</span>}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {msg.tool_calls && msg.tool_calls.map((tool) => (
                          <ToolCard 
                            key={tool.id} 
                            tool={tool} 
                            onRespond={onRespondToTool} 
                          />
                        ))}

                        {/* COMPACT METRICS FOOTER PILL */}
                        {msg.metrics && (
                          <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400 select-none">
                            {msg.metrics.tokensPerSec !== undefined && msg.metrics.tokensPerSec > 0 && (
                              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                                <Zap size={11} />
                                <span>{msg.metrics.tokensPerSec} t/s</span>
                              </span>
                            )}
                            {msg.metrics.contextUsed !== undefined && (
                              <span className="flex items-center gap-1 text-blue-300">
                                <Brain size={11} />
                                <span>Контекст: {msg.metrics.contextUsed.toLocaleString()} / {msg.metrics.contextMax?.toLocaleString()} tok</span>
                              </span>
                            )}
                            {msg.metrics.modelName && (
                              <span className="flex items-center gap-1 text-purple-300">
                                <Cpu size={11} />
                                <span>{msg.metrics.modelName}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {/* LIVE STREAMING TELEMETRY BANNER */}
            {renderStreamingBanner()}

            <div ref={historyEndRef} />
          </div>

          {/* SUMMARIZING SCI-FI BANNER */}
          {renderSummarizingBanner()}

          {/* INPUT FORM CONTAINER (OLED Minimal Aesthetic) */}
          <div className="p-3 bg-[#08090d]/90 border-t border-white/5 select-none z-10 w-full flex flex-col gap-2 backdrop-blur-xl">
            {renderAttachedImagesPreview()}

            <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
              <div className="rounded-2xl bg-[#111319] border border-white/10 p-3 focus-within:border-white/25 transition-all flex flex-col gap-2 shadow-2xl">
                
                {/* Top Input Area: Plus Button & Textarea */}
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="p-1.5 mt-0.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                    title="Прикрепить файл или изображение"
                  >
                    <Plus size={18} />
                  </button>

                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    rows={1}
                    placeholder="Спросите что угодно"
                    className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none min-h-[38px] max-h-[200px] py-1.5 leading-relaxed font-sans"
                  />
                </div>

                {/* Bottom Input Controls Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  
                  {/* Left Pill: Thinking / Planning Toggle */}
                  <div className="flex items-center gap-2">
                    {onTogglePlanningMode && (
                      <button
                        type="button"
                        onClick={onTogglePlanningMode}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                          planningMode
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                        title="Переключить режим планирования/размышления"
                      >
                        <Brain size={14} className={planningMode ? 'text-blue-400' : 'text-slate-400'} />
                        <span>Размышление</span>
                      </button>
                    )}
                  </div>

                  {/* Right Actions: Mic & Submit / Stop */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleMicClick}
                      className={`p-2 rounded-full transition-colors cursor-pointer ${
                        isRecording ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                      title="Голосовой ввод"
                    >
                      {isRecording ? <Square size={16} /> : <Mic size={18} />}
                    </button>

                    {agentStatus !== 'idle' && onCancelAgent ? (
                      <button
                        type="button"
                        onClick={onCancelAgent}
                        className="w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow cursor-pointer shrink-0"
                        title="Остановить генерацию"
                      >
                        <Square size={14} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={(!inputText.trim() && attachedImages.length === 0) || isTranscribing}
                        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow cursor-pointer shrink-0"
                        title="Отправить"
                      >
                        <Send size={14} className="translate-x-[0.5px]" />
                      </button>
                    )}
                  </div>

                </div>

              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
