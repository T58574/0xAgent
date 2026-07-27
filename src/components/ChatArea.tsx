import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, Brain, Terminal, Sparkles, RefreshCw, Zap, Cpu } from 'lucide-react';
import { ChatMessage, LiveTelemetry } from '../types';
import { cleanContent } from '../utils/helpers';
import { ToolCard } from './ToolCard';
import { NotionMarkdown } from './NotionMarkdown';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface ChatAreaProps {
  messages: ChatMessage[];
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onSendMessage: (text: string) => void;
  onRespondToTool: (toolId: string, approve: boolean | string) => void;
  onCancelAgent?: () => void;
  reasoningEnabled?: boolean;
  groqApiKey?: string | null;
  liveTelemetry?: LiveTelemetry | null;
  planningMode?: boolean;
  onTogglePlanningMode?: () => void;
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
}) => {
  const { showToast } = useToast();
  const [inputText, setInputText] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);
  const mainHistoryRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus, liveTelemetry]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const hasMessages = messages && messages.length > 0;

  const renderPlanningToggle = () => {
    if (!onTogglePlanningMode) return null;
    return (
      <div className="flex items-center justify-center pt-2 select-none">
        <label
          onClick={onTogglePlanningMode}
          className="flex items-center gap-2 text-xs text-[var(--theme-text)] opacity-80 hover:opacity-100 cursor-pointer transition-opacity"
        >
          <div
            className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
              planningMode ? 'bg-[var(--theme-accent)] justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-md" />
          </div>
          <span className="font-medium text-[11px]">
            Режим планирования:{' '}
            <strong className={planningMode ? 'text-[var(--theme-accent)]' : 'text-slate-400'}>
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
      <div className="self-start w-full max-w-full my-2 p-3 rounded-lg bg-slate-900/90 border border-emerald-500/30 text-xs text-slate-200 shadow-md space-y-2 font-sans">
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

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-bg overflow-hidden relative select-text">
      
      {/* 1. EMPTY CHAT WELCOME VIEW (Centered hero prompt input) */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center z-10 w-full max-w-2xl mx-auto my-auto">
          {renderSummarizingBanner()}

          <div className="w-full space-y-3">
            <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Что строим сегодня?.."
                  className="w-full px-4 py-3.5 rounded-xl flat-input text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none pr-10 shadow-xl border border-white/10"
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`absolute right-3 top-3 p-1 rounded transition-colors ${
                    isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!inputText.trim() || isTranscribing}
                className="flat-btn rounded-xl px-5 py-3.5 text-xs font-medium text-[var(--theme-text)] border-[var(--theme-border)] hover:bg-white/10 cursor-pointer shadow-xl"
              >
                <Send size={16} />
              </button>
            </form>
            {renderPlanningToggle()}
          </div>
        </div>
      )}

      {/* 2. MAIN CHAT HISTORY LIST */}
      {hasMessages && (
        <div className="flex-grow flex flex-col justify-between overflow-hidden relative w-full max-w-4xl mx-auto select-text">
          
          <div
            ref={mainHistoryRef}
            className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-none flex flex-col min-h-0 select-text"
          >
            {messages.map((msg) => {
              const textOutput = cleanContent(msg.content);
              return (
                <div key={msg.id} className="flex flex-col space-y-1 w-full select-text">
                  {msg.role === 'user' && (
                    <div className="self-end max-w-[85%] rounded-md glass-card border border-emerald-500/30 bg-slate-900/80 px-4 py-2.5 text-slate-100 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans select-text">
                      {msg.content}
                    </div>
                  )}

                  {msg.role === 'tool' && (
                    <div className="self-start max-w-[95%] w-full rounded-md glass-card border border-white/10 p-3 bg-slate-950/80 text-slate-300 font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap my-1 select-text">
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1 flex items-center gap-1 font-sans">
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
            {(agentStatus === 'thinking' || agentStatus === 'executing_tool') && (
              <div className="self-start w-full max-w-full my-2 p-3 rounded-lg bg-slate-900/90 border border-emerald-500/30 text-xs text-slate-200 shadow-md space-y-2 font-sans">
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
            )}

            <div ref={historyEndRef} />
          </div>

          {/* STREAMING TELEMETRY BADGE */}
          {renderStreamingBanner()}

          {/* SUMMARIZING SCI-FI BANNER */}
          {renderSummarizingBanner()}

          {/* INPUT FORM CONTAINER */}
          <div className="p-3 border-t border-white/10 glass-panel select-none z-10 w-full">
            <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto flex items-center justify-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Задайте вопрос или опишите задачу..."
                  className="w-full px-4 py-2.5 rounded-lg flat-input text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`absolute right-2.5 top-2.5 p-1 rounded transition-colors ${
                    isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                </button>
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
                  disabled={!inputText.trim() || isTranscribing}
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
