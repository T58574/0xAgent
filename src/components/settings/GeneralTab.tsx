import React from 'react';
import { Folder } from 'lucide-react';
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
    <div className="space-y-5 font-sans text-slate-100 max-w-4xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Основные параметры</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Конфигурация подключения к языковой модели и рабочим директориям
        </p>
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
            Название модели (Model Identifier)
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
            API Токен Groq (Для голосового распознавания)
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

      {/* Pro Custom Toggle Switch (No default browser checkbox) */}
      <div className="p-3.5 rounded-md glass-card flex items-center justify-between border border-white/10 select-none">
        <div>
          <div className="text-xs font-medium text-slate-200">Отображать ход мыслей (&lt;think&gt;)</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Показывать блок рассуждений модели (Reasoning log) в ответах</div>
        </div>

        <div
          onClick={() => setReasoningEnabled(!reasoningEnabled)}
          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
            reasoningEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-white shadow-md transition-transform" />
        </div>
      </div>

      {/* System Prompt Instructions */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300">
          Системные инструкции (System Prompt)
        </label>
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
