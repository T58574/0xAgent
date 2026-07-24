import React, { useState } from 'react';
import { Copy, Check, X, AlertCircle, Globe, Lock, Terminal, MessageSquare, FolderGit2, Settings, Activity } from 'lucide-react';
import * as api from '../services/api';

interface BottomPanelProps {
  logs: string[];
  systemInstructions: string;
  modelName: string;
  onClearLogs: () => void;
  onSelectWorkspace: () => void;
  activeView: 'chat' | 'workspace' | 'settings' | 'analytics';
  onChangeView: (view: 'chat' | 'workspace' | 'settings' | 'analytics') => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  logs,
  onClearLogs,
  activeView,
  onChangeView,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'share' | null>(null);

  // Network Share Server State
  const [shareUrls, setShareUrls] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [shareError] = useState<string | null>(null);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  const toggleTab = async (tab: 'logs' | 'share') => {
    if (activeTab === tab) {
      setActiveTab(null);
    } else {
      setActiveTab(tab);
      if (tab === 'share') {
        try {
          const urls = await api.get_local_ips();
          setShareUrls(urls);
        } catch (err) {
          console.error('Failed to get local IPs:', err);
        }
      }
    }
  };

  const handleCopySpecificLink = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIndex(index);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center w-full max-w-4xl px-3 font-sans">
      
      {/* EXPANDABLE FLOATING CONTENT CARD ABOVE PILL */}
      {activeTab && (
        <div className="w-full mb-2 rounded-md glass-panel p-3.5 shadow-2xl overflow-y-auto max-h-[220px] flex flex-col justify-between text-slate-100 border border-white/10">
          
          {/* Content Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2 select-none text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-200">
              <Terminal size={13} className="text-emerald-400" />
              <span>
                {activeTab === 'logs' && 'Системные логи агента'}
                {activeTab === 'share' && 'Локальная сетевая раздача'}
              </span>
            </span>

            <div className="flex items-center gap-2">
              {activeTab === 'logs' && (
                <button
                  onClick={onClearLogs}
                  className="flat-btn px-2.5 py-0.5 rounded text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer"
                >
                  Очистить логи
                </button>
              )}
              <button
                onClick={() => setActiveTab(null)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Inner Content Sections */}
          <div className="flex-grow overflow-y-auto text-xs scrollbar-none">
            {activeTab === 'logs' && (
              <div className="space-y-1 font-mono text-[11px] text-slate-300 leading-relaxed">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="flex gap-2 items-start py-0.5 border-b border-white/5 last:border-0">
                      <span className="text-emerald-400 font-medium shrink-0">[LOG]</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-500 italic">Логи отсутствуют.</div>
                )}
              </div>
            )}

            {/* Local Network Share Config View */}
            {activeTab === 'share' && (
              <div className="space-y-2.5 py-1 font-sans text-slate-200">
                <div className="text-xs text-slate-400 leading-relaxed">
                  Откройте любой из этих адресов на вашем телефоне или планшете в той же Wi-Fi сети:
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1 select-none">
                    <Lock size={10} />
                    <span>Пароль доступа (Опционально)</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Без пароля"
                    className="w-full flat-input px-3 py-1.5 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {shareError && (
                  <div className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>{shareError}</span>
                  </div>
                )}

                <div className="p-2.5 border border-white/10 rounded bg-slate-950/80 space-y-1.5">
                  <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5 select-none">
                    <Globe size={12} />
                    <span>Адреса для подключения в локальной сети (IP):</span>
                  </div>
                  <div className="space-y-1">
                    {shareUrls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 border-b border-white/5 pb-1 last:border-0 last:pb-0">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-emerald-400 underline break-all hover:text-emerald-300"
                        >
                          {url}
                        </a>
                        <button
                          onClick={() => handleCopySpecificLink(url, index)}
                          className="flat-btn p-1 rounded text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                          title="Копировать ссылку"
                        >
                          {copiedLinkIndex === index ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CENTERED FLOATING GLASS PILL BAR */}
      <div className="w-full flex items-center glass-panel rounded-md px-3 py-1.5 text-slate-100 justify-between shadow-2xl border border-white/10 select-none">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => onChangeView('chat')}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              activeView === 'chat' 
                ? 'bg-slate-800 text-white font-semibold border border-emerald-500/40' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <MessageSquare size={13} className={activeView === 'chat' ? 'text-emerald-400' : 'text-slate-500'} />
            <span>Чат</span>
          </button>

          <button
            onClick={() => onChangeView('workspace')}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              activeView === 'workspace' 
                ? 'bg-slate-800 text-white font-semibold border border-emerald-500/40' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <FolderGit2 size={13} className={activeView === 'workspace' ? 'text-emerald-400' : 'text-slate-500'} />
            <span>Воркспейс</span>
          </button>

          <button
            onClick={() => onChangeView('settings')}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              activeView === 'settings' 
                ? 'bg-slate-800 text-white font-semibold border border-emerald-500/40' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Settings size={13} className={activeView === 'settings' ? 'text-emerald-400' : 'text-slate-500'} />
            <span>Настройки</span>
          </button>

          <button
            onClick={() => onChangeView('analytics')}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              activeView === 'analytics' 
                ? 'bg-slate-800 text-white font-semibold border border-emerald-500/40' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Activity size={13} className={activeView === 'analytics' ? 'text-emerald-400' : 'text-slate-500'} />
            <span>Аналитика</span>
          </button>

          <span className="w-[1px] h-3.5 bg-white/10 hidden sm:inline-block" />

          <button
            onClick={() => toggleTab('logs')}
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all border ${
              activeTab === 'logs' 
                ? 'bg-slate-800 text-white font-semibold border-emerald-500/40' 
                : 'text-slate-400 border-white/5 hover:bg-white/5 hover:text-white'
            }`}
          >
            Логи
          </button>
          
          <button
            onClick={() => toggleTab('share')}
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all border ${
              activeTab === 'share' 
                ? 'bg-slate-800 text-white font-semibold border-emerald-500/40' 
                : 'text-slate-400 border-white/5 hover:bg-white/5 hover:text-white'
            }`}
          >
            Раздача
          </button>
        </div>
      </div>

    </div>
  );
};
