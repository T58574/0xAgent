import React from 'react';
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
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
}

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

  return (
    <div className="max-w-3xl space-y-4 font-sans text-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* API Endpoint URL */}
        <div className="space-y-1">
          <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
            Ссылка подключения к API (Local LLM API URL)
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="e.g. http://127.0.0.1:11434/v1"
            required
            className="w-full px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>

        {/* Model Name */}
        <div className="space-y-1">
          <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
            Название модели (Model Name identifier)
          </label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="e.g. qwen2.5-coder:7b"
            required
            className="w-full px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>

        {/* Groq API Key */}
        <div className="space-y-1">
          <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
            Токен API Groq (Для распознавания голоса)
          </label>
          <input
            type="password"
            value={groqApiKey}
            onChange={(e) => setGroqApiKey(e.target.value)}
            placeholder="gsk_..."
            className="w-full px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>

        {/* Models Directory Path */}
        <div className="space-y-1">
          <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
            Папка с моделями GGUF (Models Path)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelsPath}
              onChange={(e) => setModelsPath(e.target.value)}
              placeholder="e.g. C:\users\user\Documents\localLLMS"
              className="flex-1 px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSelectModelsDir}
              className="skeuo-btn px-4 py-1 text-xs font-hud font-bold uppercase tracking-wider rounded-xl text-slate-200 hover:text-white cursor-pointer focus:outline-none shrink-0"
            >
              Обзор...
            </button>
          </div>
        </div>
      </div>

      {/* Reasoning Toggle */}
      <div className="flex items-center gap-2.5 py-1 select-none cursor-pointer">
        <input
          type="checkbox"
          id="reasoning_chk"
          checked={reasoningEnabled}
          onChange={(e) => setReasoningEnabled(e.target.checked)}
          className="rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
        />
        <label htmlFor="reasoning_chk" className="text-xs font-hud font-bold text-slate-300 uppercase select-none cursor-pointer">
          Reasoning (Отображать ход мыслей модели &lt;think&gt;)
        </label>
      </div>

      {/* System Prompt Instructions */}
      <div className="space-y-1">
        <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
          Системные инструкции (System Instructions Prompt)
        </label>
        <textarea
          rows={10}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
          className="w-full px-4 py-3.5 rounded-2xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none resize-none leading-relaxed"
        />
      </div>
    </div>
  );
};
