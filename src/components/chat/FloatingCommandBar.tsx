import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Send, Square, Mic, MicOff, Terminal, Bot, Globe, Brain, Code, User } from 'lucide-react';
import { AppConfig, PersonaMetadata } from '../../types';
import { ModelSelectorDropdown } from '../ModelSelectorDropdown';

interface FloatingCommandBarProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onCancelAgent?: () => void;
  chatMode?: 'agent' | 'simple';
  planningMode: boolean;
  onTogglePlanningMode?: () => void;
  personas?: PersonaMetadata[];
  activePersonaId?: string;
  onSelectPersona?: (id: string) => void;
  attachedImages: string[];
  onAttachImages: (images: string[]) => void;
  onRemoveImage: (index: number) => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  isTranscribing?: boolean;
  onTriggerSlashCommand?: (command: string) => void;
  config?: AppConfig | null;
  onModelChanged?: (newModelId: string) => void;
}

interface SlashCommandItem {
  cmd: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  { cmd: '/goal', label: 'Автономная цель (/goal)', description: 'Глубокое решение задачи до полного результата', icon: <Bot size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/search', label: 'Поиск в сети (/search)', description: 'Быстрый поиск через SearXNG без затрат токенов', icon: <Globe size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/think', label: 'Режим рассуждений (/think)', description: 'Пошаговая цепочка рассуждений CoT', icon: <Brain size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/patch', label: 'Аудит и рефакторинг (/patch)', description: 'Создание безопасных diff-патчей в проекте', icon: <Code size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/clear', label: 'Очистить контекст (/clear)', description: 'Сбросить текущий буфер сообщений', icon: <Terminal size={14} className="text-[var(--theme-text-muted)]" /> },
];

