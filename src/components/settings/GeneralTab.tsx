import React from 'react';
import { Folder, RotateCcw, Zap, Sliders, Shield, Volume2, Save, LayoutGrid } from 'lucide-react';
import * as api from '../../services/api';

interface GeneralTabProps {
  apiUrl: string;
  setApiUrl: (val: string) => void;
  modelName: string;
  setModelName: (val: string) => void;
  groqApiKey: string;
  setGroqApiKey: (val: string) => void;
  modelsPath: string;
  setModelsPath: (val: string) => void;
  reasoningEnabled: boolean;
  setReasoningEnabled: (val: boolean) => void;
  temperature: number;
  setTemperature: (val: number) => void;
  maxTokens: number;
  setMaxTokens: (val: number) => void;
  apiTimeoutSec: number;
  setApiTimeoutSec: (val: number) => void;
  autoSaveHistory: boolean;
  setAutoSaveHistory: (val: boolean) => void;
  soundNotifications: boolean;
  setSoundNotifications: (val: boolean) => void;
  compactChat: boolean;
  setCompactChat: (val: boolean) => void;
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are 0xAgent, an expert AI software developer assistant.
You can read files, write files, patch files, list directories, grep search, and execute PowerShell commands.
When you need to use a tool, format it using XML tags:
- <read_file path="path/to/file" />
- <write_file path="path/to/file">file contents</write_file>
- <patch_file path="path/to/file">
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
</patch_file>
- <list_dir path="path/to/dir" />
- <grep_search pattern="regex_pattern" path="path/to/search" />
- <execute_command>powershell command</execute_command>`;

export const GeneralTab: React.FC<GeneralTabProps> = ({
  apiUrl,
  setApiUrl,
  modelName,
  setModelName,
  groqApiKey,
  setGroqApiKey,
  modelsPath,
  setModelsPath,
  reasoningEnabled,
  setReasoningEnabled,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  apiTimeoutSec,
  setApiTimeoutSec,
  autoSaveHistory,
  setAutoSaveHistory,
  soundNotifications,
  setSoundNotifications,
  compactChat,
  setCompactChat,
  systemPrompt,
  setSystemPrompt,
}) => {
  const handleSelectModelsDir = async () => {
    try {
      const folder = await api.select_workspace();
      if (folder) setModelsPath(folder);
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  const handleResetSystemPrompt = () => {
    if (confirm('Сбросить системный промпт к заводским настройкам 0xAgent?')) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    }
  };

  const modelPresets = [
    { name: 'Qwen 2.5 Coder 7B', id: 'qwen2.5-coder:7b', url: 'http://127.0.0.1:11434/v1' },
    { name: 'Llama 3.2 3B', id: 'llama-3.2-3b', url: 'http://127.0.0.1:11434/v1' },
    { name: 'DeepSeek R1 Qwen 7B', id: 'deepseek-r1-qwen-7b', url: 'http://127.0.0.1:11434/v1' },
    { name: 'Local Llama Server', id: 'llama-server', url: 'http://127.0.0.1:11434/v1' },
  ];

  return (
    <div className="space-y-6 font-sans text-slate-100 max-w-4xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sliders size={16} className="text-emerald-400" />
          <span>Основные параметры и QoL Удобства</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Конфигурация подключения к модели, параметров генерации и интерфейса
        </p>
      </div>

      {/* 1. Network & API Connection Card */}
      <div className="p-4 rounded-md glass-card border border-white/10 space-y-4">
        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 border-b border-white/10 pb-2">
          <Zap size={14} className="text-sky-400" />
          <span>Подключение к LLM Серверу и пресеты</span>
        </div>

        {/* Quick Model Presets Bar */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300">Быстрые пресеты моделей (1-клик):</label>
          <div className="flex flex-wrap gap-2">
            {modelPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setModelName(preset.id);
                  setApiUrl(preset.url);
                }}
                className={`flat-btn px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                  modelName === preset.id
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold'
                    : 'text-slate-300 hover:text-white border-white/10'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Endpoint URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Ссылка подключения к API (LLM Server URL)
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="e.g. http://127.0.0.1:11434/v1"
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Model Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Идентификатор модели (Model ID)
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. qwen2.5-coder:7b"
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Groq API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              API Токен Groq (Голосовой ввод Whisper)
            </label>
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Models Directory Path */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Папка с моделями GGUF (Models Path)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={modelsPath}
                onChange={(e) => setModelsPath(e.target.value)}
                placeholder="C:\models"
                className="flex-1 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSelectModelsDir}
                className="flat-btn px-3 py-2 text-xs font-medium rounded-md text-slate-200 hover:text-white cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Folder size={13} />
                <span>Обзор</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Generation & QoL Fine-tuning Parameters Card */}
      <div className="p-4 rounded-md glass-card border border-white/10 space-y-4">
        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 border-b border-white/10 pb-2">
          <Sliders size={14} className="text-emerald-400" />
          <span>Тонкая настройка генерации (QoL & Performance)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-medium text-slate-300">Температура: {temperature}</label>
              <span className="text-[10px] text-slate-400 font-mono">
                {temperature < 0.3 ? 'Точный код' : temperature < 0.9 ? 'Баланс' : 'Творчество'}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          {/* Max Tokens Preset & Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Максимум токенов ответа (Max Tokens)
            </label>
            <div className="flex gap-1.5">
              {[2048, 4096, 8192, 16384].map((tok) => (
                <button
                  key={tok}
                  type="button"
                  onClick={() => setMaxTokens(tok)}
                  className={`flat-btn flex-1 py-1 text-[11px] font-mono rounded cursor-pointer ${
                    maxTokens === tok ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'text-slate-400 border-white/5'
                  }`}
                >
                  {tok >= 1000 ? `${tok / 1024}k` : tok}
                </button>
              ))}
            </div>
          </div>

          {/* API Timeout */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Таймаут запроса к API (Секунд)
            </label>
            <input
              type="number"
              value={apiTimeoutSec}
              onChange={(e) => setApiTimeoutSec(Number(e.target.value))}
              placeholder="120"
              className="w-full px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Interface QoL Toggles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 select-none">
        {/* Think Toggle */}
        <div
          onClick={() => setReasoningEnabled(!reasoningEnabled)}
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
        >
          <div>
            <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <Shield size={13} className="text-emerald-400" />
              <span>Отображать ход мыслей (&lt;think&gt;)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Показывать блок рассуждений модели в ответах</div>
          </div>
          <div
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
              reasoningEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
          </div>
        </div>

        {/* Auto-save History Toggle */}
        <div
          onClick={() => setAutoSaveHistory(!autoSaveHistory)}
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
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
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
        >
          <div>
            <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <Volume2 size={13} className="text-amber-400" />
              <span>Звуковые уведомления</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Звук при завершении вычислений агентом</div>
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
          className="p-3.5 rounded-md glass-card flex items-center justify-between border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
        >
          <div>
            <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <LayoutGrid size={13} className="text-purple-400" />
              <span>Компактный интерфейс чата</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Уменьшить отступы для большого экрана</div>
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

      {/* 4. System Prompt Instructions Card */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-300">
            Системные инструкции агента (System Prompt)
          </label>
          <button
            type="button"
            onClick={handleResetSystemPrompt}
            className="flat-btn px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={11} className="text-amber-400" />
            <span>Сбросить к заводским</span>
          </button>
        </div>
        <textarea
          rows={9}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full px-3 py-2.5 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none resize-none leading-relaxed"
        />
      </div>
    </div>
  );
};
