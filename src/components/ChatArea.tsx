import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, Brain, Terminal, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';
import { cleanContent } from '../utils/helpers';
import { ToolCard } from './ToolCard';

interface ChatAreaProps {
  messages: ChatMessage[];
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onSendMessage: (text: string) => void;
  onRespondToTool: (toolId: string, approve: boolean) => void;
  onCancelAgent?: () => void;
  reasoningEnabled?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  agentStatus,
  onSendMessage,
  onRespondToTool,
  onCancelAgent,
  reasoningEnabled = true,
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

  // Auto-scroll to bottom of history on new messages
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus]);

  // Recording timer
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

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const options = { mimeType };
      const recorder = new MediaRecorder(stream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Payload = base64data.split(',')[1];
          if (base64Payload) {
            try {
              const transcribedText = '';
              if (transcribedText.trim()) {
                setInputText((prev) => {
                  const spacer = prev.trim() ? ' ' : '';
                  return prev + spacer + transcribedText;
                });
              }
            } catch (err: any) {
              console.error("Transcription failed:", err);
            } finally {
              setIsTranscribing(false);
            }
          }
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-grow flex flex-col relative overflow-hidden bg-scifi-grid select-text w-full text-slate-100 font-sans">
      
      {/* 1. INITIAL CENTERED SCI-FI HERO VIEW */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center select-none z-10 w-full max-w-3xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.25)]">
            <Sparkles size={32} />
          </div>
          <h1 className="text-2xl font-hud uppercase tracking-wider font-bold text-white mb-2">
            0xAgent LOCAL WORKSPACE
          </h1>
          <p className="text-xs font-mono text-slate-400 mb-8 max-w-md">
            Быстрый автономный разработчик. Работает локально с файлами и PowerShell.
          </p>

          <form onSubmit={handleSubmit} className="w-full flex items-center justify-center gap-3">
            <div className="relative w-full">
              <input
                type="text"
                value={inputText}
                disabled={isTranscribing}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTranscribing ? "Транскрибируем голос..." : "Что нужно сделать с проектом?"}
                className="w-full skeuo-input rounded-2xl pl-5 pr-12 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isTranscribing}
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center z-10 ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={isRecording ? `Запись: ${recordingSeconds} сек.` : "Голосовой ввод"}
              >
                <Mic size={16} />
              </button>
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isTranscribing}
              className="skeuo-btn px-6 py-3.5 rounded-2xl text-xs font-hud font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-2 cursor-pointer border-emerald-500/30"
            >
              <span>Отправить</span>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* 2. ACTIVE CHAT TIMELINE VIEW */}
      {hasMessages && (
        <div className="flex-grow flex flex-col min-h-0 z-10 w-full">
          
          {/* Main Message History List */}
          <div 
            ref={mainHistoryRef}
            className="flex-grow overflow-y-auto px-4 md:px-8 py-6 space-y-6 scrollbar-none"
          >
            <div className="max-w-3xl mx-auto space-y-6 flex flex-col">
              {messages.map((msg) => {
                const textOutput = cleanContent(msg.content);
                const hasTools = msg.tool_calls && msg.tool_calls.length > 0;
                
                if (msg.role === 'assistant' && !textOutput && !hasTools) {
                  return null;
                }

                return (
                  <div key={msg.id} className="flex flex-col message-enter">
                    {/* User Prompt Bubble */}
                    {msg.role === 'user' && (
                      <div className="self-end max-w-[85%] rounded-2xl glass-card border border-indigo-500/30 bg-slate-900/80 px-5 py-3 text-slate-100 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-lg font-sans">
                        {msg.content}
                      </div>
                    )}

                    {/* Tool Log Output Bubble */}
                    {msg.role === 'tool' && (
                      <div className="self-start max-w-[95%] w-full rounded-2xl glass-card border border-white/10 p-3.5 bg-slate-950/80 text-slate-300 font-mono text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap my-1.5 shadow-inner">
                        <div className="text-[9px] font-hud text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Terminal size={10} />
                          <span>TOOL OUTPUT RESPONSE</span>
                        </div>
                        {msg.content}
                      </div>
                    )}

                    {/* Assistant Message Panel */}
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
                        <div className="self-start max-w-[95%] w-full rounded-2xl glass-panel border border-white/10 p-5 text-slate-100 text-xs sm:text-sm leading-relaxed shadow-2xl my-2">
                          {reasoningEnabled && thinkText && (
                            <details open className="mb-4 border border-indigo-500/20 rounded-xl bg-slate-900/60 overflow-hidden group">
                              <summary className="px-4 py-2 font-hud text-[10px] text-indigo-300 select-none cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between uppercase tracking-wider">
                                <span className="flex items-center gap-1.5 font-bold">
                                  <Brain size={12} className="text-indigo-400" />
                                  <span>[ REASONING LOG ]</span>
                                </span>
                              </summary>
                              <div className="px-4 py-3 border-t border-white/5 bg-slate-950/40 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
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

              {/* Sci-Fi Status Chip for Running/Thinking */}
              {(agentStatus === 'thinking' || agentStatus === 'executing_tool') && (
                <div className="self-start flex items-center gap-2 py-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                  <span className="scifi-chip animate-pulse">
                    {agentStatus === 'thinking' ? '[ SYS.THINKING... ]' : '[ EXEC.TOOL_ACTION... ]'}
                  </span>
                </div>
              )}

              <div ref={historyEndRef} />
            </div>
          </div>

          {/* Locked Bottom Sci-Fi Prompt Bar */}
          <div className="p-3 md:p-4 border-t border-white/10 glass-panel select-none z-10 w-full">
            <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto flex items-center justify-center gap-3">
              <div className="relative w-full">
                <input
                  type="text"
                  value={inputText}
                  disabled={agentStatus !== 'idle' || isTranscribing}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isTranscribing 
                      ? "Транскрибируем голос..." 
                      : agentStatus !== 'idle' 
                        ? "Агент выполняет задачи..." 
                        : "Напиши инструкцию или задачу..."
                  }
                  className="w-full skeuo-input rounded-2xl pl-5 pr-12 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={agentStatus !== 'idle' || isTranscribing}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center z-10 ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30'
                  }`}
                  title={isRecording ? `Запись: ${recordingSeconds} сек.` : "Голосовой ввод"}
                >
                  <Mic size={15} />
                </button>
              </div>

              {agentStatus !== 'idle' ? (
                <button
                  type="button"
                  onClick={onCancelAgent}
                  className="skeuo-btn rounded-2xl border-rose-500/40 text-rose-400 hover:text-rose-300 px-5 py-3 text-xs font-hud uppercase tracking-wider font-bold cursor-pointer shrink-0 transition-colors flex items-center gap-1.5"
                >
                  <Square size={13} className="fill-rose-400" />
                  <span>Стоп</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTranscribing}
                  className="skeuo-btn rounded-2xl px-6 py-3 text-xs font-hud font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors flex items-center gap-2 cursor-pointer border-emerald-500/30"
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
