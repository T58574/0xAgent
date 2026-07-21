import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square } from 'lucide-react';
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
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
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
            setIsTranscribing(true);
            try {
              const transcribedText = await import('@tauri-apps/api/core').then(m => 
                m.invoke<string>('transcribe_audio', { audioBase64: base64Payload })
              );
              if (transcribedText.trim()) {
                setInputText((prev) => {
                  const spacer = prev.trim() ? ' ' : '';
                  return prev + spacer + transcribedText;
                });
              }
            } catch (err: any) {
              console.error("Transcription failed:", err);
              alert("Ошибка транскрибации голоса через Groq:\n" + err.toString());
            } finally {
              setIsTranscribing(false);
            }
          }
        };
        // Stop audio tracks to release microphone lock
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      alert("Не удалось включить микрофон:\n" + err.toString() + "\n\nПожалуйста, проверьте:\n1. Подключен ли микрофон к компьютеру.\n2. Разрешен ли доступ к микрофону в настройках конфиденциальности Windows.\n3. Добавлен ли Groq API Key в настройках приложения для распознавания.");
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
    <div className="flex-grow flex flex-col relative overflow-hidden bg-theme-bg select-text w-full text-theme-text">
      
      {/* 1. INITIAL CENTERED VIEW */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center select-none z-10 w-full">
          <form onSubmit={handleSubmit} className="w-full max-w-2xl flex items-center justify-center gap-4">
            <div className="relative w-full max-w-lg">
              <input
                type="text"
                value={inputText}
                disabled={isTranscribing}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTranscribing ? "Транскрибируем голос..." : "Напиши ченибудь..."}
                className="w-full border border-theme-border rounded-full pl-6 pr-12 py-3 text-sm text-theme-text placeholder-neutral-450 bg-theme-bg focus:outline-none focus:border-theme-text transition-colors"
              />
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isTranscribing}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center z-10 hover:scale-110 active:scale-95 duration-150 ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-neutral-500 hover:text-theme-text'
                }`}
                title={isRecording ? `Запись: ${recordingSeconds} сек. Кликни чтобы остановить.` : "Голосовой ввод"}
              >
                <Mic size={16} />
              </button>
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isTranscribing}
              className="rounded-full border border-theme-border bg-theme-send-btn px-8 py-3 text-sm font-bold text-black hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors focus:outline-none"
            >
              Отправить
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
            <div className="max-w-2xl mx-auto space-y-6 flex flex-col">
              {messages.map((msg) => {
                const textOutput = cleanContent(msg.content);
                const hasTools = msg.tool_calls && msg.tool_calls.length > 0;
                
                if (msg.role === 'assistant' && !textOutput && !hasTools) {
                  return null;
                }

                return (
                  <div key={msg.id} className="flex flex-col message-enter">
                    {/* User Prompt */}
                    {msg.role === 'user' && (
                      <div className="self-end max-w-[80%] rounded-full border border-theme-border px-6 py-2.5 bg-theme-bg text-theme-text text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                    )}

                    {/* Tool / System logs */}
                    {msg.role === 'tool' && (
                      <div className="self-start max-w-[90%] w-full rounded-2xl border border-theme-border p-4 bg-neutral-50 text-neutral-600 font-mono text-xs max-h-36 overflow-y-auto whitespace-pre-wrap my-2">
                        {msg.content}
                      </div>
                    )}

                    {/* Assistant message */}
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
                        <div className="self-start max-w-[90%] w-full rounded-2xl border border-theme-border p-6 bg-theme-bg text-theme-text text-sm leading-relaxed shadow-sm my-2">
                          {reasoningEnabled && thinkText && (
                            <details open className="mb-3 border border-theme-border rounded-xl bg-theme-active/30 overflow-hidden group">
                              <summary className="px-4 py-2 font-mono text-xs text-theme-text/75 select-none cursor-pointer hover:bg-theme-active transition-colors flex items-center justify-between">
                                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
                                  🧠 Ход мыслей (Reasoning)
                                </span>
                              </summary>
                              <div className="px-4 py-3 border-t border-theme-border bg-theme-active/10 font-sans text-xs text-theme-text/80 whitespace-pre-wrap leading-relaxed">
                                {thinkText}
                              </div>
                            </details>
                          )}

                          {bodyText && (
                            <div className="whitespace-pre-wrap font-sans prose max-w-none text-theme-text">
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

              {/* Thinking/Executing tool status */}
              {(agentStatus === 'thinking' || agentStatus === 'executing_tool') && (
                <div className="self-start flex items-center gap-2 py-2">
                  <div className="w-4 h-4 rounded-full border-2 border-theme-text border-t-transparent animate-spin" />
                  <span className="text-xs text-theme-text opacity-70 font-mono">
                    {agentStatus === 'thinking' ? '[ thinking... ]' : '[ executing tool... ]'}
                  </span>
                </div>
              )}

              <div ref={historyEndRef} />
            </div>
          </div>

          {/* Locked Bottom Prompt Form */}
          <div className="p-4 border-t border-theme-border bg-theme-bg select-none z-10 w-full">
            <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto flex items-center justify-center gap-4">
              <div className="relative w-full max-w-lg">
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
                        ? "Агент занят..." 
                        : "Создай скрипт на питоне"
                  }
                  className="w-full border border-theme-border rounded-full pl-6 pr-12 py-3 text-sm text-theme-text placeholder-neutral-450 bg-theme-bg focus:outline-none focus:border-theme-text transition-colors"
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={agentStatus !== 'idle' || isTranscribing}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center z-10 hover:scale-110 active:scale-95 duration-150 ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-neutral-500 hover:text-theme-text disabled:opacity-30'
                  }`}
                  title={isRecording ? `Запись: ${recordingSeconds} сек. Кликни чтобы остановить.` : "Голосовой ввод"}
                >
                  <Mic size={16} />
                </button>
              </div>

              {agentStatus !== 'idle' ? (
                <button
                  type="button"
                  onClick={onCancelAgent}
                  className="rounded-full border border-red-500 bg-red-50 hover:bg-red-100 text-red-600 px-8 py-3 text-sm font-bold cursor-pointer shrink-0 transition-colors focus:outline-none flex items-center gap-1.5"
                >
                  <Square size={12} className="fill-red-600" />
                  <span>Остановить</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTranscribing}
                  className="rounded-full border border-theme-border bg-theme-send-btn px-8 py-3 text-sm font-bold text-black hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors focus:outline-none"
                >
                  Отправить
                </button>
              )}
            </form>
          </div>

        </div>
      )}

    </div>
  );
};
