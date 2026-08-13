import React from 'react';
import { Sliders, Shield, Volume2, Save, LayoutGrid, Globe, Key } from 'lucide-react';

interface GeneralTabProps {
  apiUrl: string;
  setApiUrl: (val: string) => void;
  groqApiKey: string;
  setGroqApiKey: (val: string) => void;
  geminiApiKey?: string;
  setGeminiApiKey?: (val: string) => void;
  julesApiKey?: string;
  setJulesApiKey?: (val: string) => void;
  julesDefaultRepo?: string;
  setJulesDefaultRepo?: (val: string) => void;
  reasoningEnabled: boolean;
  setReasoningEnabled: (val: boolean) => void;
  autoSaveHistory: boolean;
  setAutoSaveHistory: (val: boolean) => void;
  soundNotifications: boolean;
  setSoundNotifications: (val: boolean) => void;
  compactChat: boolean;
  setCompactChat: (val: boolean) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  apiUrl,
  setApiUrl,
  groqApiKey,
  setGroqApiKey,
  geminiApiKey = '',
  setGeminiApiKey,
  julesApiKey = '',
  setJulesApiKey,
  julesDefaultRepo = '',
  setJulesDefaultRepo,
  reasoningEnabled,
  setReasoningEnabled,
  autoSaveHistory,
  setAutoSaveHistory,
  soundNotifications,
  setSoundNotifications,
  compactChat,
  setCompactChat,
}) => {
  return (
    <div className="space-y-6 font-sans text-slate-100 max-w-4xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sliders size={16} className="text-emerald-400" />
          <span>Основные параметры подключения и интерфейса</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Конфигурация сетевого подключения к LLM серверу и режимов отображения
        </p>
      </div>

      {/* 1. Connection Card */}
      <div className="p-4 rounded-md glass-card border border-[var(--theme-border)] space-y-4">
        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 border-b border-white/10 pb-2">
          <Globe size={14} className="text-sky-400" />
          <span>Параметры сетевого API подключения</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* API Endpoint URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Globe size={12} className="text-sky-400" />
              <span>Ссылка подключения к API</span>
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434/v1"
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Google AI Studio (Gemini) API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Key size={12} className="text-sky-400" />
              <span>Google AI Studio API Key</span>
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey && setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Groq API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Key size={12} className="text-amber-400" />
              <span>Groq API Key (Whisper)</span>
            </label>
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Google Jules API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Key size={12} className="text-cyan-400" />
              <span>Google Jules API Key</span>
            </label>
            <input
              type="password"
              value={julesApiKey}
              onChange={(e) => setJulesApiKey && setJulesApiKey(e.target.value)}
              placeholder="jules_api_key..."
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Jules Default Repository */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Globe size={12} className="text-cyan-400" />
              <span>Jules Default Repo (e.g. github/owner/repo)</span>
            </label>
            <input
              type="text"
              value={julesDefaultRepo}
              onChange={(e) => setJulesDefaultRepo && setJulesDefaultRepo(e.target.value)}
              placeholder="sources/github/owner/repo"
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2. Interface QoL Toggles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 select-none">
        {/* Think Toggle */}
        <div
          onClick={() => setReasoningEnabled(!reasoningEnabled)}
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-[var(--theme-border)] cursor-pointer hover:border-white/20 transition-colors"
        >
          <div>
            <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <Shield size={13} className="text-emerald-400" />
              <span>Отображать ход мыслей (&lt;think&gt;)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Показывать блок рассуждений модели в ответах</div>
          </div>
          <div
            className="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0"
            style={{ backgroundColor: reasoningEnabled ? 'var(--theme-accent)' : 'rgba(255, 255, 255, 0.1)', justifyContent: reasoningEnabled ? 'flex-end' : 'flex-start' }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transition-transform ${
                reasoningEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
        </div>

        {/* Auto-save History Toggle */}
        <div
          onClick={() => setAutoSaveHistory(!autoSaveHistory)}
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-[var(--theme-border)] cursor-pointer hover:border-white/20 transition-colors"
        >
          <div>
            <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <Save size={13} className="text-sky-400" />
              <span>Автосохранение истории сессий</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Сохранять сообщения после каждого ответа</div>
          </div>
          <div
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
              autoSaveHistory ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
          </div>
        </div>

        {/* Sound Notifications Toggle */}
        <div
          onClick={() => setSoundNotifications(!soundNotifications)}
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-[var(--theme-border)] cursor-pointer hover:border-white/20 transition-colors"
        >
          <div>
            <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <Volume2 size={13} className="text-amber-400" />
              <span>Звуковые уведомления</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Звуковой сигнал при завершении задачи</div>
          </div>
          <div
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
              soundNotifications ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
          </div>
        </div>

        {/* Compact Mode Toggle */}
        <div
          onClick={() => setCompactChat(!compactChat)}
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-[var(--theme-border)] cursor-pointer hover:border-white/20 transition-colors"
        >
          <div>
            <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <LayoutGrid size={13} className="text-purple-400" />
              <span>Компактный интерфейс чата</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Уменьшенные отступы сообщений</div>
          </div>
          <div
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
              compactChat ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
          </div>
        </div>
      </div>
    </div>
  );
};
