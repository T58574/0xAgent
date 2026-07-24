import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, Brain, Terminal, Sparkles, RefreshCw, AlertTriangle, Play } from 'lucide-react';
import { ChatMessage } from '../types';
import { cleanContent } from '../utils/helpers';
import { ToolCard } from './ToolCard';
import * as api from '../services/api';

interface ChatAreaProps {
  messages: ChatMessage[];
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onSendMessage: (text: string) => void;
  onRespondToTool: (toolId: string, approve: boolean | string) => void;
  onCancelAgent?: () => void;
  reasoningEnabled?: boolean;
  groqApiKey?: string | null;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  agentStatus,
  onSendMessage,
  onRespondToTool,
  onCancelAgent,
  reasoningEnabled = true,
  groqApiKey,
}) => {
  const [inputText, setInputText] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);
  const mainHistoryRef = useRef<HTMLDivElement>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Server health state for 1-click launch banner
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverHost] = useState('127.0.0.1');
  const [serverPort] = useState(11434);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus]);

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

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const hasMessages = messages.length > 0;

  const renderWarningBanner = () => {
    if (!isServerOffline) return null;
    return (
      <div className="w-full max-w-3xl mx-auto px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-lg animate-fadeIn mb-3 select-none">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-amber-200">
              ⚠️ Локальный LLM Сервер не запущен на порту {serverPort}!
            </span>
            <div className="text-[11px] text-slate-300">
              Модель не сможет ответить, пока локальный сервер остановлен.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleStartServerDirectly()}
          disabled={isStartingServer}
          className="flat-btn px-3.5 py-1.5 rounded text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shrink-0 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {isStartingServer ? <RefreshCw size={12} className="animate-spin text-emerald-400" /> : <Play size={12} />}
          <span>{isStartingServer ? 'Запуск сервера...' : '🚀 Запустить LLM Сервер в 1-клик'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex-grow flex flex-col relative overflow-hidden bg-scifi-grid select-text w-full text-slate-100 font-sans">
      
      {/* 1. INITIAL CENTERED HERO VIEW */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center select-none z-10 w-full max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <Sparkles size={24} />
          </div>
          <h1 className="text-xl font-semibold text-white mb-1.5 tracking-tight">
            0xAgent Local Workspace
          </h1>
          <p className="text-xs text-slate-400 mb-6 max-w-md font-normal leading-relaxed">
            Автономный разработчик. Работает локально с файлами и инструментами.
          </p>

          {renderWarningBanner()}

          <form onSubmit={handleSubmit} className="w-full flex items-center justify-center gap-2">
            <div className="relative w-full">
              <input
                type="text"
                value={inputText}
                disabled={isTranscribing}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTranscribing ? "Расшифровываем голос через Groq Whisper..." : "Что нужно сделать с проектом?"}
                className="w-full flat-input rounded-md pl-4 pr-10 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isTranscribing}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded transition-all cursor-pointer flex items-center justify-center z-10 ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={isRecording ? `Запись: ${recordingSeconds} сек.` : "Голосовой ввод"}
              >
                {isTranscribing ? <RefreshCw size={15} className="animate-spin text-sky-400" /> : <Mic size={15} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isTranscribing}
              className="flat-btn rounded-md px-4 py-2.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 cursor-pointer border-emerald-500/30"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* 2. MAIN CHAT HISTORY LIST */}
      {hasMessages && (
        <div className="flex-grow flex flex-col justify-between overflow-hidden relative w-full max-w-4xl mx-auto">
          
          <div
            ref={mainHistoryRef}
            className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-none flex flex-col min-h-0"
          >
            {messages.map((msg) => {
              const textOutput = cleanContent(msg.content);
              return (
                <div key={msg.id} className="flex flex-col space-y-1 w-full">
                  {msg.role === 'user' && (
                    <div className="self-end max-w-[85%] rounded-md glass-card border border-emerald-500/30 bg-slate-900/80 px-4 py-2.5 text-slate-100 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans">
                      {msg.content}
                    </div>
                  )}

                  {msg.role === 'tool' && (
                    <div className="self-start max-w-[95%] w-full rounded-md glass-card border border-white/10 p-3 bg-slate-950/80 text-slate-300 font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap my-1">
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
                      <div className="self-start max-w-[95%] w-full rounded-md glass-panel border border-white/10 p-4 text-slate-100 text-xs sm:text-sm leading-relaxed my-1.5">
                        {reasoningEnabled && thinkText && (
                          <details open className="mb-3 border border-white/10 rounded bg-slate-950/40 overflow-hidden group">
                            <summary className="px-3 py-1.5 text-[11px] font-medium text-slate-300 select-none cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between font-sans">
                              <span className="flex items-center gap-1.5">
                                <Brain size={12} className="text-emerald-400" />
                                <span>Ход мыслей (Reasoning)</span>
                              </span>
                            </summary>
                            <div className="px-3 py-2.5 border-t border-white/5 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {thinkText}
                            </div>
                          </details>
                        )}

                        {bodyText && (
                          <div className="whitespace-pre-wrap font-sans max-w-none text-slate-100 leading-relaxed">
                            {bodyText}
                          </div>
                        )}

                        {msg.tool_calls && msg.tool_calls.map((tool) => (
                          <ToolCard 
                            key={tool.id} 
                            tool={tool} 
                            onRespond={onRespondToTool} 
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {(agentStatus === 'thinking' || agentStatus === 'executing_tool') && (
              <div className="self-start flex items-center gap-2 py-1.5 px-3 rounded bg-slate-900/60 border border-white/10 text-xs text-slate-300 font-medium">
                <RefreshCw size={13} className="animate-spin text-emerald-400" />
                <span>
                  {agentStatus === 'thinking' ? 'Агент размышляет и формирует ответ...' : 'Агент выполняет инструмент...'}
                </span>
              </div>
            )}

            <div ref={historyEndRef} />
          </div>

          {/* SERVER OFFLINE WARNING & 1-CLICK LAUNCH BANNER */}
          {renderWarningBanner()}

          {/* INPUT FORM CONTAINER */}
          <div className="p-3 border-t border-white/10 glass-panel select-none z-10 w-full">
            <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto flex items-center justify-center gap-2">
              <div className="relative w-full">
                <input
                  type="text"
                  value={inputText}
                  disabled={agentStatus !== 'idle' || isTranscribing}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isTranscribing 
                      ? "Расшифровываем голос через Groq Whisper..." 
                      : agentStatus !== 'idle' 
                        ? "Агент выполняет задачу..." 
                        : "Напиши задачу..."
                  }
                  className="w-full flat-input rounded-md pl-4 pr-10 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={agentStatus !== 'idle' || isTranscribing}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded transition-all cursor-pointer flex items-center justify-center z-10 ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30'
                  }`}
                  title={isRecording ? `Запись: ${recordingSeconds} сек.` : "Голосовой ввод"}
                >
                  {isTranscribing ? <RefreshCw size={15} className="animate-spin text-sky-400" /> : <Mic size={15} />}
                </button>
              </div>

              {agentStatus !== 'idle' ? (
                <button
                  type="button"
                  onClick={onCancelAgent}
                  className="flat-btn rounded-md border-rose-500/40 text-rose-400 hover:text-rose-300 px-4 py-2.5 text-xs font-medium cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Square size={12} className="fill-rose-400" />
                  <span>Стоп</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTranscribing}
                  className="flat-btn rounded-md px-4 py-2.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 cursor-pointer border-emerald-500/30"
                >
                  <Send size={13} />
                </button>
              )}
            </form>
          </div>

        </div>
      )}

    </div>
  );
};
