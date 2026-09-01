import React, { useState, useEffect } from 'react';
import { Bot, Layers, FolderGit2, Settings as SettingsIcon } from 'lucide-react';
import { VeronicaTasksTab } from './VeronicaTasksTab';
import { VeronicaProjectsTab } from './VeronicaProjectsTab';
import { VeronicaSettingsTab } from './VeronicaSettingsTab';
import { AppConfig } from '../../types';
import * as api from '../../services/api';

interface VeronicaPageProps {
  config: AppConfig | null;
  onSaveConfig: (updatedConfig: AppConfig) => Promise<void>;
}

type VeronicaSubTab = 'tasks' | 'projects' | 'settings';

export const VeronicaPage: React.FC<VeronicaPageProps> = ({
  config,
  onSaveConfig,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<VeronicaSubTab>('tasks');
  const [status, setStatus] = useState<any | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get_veronica_status();
      setStatus(res);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const subTabs = [
    { id: 'tasks', label: 'Задачи & Журнал', icon: Layers, count: status?.active_tasks },
    { id: 'projects', label: 'Проекты & Контекст', icon: FolderGit2 },
    { id: 'settings', label: 'Настройки Вероники', icon: SettingsIcon },
  ];

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto bg-[var(--theme-bg)] font-sans select-none scrollbar-thin">
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Main Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[var(--theme-panel)] border border-[var(--theme-border)] shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Bot size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-[var(--theme-text)] tracking-tight">
                  Вероника :: AI Assistant
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                Автономный персональный ассистент, аудит проектов и управление фоновыми агентами
              </p>
            </div>
          </div>

          {/* Quick Telemetry Badges & Hot Reload */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-xs">
              <span className="text-[var(--theme-text-muted)]">Telegram:</span>
              <strong className={status?.telegram_connected ? 'text-emerald-400' : 'text-amber-400'}>
                {status?.telegram_connected ? 'Подключен' : 'Не задан'}
              </strong>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-xs">
              <span className="text-[var(--theme-text-muted)]">Active Tasks:</span>
              <span className="font-mono font-bold text-[var(--theme-accent)]">
                {status?.active_tasks ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Segmented Sub-Navigation Pills (Miller's Law) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as VeronicaSubTab)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer border shrink-0 ${
                  isActive
                    ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
                    : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                }`}
              >
                <Icon
                  size={15}
                  className={isActive ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'}
                />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Subtab Panels */}
        <div className="w-full">
          {activeSubTab === 'tasks' && <VeronicaTasksTab />}
          {activeSubTab === 'projects' && <VeronicaProjectsTab />}
          {activeSubTab === 'settings' && (
            <VeronicaSettingsTab config={config} onSaveConfig={onSaveConfig} />
          )}
        </div>
      </div>
    </div>
  );
};
