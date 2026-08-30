import React from 'react';
import { Bot, Globe, Code, Terminal, Calendar, Compass, X } from 'lucide-react';

export interface SlashCommandItem {
  cmd: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export const DEFAULT_SLASH_COMMANDS: SlashCommandItem[] = [
  { cmd: '/goal', label: 'Автономная цель (/goal)', description: 'Глубокое решение задачи до полного результата', icon: <Bot size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/search', label: 'Поиск в сети (/search)', description: 'Быстрый поиск через SearXNG без затрат токенов', icon: <Globe size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/patch', label: 'Аудит и рефакторинг (/patch)', description: 'Создание безопасных diff-патчей в проекте', icon: <Code size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/clear', label: 'Очистить контекст (/clear)', description: 'Сбросить текущий буфер сообщений', icon: <Terminal size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/schedule', label: 'Таймер и планировщик (/schedule)', description: 'Установка таймера или регулярного cron-запуска', icon: <Calendar size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/browser', label: 'Веб-браузер (/browser)', description: 'Анализ веб-страниц и сбор документации', icon: <Compass size={14} className="text-[var(--theme-text-muted)]" /> },
];

interface SlashMenuPopoverProps {
  commands: SlashCommandItem[];
  selectedIndex: number;
  onSelectCommand: (item: SlashCommandItem) => void;
  onClose?: () => void;
}

export const SlashMenuPopover: React.FC<SlashMenuPopoverProps> = ({
  commands,
  selectedIndex,
  onSelectCommand,
  onClose,
}) => {
  if (commands.length === 0) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      {onClose && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:bottom-full sm:mb-3 sm:left-0 sm:right-0 w-auto max-w-[calc(100vw-24px)] bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] z-50 animate-fadeIn rounded-2xl">
        <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--theme-border)] mb-1">
          <span className="font-bold text-[var(--theme-text)]">Команды (Slash Commands)</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Tab / ↵ для выбора</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="sm:hidden p-0.5 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-56 sm:max-h-52 overflow-y-auto space-y-1 scrollbar-thin">
          {commands.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.cmd}
                type="button"
                onClick={() => {
                  onSelectCommand(item);
                  onClose?.();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'session-item-active text-[var(--theme-text)] font-semibold border border-[var(--theme-border)] shadow-xs'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      isSelected
                        ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text)]'
                        : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)]'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs truncate text-[var(--theme-text)]">{item.label}</div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-[var(--theme-text-muted)] opacity-90' : 'text-[var(--theme-text-muted)]'
                      }`}
                    >
                      {item.description}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[10px] opacity-75 shrink-0 text-[var(--theme-text-muted)]">{item.cmd}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
