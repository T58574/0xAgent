import React, { useState, useEffect } from 'react';
import { Bot, Layers, FolderGit2, Cpu, Settings as SettingsIcon, CheckCircle2, XCircle } from 'lucide-react';
import { VeronicaTasksTab } from './VeronicaTasksTab';
import { VeronicaProjectsTab } from './VeronicaProjectsTab';
import { VeronicaComputeNodeTab } from './VeronicaComputeNodeTab';
import { VeronicaSettingsTab } from './VeronicaSettingsTab';
import { AppConfig } from '../../types';
import * as api from '../../services/api';

interface VeronicaPageProps {
  config: AppConfig | null;
  onSaveConfig: (updatedConfig: AppConfig) => Promise<void>;
}

type VeronicaSubTab = 'tasks' | 'projects' | 'compute' | 'settings';

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
    { id: 'compute', label: 'Compute Node (LAN)', icon: Cpu, isOnline: status?.remote_gpu_online },
    { id: 'settings', label: 'Настройки', icon: SettingsIcon },
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

          {/* Quick Telemetry Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-xs">
              <span className="text-[var(--theme-text-muted)]">Telegram:</span>
              <strong className={status?.telegram_connected ? 'text-emerald-400' : 'text-amber-400'}>
                {status?.telegram_connected ? 'Подключен' : 'Не задан'}
              </strong>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-xs">
              <span className="text-[var(--theme-text-muted)]">Compute Node:</span>
              {status?.remote_gpu_online ? (
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <CheckCircle2 size={12} /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[var(--theme-text-muted)]">
                  <XCircle size={12} /> Standalone
                </span>
              )}
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
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                    : 'bg-[var(--theme-card-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-[var(--theme-border)]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="pt-1">
          {activeSubTab === 'tasks' && <VeronicaTasksTab onRefresh={fetchStatus} />}
          {activeSubTab === 'projects' && <VeronicaProjectsTab />}
          {activeSubTab === 'compute' && (
            <VeronicaComputeNodeTab config={config} onSaveConfig={onSaveConfig} />
          )}
          {activeSubTab === 'settings' && (
            <VeronicaSettingsTab config={config} onSaveConfig={onSaveConfig} />
          )}
        </div>

      </div>
    </div>
  );
};
