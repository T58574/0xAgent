import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { cleanContent } from '../utils/helpers';
import { ToolCard } from './ToolCard';

interface ChatAreaProps {
  messages: ChatMessage[];
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onSendMessage: (text: string) => void;
  onRespondToTool: (toolId: string, approve: boolean) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  agentStatus,
  onSendMessage,
  onRespondToTool,
}) => {
  const [inputText, setInputText] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);
  const mainHistoryRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of history on new messages
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus]);

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
    <div className="flex-grow flex flex-col relative h-full overflow-hidden bg-theme-bg select-text w-full text-theme-text">
      
      {/* 1. INITIAL CENTERED VIEW */}
      {!hasMessages && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center select-none z-10 w-full">
          <form onSubmit={handleSubmit} className="w-full max-w-2xl flex items-center justify-center gap-4">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напиши ченибудь..."
              className="w-full max-w-lg border border-theme-border rounded-full px-6 py-3 text-sm text-theme-text placeholder-neutral-450 bg-theme-bg focus:outline-none focus:border-theme-text transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
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
                    {msg.role === 'assistant' && (
                      <div className="self-start max-w-[90%] w-full rounded-2xl border border-theme-border p-6 bg-theme-bg text-theme-text text-sm leading-relaxed shadow-sm my-2">
                        {textOutput && (
                          <div className="whitespace-pre-wrap font-sans prose max-w-none text-theme-text">
                            {textOutput}
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
                    )}
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
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Создай скрипт на питоне"
                className="w-full max-w-lg border border-theme-border rounded-full px-6 py-3 text-sm text-theme-text placeholder-neutral-450 bg-theme-bg focus:outline-none focus:border-theme-text transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="rounded-full border border-theme-border bg-theme-send-btn px-8 py-3 text-sm font-bold text-black hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors focus:outline-none"
              >
                Отправить
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  );
};