export const FloatingCommandBar: React.FC<FloatingCommandBarProps> = ({
  inputText,
  setInputText,
  onSubmit,
  agentStatus,
  onCancelAgent,
  chatMode: _chatMode,
  planningMode,
  onTogglePlanningMode,
  personas = [],
  activePersonaId = 'default',
  onSelectPersona,
  attachedImages,
  onAttachImages,
  onRemoveImage,
  isRecording = false,
  onToggleRecording,
  isTranscribing = false,
  onTriggerSlashCommand,
  config,
  onModelChanged,
}) => {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentPersona = personas.find((p) => p.id === activePersonaId) || {
    id: 'default',
    name: '0xAgent',
    icon: 'smart_toy',
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(180, Math.max(38, textareaRef.current.scrollHeight))}px`;
    }
  }, [inputText]);

  useEffect(() => {
    if (inputText.startsWith('/')) {
      const query = inputText.slice(1).toLowerCase();
      setSlashFilter(query);
      setShowSlashMenu(true);
      setSelectedSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  }, [inputText]);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false);
        setShowPersonaMenu(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  const filteredSlashCommands = SLASH_COMMANDS.filter(
    (c) => c.cmd.toLowerCase().includes(slashFilter) || c.label.toLowerCase().includes(slashFilter)
  );

  const handleSelectSlash = (item: SlashCommandItem) => {
    setInputText(`${item.cmd} `);
    setShowSlashMenu(false);
    if (onTriggerSlashCommand) {
      onTriggerSlashCommand(item.cmd);
    }
    textareaRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            onAttachImages([...attachedImages, event.target.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSlash(filteredSlashCommands[selectedSlashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const isBusy = agentStatus === 'thinking' || agentStatus === 'executing_tool';

  return (
    <div className="relative w-full max-w-3xl mx-auto select-none" ref={menuRef}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Slash Commands Dropdown */}
      {showSlashMenu && filteredSlashCommands.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 w-full bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn">
          <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--theme-border)]/50 mb-1">
            <span>Команды</span>
            <span>Tab / ↵ для выбора</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredSlashCommands.map((item, idx) => (
              <button
                key={item.cmd}
                type="button"
                onClick={() => handleSelectSlash(item)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  idx === selectedSlashIndex
                    ? 'bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md bg-black/40 text-[var(--theme-text-muted)]">{item.icon}</div>
                  <div>
                    <div className="font-medium text-xs text-[var(--theme-text)]">{item.label}</div>
                    <div className="text-[11px] text-[var(--theme-text-muted)]">{item.description}</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[var(--theme-text-muted)]">{item.cmd}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persona Selector Popover */}
      {showPersonaMenu && personas.length > 0 && (
        <div className="absolute bottom-full mb-2 left-4 w-60 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn">
          <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)]/50 mb-1">
            Персона
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (onSelectPersona) onSelectPersona(p.id);
                  setShowPersonaMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  p.id === activePersonaId
                    ? 'bg-white/10 text-[var(--theme-text)] font-semibold border border-[var(--theme-border)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
                }`}
              >
                <User size={13} className="text-[var(--theme-text-muted)]" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attached Images Previews */}
      {attachedImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-2">
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-[var(--theme-border)] shadow-md">
              <img src={img} alt="attached preview" className="w-14 h-14 object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(idx)}
                className="absolute top-1 right-1 p-0.5 rounded-md bg-black/80 text-white hover:bg-white/20 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Floating Glass Container */}
      <form onSubmit={onSubmit}>
        <div className="bento-card p-2.5 bg-[var(--theme-panel)]/95 backdrop-blur-xl border border-[var(--theme-border)] focus-within:border-[var(--theme-border)] focus-within:ring-1 focus-within:ring-[var(--theme-border)] transition-all flex flex-col gap-1.5">
          
          {/* Top Row: Attachment + Full-width Textarea */}
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 mt-0.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              title="Прикрепить файл"
            >
              <Plus size={16} />
            </button>

            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Опишите задачу или введите / для спец-команд..."
              className="w-full bg-transparent text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] text-xs focus:outline-none resize-none min-h-[36px] max-h-[160px] py-1 leading-relaxed font-sans"
            />
          </div>

          {/* Bottom Action Controls: Chips, Toggles & Send */}
          <div className="flex items-center justify-between pt-1.5 border-t border-[var(--theme-border)] text-xs">
            
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Persona Selector Chip */}
              {personas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-[var(--theme-border)] text-xs font-mono transition-all cursor-pointer shrink-0"
                  title="Сменить персону"
                >
                  <User size={12} />
                  <span className="max-w-[85px] truncate">{currentPersona.name}</span>
                </button>
              )}

              {/* Model Selector Dropdown Chip */}
              <ModelSelectorDropdown
                config={config || null}
                onModelChanged={onModelChanged}
                direction="up"
                compact={true}
              />

              {onTogglePlanningMode && (
                <button
                  type="button"
                  onClick={onTogglePlanningMode}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono transition-all cursor-pointer ${
                    planningMode
                      ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)]'
                      : 'bg-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-transparent'
                  }`}
                  title="Включить режим рассуждений / планирования"
                >
                  <Brain size={12} />
                  <span>Размышление</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setInputText('/');
                  setShowSlashMenu(true);
                  textareaRef.current?.focus();
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer"
                title="Открыть меню команд"
              >
                <span>/</span>
                <span>Команды</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {onToggleRecording && (
                <button
                  type="button"
                  onClick={onToggleRecording}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRecording
                      ? 'bg-white/20 text-[var(--theme-text)] animate-pulse'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                  }`}
                  title="Голосовой ввод"
                >
                  {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}

              {isBusy && onCancelAgent ? (
                <button
                  type="button"
                  onClick={onCancelAgent}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[var(--theme-text)] font-medium flex items-center gap-1 text-xs transition-colors cursor-pointer shrink-0 border border-[var(--theme-border)]"
                  title="Остановить генерацию"
                >
                  <Square size={12} fill="currentColor" />
                  <span>Стоп</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={(!inputText.trim() && attachedImages.length === 0) || isTranscribing}
                  className="p-1.5 rounded-lg bento-card hover:bg-white/15 text-[var(--theme-text)] flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                  title="Отправить (Enter)"
                >
                  <Send size={14} />
                </button>
              )}
            </div>

          </div>

        </div>
      </form>
    </div>
  );
};
