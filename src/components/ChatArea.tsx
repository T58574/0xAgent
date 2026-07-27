import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Send,
  Brain,
  Terminal,
  Sparkles,
  RefreshCw,
  Zap,
  Cpu,
  Play,
  AlertCircle,
  Plus,
  Folder,
  ChevronDown,
  Eye,
  Layers,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { ChatMessage, LiveTelemetry } from '../types';
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
  onOpenModelPicker?: () => void;
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
  onOpenModelPicker,
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

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFiles(e.target.files);
    }
    if (e.target) e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      processImageFiles(imageFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const startRecording = async () => {
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        if (!groqApiKey) {
          showToast('Для использования распознавания речи введите API токен Groq в Настройках!', 'info');
          return;
        }

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            try {
              const text = await api.transcribe_audio(base64Audio, groqApiKey);
              if (text) {
                setInputText((prev) => (prev ? `${prev} ${text}` : text));
              }
            } catch (err: any) {
              showToast(`Ошибка распознавания: ${err.message || err}`, 'error');
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (err: any) {
          setIsTranscribing(false);
          showToast(`Ошибка записи: ${err.message || err}`, 'error');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      showToast('Не удалось получить доступ к микрофону.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Stop recording error:', err);
      }
      setIsRecording(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && attachedImages.length === 0) return;
    isUserScrolledUpRef.current = false;
    onSendMessage(inputText.trim(), attachedImages.length > 0 ? [...attachedImages] : undefined);
    setInputText('');
    setAttachedImages([]);
  };

  const hasMessages = messages && messages.length > 0;

  const renderAttachedImagesPreview = () => {
    if (attachedImages.length === 0) return null;
    return (
      <div className="flex items-center gap-2.5 p-2 bg-slate-950/80 border border-white/10 rounded-xl overflow-x-auto my-1.5 scrollbar-thin">
        {attachedImages.map((imgUrl, idx) => (
          <div key={idx} className="relative group shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-emerald-500/40 bg-slate-900 shadow-md">
            <img src={imgUrl} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
              className="absolute top-0.5 right-0.5 p-1 rounded-full bg-black/80 text-slate-300 hover:text-white hover:bg-rose-600 transition-colors"
              title="Удалить изображение"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderPlanningToggle = () => {
    if (!onTogglePlanningMode) return null;
    return (
      <div className="flex items-center justify-center pt-2 select-none">
        <label
          onClick={onTogglePlanningMode}
          className="flex items-center gap-2 text-xs text-slate-300 opacity-80 hover:opacity-100 cursor-pointer transition-opacity"
        >
          <div
            className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
              planningMode ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-md" />
          </div>
          <span className="font-medium text-[11px]">
            Режим планирования:{' '}
            <strong className={planningMode ? 'text-emerald-400' : 'text-slate-400'}>
              {planningMode ? 'ВКЛ' : 'ВЫКЛ'}
            </strong>
          </span>
        </label>
      </div>
    );
  };

  const renderStreamingBanner = () => {
    if (agentStatus !== 'thinking' && agentStatus !== 'executing_tool') return null;
    return (
      <div className="self-start w-full max-w-full my-2 p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs text-slate-200 shadow-md space-y-2 font-sans">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <RefreshCw size={13} className="animate-spin text-emerald-400" />
            <span>
              {agentStatus === 'thinking' ? 'Агент генерирует ответ...' : 'Агент выполняет инструмент...'}
            </span>
          </div>
          {liveTelemetry?.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30 animate-pulse flex items-center gap-1">
              <Zap size={11} />
              <span>{liveTelemetry.tokensPerSec} t/s</span>
            </span>
          )}
        </div>

        {liveTelemetry?.contextUsed !== undefined && (
          <div className="space-y-1 pt-1 font-mono text-[11px] text-slate-400 border-t border-white/5">
            <div className="flex justify-between items-center">
              <span>Заполнение контекста: <strong className="text-slate-200">{liveTelemetry.contextUsed.toLocaleString()}</strong> / {liveTelemetry.contextMax?.toLocaleString()} tok</span>
              <span className="text-blue-300 font-semibold">
                {((liveTelemetry.contextUsed / (liveTelemetry.contextMax || 8192)) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
              <div
                className="bg-emerald-400 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (liveTelemetry.contextUsed / (liveTelemetry.contextMax || 8192)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSummarizingBanner = () => {
    if (!isSummarizing) return null;
    return (
      <div className="mx-4 my-2 p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 shadow-xl shadow-cyan-950/40 text-xs text-slate-100 flex flex-col gap-2 font-mono relative overflow-hidden backdrop-blur-md animate-pulse">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-emerald-400 to-purple-500" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-400 animate-spin" />
            <span className="font-bold text-cyan-300 tracking-wider">ФОНОВОЕ СЖАТИЕ КОНТЕКСТА...</span>
          </div>

          {summarizeMetrics.oldTokens !== undefined && (
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold">
              [{summarizeMetrics.oldTokens.toLocaleString()} → {summarizeMetrics.newTokens ? summarizeMetrics.newTokens.toLocaleString() : '...'} tok]
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-300 font-sans flex items-center justify-between">
          <span>{summarizePhase}</span>
          <span className="text-cyan-400 font-mono font-bold">{summarizePercent}%</span>
        </div>

        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-cyan-500/30 p-0.5">
          <div
            className="bg-gradient-to-r from-cyan-500 via-emerald-400 to-purple-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${summarizePercent}%` }}
          />
        </div>
      </div>
    );
  };

  const renderServerOfflineBanner = () => {
    if (!isServerOffline) return null;
    return (
      <div className="mx-auto my-3 w-full max-w-xl p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3 shadow-xl font-sans backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <AlertCircle size={16} className="text-rose-400 shrink-0 animate-pulse" />
          <span className="font-semibold text-slate-100">Локальный ИИ-сервер llama.cpp не запущен</span>
        </div>
        {onStartServer && (
          <button
            type="button"
            onClick={onStartServer}
            className="flat-btn px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 font-semibold cursor-pointer flex items-center gap-1.5 text-xs transition-all shrink-0 shadow-md"
          >
            <Play size={13} />
            <span>Запустить сервер</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-full bg-[#0b0c10] overflow-hidden relative select-text"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center border-2 border-dashed border-emerald-400/80 rounded-2xl m-3 select-none animate-pulse">
          <ImageIcon size={48} className="text-emerald-400 mb-3" />
          <div className="text-base font-bold text-slate-100">Перетащите изображения сюда</div>
          <div className="text-xs text-slate-400 mt-1">Изображения будут отправлены локальной ИИ-модели для анализа</div>
        </div>
      )}

      {/* Hidden File Input for Image Attachments */}
      <input
        type="file"
        ref={imageFileInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* 1. EMPTY CHAT WELCOME HERO VIEW */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center z-10 w-full max-w-3xl mx-auto my-auto font-sans">
          
          {/* Top Center Workspace Selector Dropdown */}
          <div className="mb-8">
            <button
              type="button"
              onClick={onSelectWorkspace}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 text-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Folder size={14} className="text-emerald-400" />
              <span>{getWorkspaceBaseName(workspaceDir)}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
          </div>

          {renderServerOfflineBanner()}
          {renderSummarizingBanner()}

          {/* Floating Hero Card Prompt Box */}
          <div className="w-full max-w-2xl bg-[#14151c]/90 border border-white/12 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
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
                rows={2}
                placeholder="Задайте вопрос, вставьте картинку (Ctrl+V) или перетащите файл..."
                className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs sm:text-sm resize-none font-sans"
              />

              {/* Bottom bar inside hero input card */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                
                {/* Left side actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-colors cursor-pointer"
                    title="Загрузить изображение для анализа моделью"
                  >
                    <ImageIcon size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={onSelectWorkspace}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Прикрепить файл / контекст (@)"
                  >
                    <Plus size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={onOpenModelPicker}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/10 hover:border-white/20 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <Cpu size={13} className="text-emerald-400" />
                    <span className="truncate max-w-[170px] font-mono text-[11px]">
                      {modelName || 'Local LLM Server'}
                    </span>
                    <Eye size={12} className="text-slate-400 ml-0.5" />
                    <ChevronDown size={12} className="text-slate-400" />
                  </button>
                </div>

                {/* Right side microphone recording & submit */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMicClick}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      isRecording
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Голосовой ввод"
                  >
                    {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  </button>

                  {(inputText.trim() || attachedImages.length > 0) && (
                    <button
                      type="submit"
                      disabled={isTranscribing}
                      className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md cursor-pointer"
                    >
                      <Send size={15} />
                    </button>
                  )}
                </div>
              </div>
            </form>
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
                    <div className="self-end max-w-[85%] rounded-xl glass-card border border-[var(--theme-accent)]/30 bg-[var(--theme-card-bg)] px-4 py-2.5 text-theme-text text-xs sm:text-sm leading-relaxed font-sans select-text shadow-md flex flex-col gap-2">
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
                    let thinkText = "";
                    let bodyText = textOutput;

                    if (textOutput) {
                      const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
                      const match = textOutput.match(thinkRegex);
                      if (match) {
                        thinkText = match[1].trim();
                        bodyText = textOutput.replace(thinkRegex, "").trim();
                      } else if (textOutput.includes("<think>")) {
                        const startIdx = textOutput.indexOf("<think>");
                        thinkText = textOutput.substring(startIdx + 7).trim();
                        bodyText = textOutput.substring(0, startIdx).trim();
                      }
                    }

                    return (
                      <div className="self-start max-w-[95%] w-full rounded-md glass-panel border border-white/10 p-4 text-slate-100 text-xs sm:text-sm leading-relaxed my-1.5 select-text">
                        {reasoningEnabled && thinkText && (
                          <details open className="mb-3 border border-white/10 rounded bg-slate-950/40 overflow-hidden group">
                            <summary className="px-3 py-1.5 text-[11px] font-medium text-slate-300 select-none cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between font-sans">
                              <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
                                <Sparkles size={12} className="text-purple-400" />
                                Ход мыслей локальной модели
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

          {/* INPUT FORM CONTAINER */}
          <div className="p-3 border-t border-white/10 glass-panel select-none z-10 w-full flex flex-col gap-2">
            {renderAttachedImagesPreview()}

            <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto flex items-center justify-center gap-2">
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Задайте вопрос, вставьте картинку (Ctrl+V) или перетащите файл..."
                  className="w-full pl-4 pr-16 py-2.5 rounded-lg flat-input text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />

                <div className="absolute right-2.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="p-1 rounded text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Прикрепить изображение"
                  >
                    <ImageIcon size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={handleMicClick}
                    className={`p-1 rounded transition-colors ${
                      isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Голосовой ввод"
                  >
                    {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  </button>
                </div>
              </div>

              {agentStatus !== 'idle' && onCancelAgent ? (
                <button
                  type="button"
                  onClick={onCancelAgent}
                  className="flat-btn rounded-md px-3.5 py-2.5 text-xs font-semibold text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Square size={13} />
                  <span>Стоп</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={(!inputText.trim() && attachedImages.length === 0) || isTranscribing}
                  className="flat-btn rounded-md px-4 py-2.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 cursor-pointer border-emerald-500/30"
                >
                  <Send size={14} />
                </button>
              )}
            </form>

            {renderPlanningToggle()}
          </div>
        </div>
      )}

    </div>
  );
};
