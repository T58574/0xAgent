import React from 'react';
import {
  MessageSquare,
  Settings as SettingsIcon,
  BarChart2,
  BookOpen,
  Bot,
  Menu,
  Plus,
} from 'lucide-react';
import { AppConfig, ChatSession, LiveTelemetry, ActiveView } from '../types';
import { useI18n } from '../i18n';
import { ContextBudgetGauge } from './chat/ContextBudgetGauge';

interface NavbarProps {
  onToggleSidebar?: () => void;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  config: AppConfig | null;
  currentSession?: ChatSession | null;
  workspaceDir?: string | null;
  onSelectWorkspace?: () => void;
  onUpdateSessionWorkspace?: (dir: string | null) => void;
  isServerOffline?: boolean;
  onStartServer?: () => Promise<void>;
  onNewChat?: () => void;
  liveTelemetry?: LiveTelemetry | null;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  onToggleSidebar,
  activeView,
  onChangeView,
  config,
  currentSession,
  isServerOffline,
  onStartServer,
  onNewChat,
  liveTelemetry,
}) => {
  const { t } = useI18n();

  return (
    <header className="h-12 sm:h-13 bg-[var(--theme-panel)] border border-[var(--theme-border)] rounded-2xl sm:rounded-[22px] px-3 sm:px-4 flex items-center justify-between select-none z-30 shrink-0 font-sans gap-2 sm:gap-4 transition-colors shadow-xs">
      
      {/* 1. LEFT SECTION: Mobile Burger + 3D Tactile Pressed Navigation Tabs */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 justify-start">
        
        {/* Mobile-only Burger Menu Button */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
            title={t.nav.toggleSidebar}
          >
            <Menu size={18} className="text-[var(--theme-text)]" />
          </button>
        )}

        {/* 3D Tactile Pressed Navigation Tabs (Left Aligned) */}
        <nav className="hidden md:flex items-center gap-1.5 sm:gap-2 select-none">
          {[
            { id: 'chat', label: t.nav.chat, icon: MessageSquare },
            { id: 'knowledge', label: t.nav.knowledge, icon: BookOpen },
            { id: 'veronica', label: t.nav.veronica, icon: Bot },
            { id: 'analytics', label: t.nav.analytics, icon: BarChart2 },
            { id: 'settings', label: t.nav.settings, icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeView(tab.id as any)}
                className={`tactile-tab px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'tactile-pressed text-[var(--theme-text)] font-bold'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[var(--theme-text)]' : 'text-[var(--theme-text-muted)]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. RIGHT SECTION: Context Budget Pill + Mobile Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        
        {/* Mobile New Chat Button */}
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="md:hidden p-2 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] font-bold text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
            title={t.nav.newChat}
          >
            <Plus size={16} />
            <span className="hidden xs:inline text-[11px]">{t.common.ok}</span>
          </button>
        )}

        {/* Start Server Quick Action Button if offline */}
        {isServerOffline && onStartServer && (
          <button
            type="button"
            onClick={() => onStartServer()}
            className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
            title={t.nav.startServer}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="hidden xl:inline">{t.nav.startServer}</span>
          </button>
        )}

        {/* Real-time Context Budget Gauge */}
        <ContextBudgetGauge
          liveTelemetry={liveTelemetry}
          currentSession={currentSession}
          config={config}
        />
      </div>

    </header>
  );
});

Navbar.displayName = 'Navbar';
