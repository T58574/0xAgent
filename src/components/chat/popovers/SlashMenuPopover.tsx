import React from 'react';
import { Bot, Globe, Code, Terminal, Calendar, Compass } from 'lucide-react';

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
}

export const SlashMenuPopover: React.FC<SlashMenuPopoverProps> = ({
  commands,
  selectedIndex,
  onSelectCommand,
}) => {
  if (commands.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-3 left-0 w-full bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 animate-fadeIn rounded-2xl">
      <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--theme-border)] mb-1">
        <span className="font-bold text-[var(--theme-text)]">Команды</span>
        <span>Tab / ↵ для выбора</span>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
        {commands.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.cmd}
              type="button"
              onClick={() => onSelectCommand(item)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-semibold shadow-sm'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-1.5 rounded-lg ${
                    isSelected
                      ? 'bg-white/20 text-[var(--theme-accent-text)]'
                      : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)]'
                  }`}
                >
                  {item.icon}
                </div>
                <div>
                  <div className="font-bold text-xs">{item.label}</div>
                  <div
                    className={`text-[11px] ${
                      isSelected ? 'opacity-80' : 'text-[var(--theme-text-muted)]'
                    }`}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] opacity-75">{item.cmd}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
