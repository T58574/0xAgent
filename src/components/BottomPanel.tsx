import React, { useState } from 'react';
import { Copy, Check, X, AlertCircle, Globe, Lock } from 'lucide-react';

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
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  const toggleTab = (tab: 'logs' | 'share') => {
    if (activeTab === tab) {
      setActiveTab(null);
    } else {
      setActiveTab(tab);
    }
  };

  const handleToggleShare = () => {
    setShareError(null);
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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center w-full max-w-4xl px-4">
      
      {/* EXPANDABLE FLOATING CONTENT CARD ABOVE PILL */}
      {activeTab && (
        <div className="w-full mb-3 rounded-2xl border border-theme-border bg-theme-bg p-4 shadow-lg overflow-y-auto max-h-[220px] flex flex-col justify-between text-theme-text">
          
          {/* Content Header */}
          <div className="flex items-center justify-between pb-2 border-b border-theme-border mb-2 font-sans text-theme-text font-bold select-none text-[11px] tracking-wide uppercase">
            <span className="flex items-center gap-1.5">
              <span>
                {activeTab === 'logs' && 'Running Logs'}
                {activeTab === 'share' && 'Local Network Share'}
              </span>
            </span>

            <div className="flex items-center gap-2">
              {activeTab === 'logs' && (
                <button
                  onClick={onClearLogs}
                  className="px-3 py-0.5 rounded-full border border-theme-border hover:bg-theme-active text-theme-text text-[9px] cursor-pointer focus:outline-none"
                >
                  Clear Logs
                </button>
              )}
              <button
                onClick={() => setActiveTab(null)}
                className="p-0.5 rounded-full border border-theme-border hover:bg-theme-active text-theme-text cursor-pointer transition-colors focus:outline-none"
              >
                <X size={10} />
              </button>
            </div>
          </div>

          {/* Inner Content Sections */}
          <div className="flex-grow overflow-y-auto text-xs">
            {activeTab === 'logs' && (
              <div className="space-y-1 font-mono text-[10px] text-theme-text opacity-85 leading-relaxed">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-theme-text font-bold shrink-0">[LOG]</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-theme-text opacity-50 italic">No logs.</div>
                )}
              </div>
            )}

            {/* Local Network Share Config View */}
            {activeTab === 'share' && (
              <div className="space-y-2 py-1 font-sans text-theme-text">
                <div className="text-[10px] text-theme-text opacity-70 leading-normal">
                  Host the chat interface on your local Wi-Fi/Ethernet network. Other devices on the same network will be able to access the chat.
                </div>

                <div className="flex gap-4 items-center">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-theme-text opacity-60 tracking-wider flex items-center gap-1 select-none">
                      <Lock size={8} />
                      <span>Access Password (Optional)</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      disabled={!!shareUrl}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="No password set"
                      className="w-full px-3 py-1 bg-theme-bg border border-theme-border rounded-full text-xs text-theme-text focus:outline-none focus:bg-theme-active"
                    />
                  </div>

                  <button
                    onClick={handleToggleShare}
                    className={`px-4 py-1 text-xs font-bold rounded-full border border-theme-border cursor-pointer transition-all ${
                      shareUrl
                        ? 'bg-red-50 hover:bg-red-100 text-red-600'
                        : 'bg-theme-bg hover:bg-theme-active text-theme-text'
                    }`}
                  >
                    {shareUrl ? 'Stop Sharing' : 'Start Sharing'}
                  </button>
                </div>

                {shareError && (
                  <div className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>{shareError}</span>
                  </div>
                )}

                {shareUrl && (
                  <div className="p-2 border border-theme-border rounded-xl bg-theme-active space-y-1">
                    <div className="text-[9px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1 select-none">
                      <Globe size={10} />
                      <span>Active Connection URLs (Try these on your phone)</span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {shareUrl.split(',').map((url, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 border-b border-theme-border opacity-85 pb-1 last:border-0 last:pb-0">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[10px] text-theme-text underline break-all hover:opacity-80"
                          >
                            {url}
                          </a>
                          <button
                            onClick={() => handleCopySpecificLink(url, index)}
                            className="p-1 rounded bg-theme-bg border border-theme-border text-theme-text hover:bg-theme-active transition-colors cursor-pointer shrink-0 focus:outline-none"
                            title="Copy link to clipboard"
                          >
                            {copiedLinkIndex === index ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
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

      {/* CENTERED FLOATING PILL BAR */}
      <div className="w-full flex items-center border border-theme-border rounded-full px-4 py-1.5 bg-theme-bg text-theme-text justify-between shadow-sm select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChangeView('chat')}
            className={`rounded-full border px-4 py-0.5 text-xs text-theme-text font-semibold bg-theme-bg hover:bg-theme-active transition-colors cursor-pointer focus:outline-none ${
              activeView === 'chat' 
                ? 'bg-theme-active font-black border-theme-text' 
                : 'border-theme-border'
            }`}
          >
            чат
          </button>

          <button
            onClick={() => onChangeView('workspace')}
            className={`rounded-full border px-4 py-0.5 text-xs text-theme-text font-semibold bg-theme-bg hover:bg-theme-active transition-colors cursor-pointer focus:outline-none ${
              activeView === 'workspace' 
                ? 'bg-theme-active font-black border-theme-text' 
                : 'border-theme-border'
            }`}
          >
            воркспейс
          </button>

          <button
            onClick={() => onChangeView('settings')}
            className={`rounded-full border px-4 py-0.5 text-xs text-theme-text font-semibold bg-theme-bg hover:bg-theme-active transition-colors cursor-pointer focus:outline-none ${
              activeView === 'settings' 
                ? 'bg-theme-active font-black border-theme-text' 
                : 'border-theme-border'
            }`}
          >
            настройки
          </button>

          <span className="w-[1px] h-4 bg-theme-border opacity-35" />

          <button
            onClick={() => toggleTab('logs')}
            className={`rounded-full border border-theme-border px-4 py-0.5 text-xs text-theme-text font-semibold bg-theme-bg hover:bg-theme-active transition-colors cursor-pointer focus:outline-none ${
              activeTab === 'logs' ? 'bg-theme-active font-bold border-theme-text' : ''
            }`}
          >
            логи
          </button>
          
          <button
            onClick={() => toggleTab('share')}
            className={`rounded-full border border-theme-border px-4 py-0.5 text-xs text-theme-text font-semibold bg-theme-bg hover:bg-theme-active transition-colors cursor-pointer focus:outline-none ${
              activeTab === 'share' ? 'bg-theme-active font-bold border-theme-text' : ''
            }`}
          >
            раздача
          </button>
          
          <button
            onClick={handleGithubClick}
            className="rounded-full border border-theme-border px-4 py-0.5 text-xs text-theme-text font-semibold bg-theme-bg hover:bg-theme-active transition-colors cursor-pointer focus:outline-none"
          >
            гитхаб
          </button>
        </div>

        {/* Model status indicator or similar */}
        <span className="text-[10px] text-theme-text opacity-50 font-mono select-none mr-2">
          {modelName}
        </span>
      </div>

    </div>
  );
};
