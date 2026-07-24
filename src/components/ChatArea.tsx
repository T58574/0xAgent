import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, Brain, Terminal, Sparkles, RefreshCw, AlertTriangle, Play, Zap, Cpu, ClipboardList } from 'lucide-react';
import { ChatMessage, LiveTelemetry } from '../types';
import { cleanContent } from '../utils/helpers';
import { ToolCard } from './ToolCard';
import { NotionMarkdown } from './NotionMarkdown';
import * as api from '../services/api';

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
  onOpenMemorySkills?: () => void;
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
  onOpenMemorySkills,
}) => {
  const [inputText, setInputText] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);
  const mainHistoryRef = useRef<HTMLDivElement>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Server health state for 1-click launch banner
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverHost] = useState('127.0.0.1');
  const [serverPort] = useState(11434);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus, liveTelemetry]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const h = await api.get_server_health(serverHost, serverPort);
        setIsServerOffline(!h.ok);
      } catch {
        setIsServerOffline(true);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 3000);

    const unlisten = api.listen<{ status: string }>('llama-server-status', (event) => {
      if (event.payload.status === 'running') {
        setIsServerOffline(false);
      } else if (event.payload.status === 'stopped') {
        setIsServerOffline(true);
      }
    });

    return () => {
      clearInterval(interval);
      unlisten();
    };
  }, [serverHost, serverPort]);

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
          alert('Для использования распознавания речи введите API токен Groq в Настройках!');
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
              alert(`Ошибка распознавания: ${err.message || err}`);
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (err: any) {
          setIsTranscribing(false);
          alert(`Ошибка записи: ${err.message || err}`);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Не удалось получить доступ к микрофону.');
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

  const handleStartServerDirectly = async (autoSendPrompt?: string) => {
    setIsStartingServer(true);
    const textToSend = autoSendPrompt || inputText.trim();
    try {
      const res = await api.start_local_server();
      if (res && res.success) {
        let serverReady = false;
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const h = await api.get_server_health(serverHost, serverPort);
          if (h.ok) {
            serverReady = true;
            setIsServerOffline(false);
            break;
          }
        }
        if (serverReady && textToSend) {
          onSendMessage(textToSend);
          setInputText('');
        }
      }
    } catch (err: any) {
      alert(`Ошибка запуска сервера llama.cpp:\n${err.message || err}`);
    } finally {
      setIsStartingServer(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (isServerOffline) {
      handleStartServerDirectly(inputText.trim());
      return;
    }

    onSendMessage(inputText.trim());
    setInputText('');
  };

  const hasMessages = messages && messages.length > 0;

  const renderWarningBanner = () => {
    if (!isServerOffline) return null;
    return (
      <div className="mx-4 my-2 p-3 rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg z-20">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 animate-pulse" />
          <div>
            <span className="font-semibold text-slate-100">Локальный сервер llama.cpp не запущен!</span>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Для отправки сообщений запустите сервер в 1-клик или загрузите модель в Настройках.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleStartServerDirectly()}
          disabled={isStartingServer}
          className="flat-btn px-3.5 py-1.5 rounded-md text-xs font-semibold text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
        >
          {isStartingServer ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>Запуск...</span>
            </>
          ) : (
            <>
              <Play size={13} />
              <span>Запустить LLM в 1-клик</span>
            </>
          )}
        </button>
      </div>
    );
  };

  const renderQuickControls = () => {
    if (!onTogglePlanningMode && !onOpenMemorySkills) return null;
    return (
      <div className="flex items-center gap-2 mb-2">
        {onTogglePlanningMode && (
          <button
            type="button"
            onClick={onTogglePlanningMode}
            className={`flat-btn px-2.5 py-1 rounded text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors ${
              planningMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm font-semibold'
                : 'text-slate-400 border-white/10 hover:text-slate-200'
            }`}
            title={planningMode ? 'Режим Планирования активен' : 'Включить Режим Планирования'}
          >
            <ClipboardList size={13} className={planningMode ? 'text-purple-400' : 'text-slate-400'} />
            <span>{planningMode ? '📋 План: ВКЛ' : '📋 План: ВЫКЛ'}</span>
          </button>
        )}

        {onOpenMemorySkills && (
          <button
            type="button"
            onClick={onOpenMemorySkills}
            className="flat-btn px-2.5 py-1 rounded text-xs font-medium text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1.5"
            title="Долгосрочная память и скиллы"
          >
            <Brain size={13} />
            <span>🧠 Память & Скиллы</span>
          </button>
        )}
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

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-bg overflow-hidden relative select-text">
      
      {/* 1. EMPTY CHAT WELCOME VIEW */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center z-10 max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-xl">
            <Sparkles size={32} className="text-emerald-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            0xAgent AI Pair Programmer
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Введите вашу задачу или выберите локальную GGUF модель в Настройках для начала автономной написания кода.
          </p>

          {renderWarningBanner()}

          <div className="w-full mt-4">
            {renderQuickControls()}
            <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Что строим сегодня?.."
                  className="w-full px-4 py-3 rounded-lg flat-input text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none pr-10"
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
              <button
                type="submit"
                disabled={!inputText.trim() || isTranscribing}
                className="flat-btn rounded-lg px-5 py-3 text-xs font-medium text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
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

          {/* SERVER OFFLINE WARNING & 1-CLICK LAUNCH BANNER */}
          {renderWarningBanner()}

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
          </div>
        </div>
      )}

    </div>
  );
};
