import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  Cpu,
  Sparkles,
  HardDrive,
  Check,
  Volume2,
  Activity,
} from 'lucide-react';
import { AppConfig, AvailableModelsResponse } from '../types';
import { MaterialIcon } from './common/MaterialIcon';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface ServerStatusData {
  running: boolean;
  host: string;
  port: number;
  modelPath?: string | null;
  modelName?: string | null;
}

interface LocalModelOptionProps {
  model: any;
  isActive: boolean;
  isRunning: boolean;
  onSelect: (id: string) => void;
}

const LocalModelOptionItem: React.FC<LocalModelOptionProps> = ({ model, isActive, isRunning, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(model.id)}
    className={`w-full px-2.5 py-2 rounded-lg border transition-all text-left flex items-center justify-between gap-2 cursor-pointer ${
      isRunning
        ? 'bg-emerald-500/15 border-emerald-500/40 text-white font-medium shadow-[0_0_10px_rgba(16,185,129,0.15)]'
        : isActive
        ? 'bg-purple-500/15 border-purple-500/40 text-white font-medium shadow-[0_0_10px_rgba(168,85,247,0.15)]'
        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.06] hover:border-white/10 text-slate-300'
    }`}
  >
    <div className="flex items-center gap-2 min-w-0">
      {/* Status indicator dot */}
      <div className="relative shrink-0">
        <HardDrive size={14} className={isRunning ? 'text-emerald-400' : isActive ? 'text-purple-400' : 'text-slate-400'} />
        <span
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${
            isRunning
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
              : 'bg-slate-600'
          }`}
        />
      </div>
      <div className="truncate">
        <div className="text-xs font-semibold truncate">{model.title}</div>
        <div className="text-[10px] text-slate-400 font-mono truncate">{model.fileName}</div>
      </div>
    </div>

    <div className="flex items-center gap-1.5 shrink-0">
      {isRunning && (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
          <Activity size={9} />
          ACTIVE
        </span>
      )}
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
        {model.quantization}
      </span>
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
        {model.sizeGB}
      </span>
      {isActive && !isRunning && <Check size={14} className="text-purple-400 ml-1" />}
    </div>
  </button>
);

interface ModelSelectorDropdownProps {
  config: AppConfig | null;
  onModelChanged?: (newModelId: string) => void;
}

export const ModelSelectorDropdown: React.FC<ModelSelectorDropdownProps> = ({
  config,
  onModelChanged,
}) => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [serverStatus, setServerStatus] = useState<ServerStatusData>({
    running: false,
    host: '127.0.0.1',
    port: 11434,
    modelPath: null,
    modelName: null,
  });
  const [modelsData, setModelsData] = useState<AvailableModelsResponse>({
    cloud: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: 'Medium', speed: 'Medium >', provider: 'Google AI Studio' },
      { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT', badge: 'Fast', speed: 'Fast >', provider: 'Google AI Studio' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', badge: 'Ultra Fast', speed: 'Ultra Fast >', provider: 'Google AI Studio' },
      { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash Preview TTS', badge: 'Fast', speed: 'Fast >', provider: 'Google AI Studio', isAudio: true },
    ],
    local: [],
    activeModelId: config?.model_name || 'gemini-3.6-flash',
  });

  const activeModelId = config?.model_name || modelsData.activeModelId || 'gemini-3.6-flash';
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const [data, status] = await Promise.all([
        api.get_available_models(),
        api.get_server_status(),
      ]);
      setModelsData(data);
      setServerStatus(status as ServerStatusData);
    } catch (err) {
      console.error('Failed to fetch available models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  /** Check if a local model is currently loaded on the running llama.cpp server */
  const isModelRunning = (model: any): boolean => {
    if (!serverStatus.running || !serverStatus.modelPath) return false;
    const serverModelPath = serverStatus.modelPath.toLowerCase().replace(/\\/g, '/');
    const modelFilePath = (model.filePath || '').toLowerCase().replace(/\\/g, '/');
    if (modelFilePath && serverModelPath === modelFilePath) return true;
    // Also check by filename
    const serverBasename = serverModelPath.split('/').pop() || '';
    const modelBasename = (model.fileName || '').toLowerCase();
    return serverBasename === modelBasename;
  };

  const handleSelectModel = async (modelId: string) => {
    setIsOpen(false);
    try {
      let currentCfg = config;
      if (!currentCfg) {
        currentCfg = await api.get_config();
      }
      const updatedCfg: AppConfig = {
        ...currentCfg,
        model_name: modelId,
      };

      // If local model is selected, sync local_server model_path if available
      if (modelId.startsWith('local:')) {
        const localItem = modelsData.local.find((m) => m.id === modelId);
        if (localItem) {
          if (!updatedCfg.local_server) updatedCfg.local_server = {};
          updatedCfg.local_server.model_path = localItem.filePath;
        }
      }

      await api.save_config(updatedCfg);
      setModelsData((prev) => ({ ...prev, activeModelId: modelId }));
      showToast(`Модель изменена: ${getDisplayTitle(modelId)}`, 'info');

      if (onModelChanged) {
        onModelChanged(modelId);
      }
    } catch (err: any) {
      console.error('Failed to save selected model:', err);
      showToast(`Ошибка смены модели: ${err.message || err}`, 'error');
    }
  };

  // Helper to resolve display label for current active model
  const getDisplayTitle = (id: string): string => {
    const cloudMatch = modelsData.cloud.find((m) => m.id === id);
    if (cloudMatch) return cloudMatch.name;

    const localMatch = modelsData.local.find((m) => m.id === id || m.fileName === id || `local:${m.fileName}` === id);
    if (localMatch) return localMatch.title || localMatch.fileName;

    if (id.startsWith('local:')) {
      const fn = id.replace(/^local:/, '');
      return fn.replace(/\.gguf$/i, '');
    }

    return id;
  };

  /** Get the display name for the trigger button */
  const getTriggerDisplayName = (): string => {
    // If local model is running, show its name from server status
    if (serverStatus.running && serverStatus.modelName && activeModelId.startsWith('local:')) {
      return serverStatus.modelName;
    }
    return getDisplayTitle(activeModelId);
  };

  const isLocalActive = activeModelId.startsWith('local:') || activeModelId.endsWith('.gguf');

  // Filtering lists
  const filteredCloud = modelsData.cloud.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLocal = modelsData.local.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.quantization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort local models: running first, then active, then the rest
  const sortedLocal = [...filteredLocal].sort((a, b) => {
    const aRunning = isModelRunning(a) ? 2 : 0;
    const bRunning = isModelRunning(b) ? 2 : 0;
    const aActive = (activeModelId === a.id || activeModelId === a.fileName || activeModelId === `local:${a.fileName}`) ? 1 : 0;
    const bActive = (activeModelId === b.id || activeModelId === b.fileName || activeModelId === `local:${b.fileName}`) ? 1 : 0;
    return (bRunning + bActive) - (aRunning + aActive);
  });

  return (
    <div className="relative font-sans select-none" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) fetchModels();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer ${
          isOpen
            ? 'bg-sky-500/15 border-sky-500/40 text-white shadow-[0_0_15px_rgba(56,189,248,0.25)]'
            : 'bg-white/[0.04] border-white/10 hover:border-white/20 text-slate-200 hover:bg-white/[0.08]'
        }`}
        title={`Текущая модель: ${activeModelId}`}
      >
        {isLocalActive ? (
          <div className="relative shrink-0">
            <MaterialIcon name="developer_board" size={16} className="text-theme-accent" />
            {serverStatus.running && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-950 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
            )}
          </div>
        ) : (
          <MaterialIcon name="auto_awesome" size={16} className="text-theme-accent shrink-0" />
        )}

        <span className="font-semibold text-xs text-theme-text truncate max-w-[150px] sm:max-w-[200px]">
          {getTriggerDisplayName()}
        </span>
        <MaterialIcon name={isOpen ? 'expand_less' : 'expand_more'} size={16} className="text-theme-muted" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl glass-panel shadow-2xl z-50 overflow-hidden font-sans">
          {/* Header */}
          <div className="p-3 border-b border-theme-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-theme-text">
              <MaterialIcon name="tune" size={16} className="text-theme-accent" />
              <span>Выбор модели ИИ</span>
            </div>
            <button
              type="button"
              onClick={fetchModels}
              disabled={loading}
              className="p-1 rounded-lg hover:bg-white/10 text-theme-muted hover:text-theme-text transition-colors"
            >
              <MaterialIcon name="refresh" size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-2 border-b border-theme-border">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg flat-input text-xs">
              <MaterialIcon name="search" size={14} className="text-theme-muted shrink-0" />
              <input
                type="text"
                placeholder="Поиск модели..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* Model Lists */}
          <div className="max-h-[360px] overflow-y-auto p-2 space-y-3 scrollbar-none">
            {/* Section 1: Cloud AI */}
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-400/90">
                <Cloud size={12} />
                <span>Cloud AI (Google AI Studio)</span>
              </div>

              <div className="space-y-1 mt-1">
                {filteredCloud.map((model) => {
                  const isActive = activeModelId === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleSelectModel(model.id)}
                      className={`w-full px-2.5 py-2 rounded-lg border transition-all text-left flex items-center justify-between gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-sky-500/15 border-sky-500/40 text-white font-medium shadow-[0_0_10px_rgba(56,189,248,0.15)]'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.06] hover:border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {model.isAudio ? (
                          <Volume2 size={14} className="text-amber-400 shrink-0" />
                        ) : (
                          <Sparkles size={14} className={isActive ? 'text-sky-400' : 'text-slate-400'} />
                        )}
                        <div className="truncate">
                          <div className="text-xs font-semibold truncate">{model.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{model.provider}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                            model.badge === 'Ultra Fast'
                              ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                              : model.badge === 'Fast'
                              ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                          }`}
                        >
                          {model.speed}
                        </span>
                        {isActive && <Check size={14} className="text-sky-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Local llama.cpp */}
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400/90">
                <div className="flex items-center gap-1.5">
                  <Cpu size={12} />
                  <span>Local llama.cpp (models/*.gguf)</span>
                </div>
                <div className="flex items-center gap-2">
                  {serverStatus.running && (
                    <span className="text-[9px] font-mono font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)] animate-pulse" />
                      SERVER ON
                    </span>
                  )}
                  <span className="text-[9px] text-slate-500 font-mono font-normal">
                    {modelsData.local.length} файлов
                  </span>
                </div>
              </div>

              <div className="space-y-1 mt-1">
                {sortedLocal.length === 0 ? (
                  <div className="px-3 py-3 text-center text-[11px] text-slate-500 italic bg-white/[0.01] rounded-lg border border-dashed border-white/10">
                    {modelsData.local.length === 0
                      ? 'Файлы .gguf не найдены в папке models/.'
                      : 'Совпадений по поиску не найдено.'}
                  </div>
                ) : (
                  sortedLocal.map((model) => {
                    const isActive = activeModelId === model.id || activeModelId === model.fileName || activeModelId === `local:${model.fileName}`;
                    const running = isModelRunning(model);
                    return (
                      <LocalModelOptionItem
                        key={model.id}
                        model={model}
                        isActive={isActive}
                        isRunning={running}
                        onSelect={handleSelectModel}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-slate-900/80 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
            <span className="truncate flex items-center gap-1.5">
              {serverStatus.running && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
              )}
              <span>Текущая: <span className="font-mono text-slate-200">{getTriggerDisplayName()}</span></span>
            </span>
            <span className="text-slate-500 font-mono">Cloud + Local</span>
          </div>
        </div>
      )}
    </div>
  );
};
