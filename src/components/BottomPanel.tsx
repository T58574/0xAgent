import React, { useState } from 'react';
import { Copy, Check, X, AlertCircle, Globe, Lock, Terminal, GitBranch, MessageSquare, FolderGit2, Settings } from 'lucide-react';

interface BottomPanelProps {
  logs: string[];
  systemInstructions: string;
  modelName: string;
  onClearLogs: () => void;
  onSelectWorkspace: () => void;
  activeView: 'chat' | 'workspace' | 'settings';
  onChangeView: (view: 'chat' | 'workspace' | 'settings') => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  logs,
  modelName,
  onClearLogs,
  activeView,
  onChangeView,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'share' | null>(null);

  // Network Share Server State
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [shareError] = useState<string | null>(null);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  const toggleTab = (tab: 'logs' | 'share') => {
    if (activeTab === tab) {
      setActiveTab(null);
    } else {
      setActiveTab(tab);
    }
  };

  const handleToggleShare = () => {
    if (shareUrl) {
      setShareUrl(null);
    } else {
      const port = window.location.port || '3000';
      setShareUrl(`http://${window.location.hostname}:${port}`);
    }
  };

  const handleCopySpecificLink = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIndex(index);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  const handleGithubClick = () => {
    window.open('https://github.com/', '_blank');
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center w-full max-w-4xl px-4 font-sans">
      
      {/* EXPANDABLE FLOATING CONTENT CARD ABOVE PILL */}
      {activeTab && (
        <div className="w-full mb-3 rounded-2xl glass-panel p-4 shadow-2xl overflow-y-auto max-h-[240px] flex flex-col justify-between text-slate-100 border border-white/10">
          
          {/* Content Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2 select-none text-[11px] font-hud tracking-wider uppercase">
            <span className="flex items-center gap-2 text-indigo-300">
              <Terminal size={14} />
              <span>
                {activeTab === 'logs' && 'СИСТЕМНЫЕ ЛОГИ АГЕНТА'}
                {activeTab === 'share' && 'ЛОКАЛЬНЫЙ СЕТЕВОЙ ДОСТУП'}
              </span>
            </span>

            <div className="flex items-center gap-2">
              {activeTab === 'logs' && (
                <button
                  onClick={onClearLogs}
                  className="skeuo-btn px-3 py-1 rounded-lg text-slate-300 hover:text-white text-[10px] font-hud uppercase cursor-pointer"
                >
                  Очистить логи
                </button>
              )}
              <button
                onClick={() => setActiveTab(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Inner Content Sections */}
          <div className="flex-grow overflow-y-auto text-xs scrollbar-none">
            {activeTab === 'logs' && (
              <div className="space-y-1 font-mono text-[10px] text-slate-300 leading-relaxed">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="flex gap-2 items-start py-0.5 border-b border-white/5 last:border-0">
                      <span className="text-emerald-400 font-bold shrink-0 font-hud">[LOG]</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-500 font-mono text-[11px]">Логи отсутствуют.</div>
                )}
              </div>
            )}

            {/* Local Network Share Config View */}
            {activeTab === 'share' && (
              <div className="space-y-3 py-1 font-sans text-slate-200">
                <div className="text-[11px] text-slate-400 leading-relaxed font-mono">
                  Локальный доступ к интерфейсу в вашей Wi-Fi / Ethernet сети. Устройства в той же сети смогут подключаться к агенту.
                </div>

                <div className="flex gap-3 items-center">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] uppercase font-hud font-bold text-slate-400 tracking-wider flex items-center gap-1 select-none">
                      <Lock size={10} />
                      <span>Пароль доступа (Опционально)</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      disabled={!!shareUrl}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Без пароля"
                      className="w-full skeuo-input px-3.5 py-1.5 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleToggleShare}
                    className={`skeuo-btn px-4 py-2 text-xs font-hud uppercase tracking-wider font-bold rounded-xl cursor-pointer transition-all ${
                      shareUrl
                        ? 'border-rose-500/40 text-rose-400 hover:text-rose-300'
                        : 'border-emerald-500/40 text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    {shareUrl ? 'Остановить' : 'Включить раздачу'}
                  </button>
                </div>

                {shareError && (
                  <div className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>{shareError}</span>
                  </div>
                )}

                {shareUrl && (
                  <div className="p-3 border border-white/10 rounded-xl bg-slate-950/80 space-y-2">
                    <div className="text-[10px] font-hud font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Globe size={12} />
                      <span>АКТИВНЫЙ АДРЕС ПОДКЛЮЧЕНИЯ:</span>
                    </div>
                    <div className="space-y-1.5">
                      {shareUrl.split(',').map((url, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
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
                            className="skeuo-btn p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                            title="Копировать ссылку"
                          >
                            {copiedLinkIndex === index ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CENTERED FLOATING GLASS PILL BAR */}
      <div className="w-full flex items-center glass-panel rounded-2xl px-4 py-2 text-slate-100 justify-between shadow-2xl border border-white/10 select-none">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onChangeView('chat')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-hud font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeView === 'chat' 
                ? 'bg-slate-800 text-white font-bold border border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.25)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <MessageSquare size={13} className={activeView === 'chat' ? 'text-indigo-400' : 'text-slate-500'} />
            <span>ЧАТ</span>
          </button>

          <button
            onClick={() => onChangeView('workspace')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-hud font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeView === 'workspace' 
                ? 'bg-slate-800 text-white font-bold border border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.25)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <FolderGit2 size={13} className={activeView === 'workspace' ? 'text-amber-400' : 'text-slate-500'} />
            <span>ВОРКСПЕЙС</span>
          </button>

          <button
            onClick={() => onChangeView('settings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-hud font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeView === 'settings' 
                ? 'bg-slate-800 text-white font-bold border border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.25)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Settings size={13} className={activeView === 'settings' ? 'text-emerald-400' : 'text-slate-500'} />
            <span>НАСТРОЙКИ</span>
          </button>

          <span className="w-[1px] h-4 bg-white/10 hidden sm:inline-block" />

          <button
            onClick={() => toggleTab('logs')}
            className={`px-3 py-1.5 rounded-xl text-xs font-hud font-semibold cursor-pointer transition-all border ${
              activeTab === 'logs' 
                ? 'bg-slate-800 text-white font-bold border-indigo-500/50' 
                : 'text-slate-400 border-white/5 hover:bg-white/5 hover:text-white'
            }`}
          >
            ЛОГИ
          </button>
          
          <button
            onClick={() => toggleTab('share')}
            className={`px-3 py-1.5 rounded-xl text-xs font-hud font-semibold cursor-pointer transition-all border ${
              activeTab === 'share' 
                ? 'bg-slate-800 text-white font-bold border-indigo-500/50' 
                : 'text-slate-400 border-white/5 hover:bg-white/5 hover:text-white'
            }`}
          >
            РАЗДАЧА
          </button>
          
          <button
            onClick={handleGithubClick}
            className="px-3 py-1.5 rounded-xl text-xs font-hud font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all cursor-pointer flex items-center gap-1"
          >
            <GitBranch size={13} />
            <span className="hidden md:inline">GITHUB</span>
          </button>
        </div>

        {/* Model status indicator badge */}
        <div className="hidden lg:flex items-center gap-2 border-l border-white/10 pl-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-slate-400 font-mono select-none truncate max-w-[140px]">
            {modelName}
          </span>
        </div>
      </div>

    </div>
  );
};
