import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Cloud,
  Cpu,
  Sparkles,
  HardDrive,
  Check,
  RefreshCw,
  Search,
  Volume2,
  Sliders,
} from 'lucide-react';
import { AppConfig, AvailableModelsResponse } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

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
      const data = await api.get_available_models();
      setModelsData(data);
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

  const getDisplayBadge = (id: string): { label: string; color: string } => {
    const cloudMatch = modelsData.cloud.find((m) => m.id === id);
    if (cloudMatch) {
      if (cloudMatch.badge === 'Ultra Fast') return { label: 'Ultra Fast', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
      if (cloudMatch.badge === 'Fast') return { label: 'Fast', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
      return { label: 'Medium', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' };
    }

    const localMatch = modelsData.local.find((m) => m.id === id || m.fileName === id || `local:${m.fileName}` === id);
    if (localMatch) {
      return { label: `${localMatch.quantization} • ${localMatch.sizeGB}`, color: 'text-purple-300 border-purple-500/30 bg-purple-500/10' };
    }

    if (id.startsWith('local:')) {
      return { label: 'Local GGUF', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
    }

    return { label: 'Cloud', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' };
  };

  const isLocalActive = activeModelId.startsWith('local:') || activeModelId.endsWith('.gguf');
  const activeBadge = getDisplayBadge(activeModelId);

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
          <Cpu size={14} className="text-purple-400 shrink-0" />
        ) : (
          <Sparkles size={14} className="text-sky-400 shrink-0" />
        )}

        <span className="font-semibold text-xs text-slate-100 truncate max-w-[150px] sm:max-w-[200px]">
          {getDisplayTitle(activeModelId)}
        </span>

        {/* Speed / Quant Badge */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border shrink-0 hidden sm:inline-block ${activeBadge.color}`}
        >
          {activeBadge.label}
        </span>

        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-sky-400' : ''}`} />
      </button>

      {/* Glassmorphism Dropdown Popup */}
      {isOpen && (
        <div
          className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-80 sm:w-96 rounded-xl border border-white/15 bg-[#0d0f17]/95 backdrop-blur-2xl shadow-2xl shadow-black/80 z-50 overflow-hidden text-xs text-slate-200"
          style={{ animation: 'fadeSlideDown 0.15s ease-out' }}
        >
          {/* Header & Search */}
          <div className="p-3 border-b border-white/10 bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sliders size={13} className="text-sky-400" />
                <span className="font-bold text-slate-100 tracking-wide text-[11px] uppercase">Выбор ИИ Модели</span>
              </div>

              <button
                type="button"
                onClick={fetchModels}
                disabled={loading}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Обновить список .gguf моделей"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin text-sky-400' : ''} />
              </button>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию или кванту..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          {/* Model Lists */}
          <div className="max-h-[360px] overflow-y-auto p-2 space-y-3 scrollbar-none">
            {/* Section 1: Cloud AI (Google AI Studio) */}
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

            {/* Section 2: Local llama.cpp (models/*.gguf) */}
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400/90">
                <div className="flex items-center gap-1.5">
                  <Cpu size={12} />
                  <span>Local llama.cpp (models/*.gguf)</span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono font-normal">
                  {modelsData.local.length} файлов
                </span>
              </div>

              <div className="space-y-1 mt-1">
                {filteredLocal.length === 0 ? (
                  <div className="px-3 py-3 text-center text-[11px] text-slate-500 italic bg-white/[0.01] rounded-lg border border-dashed border-white/10">
                    {modelsData.local.length === 0
                      ? 'Файлы .gguf не найдены в папке models/.'
                      : 'Совпадений по поиску не найдено.'}
                  </div>
                ) : (
                  filteredLocal.map((model) => {
                    const isActive = activeModelId === model.id || activeModelId === model.fileName || activeModelId === `local:${model.fileName}`;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelectModel(model.id)}
                        className={`w-full px-2.5 py-2 rounded-lg border transition-all text-left flex items-center justify-between gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-purple-500/15 border-purple-500/40 text-white font-medium shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                            : 'bg-white/[0.02] border-transparent hover:bg-white/[0.06] hover:border-white/10 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <HardDrive size={14} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                          <div className="truncate">
                            <div className="text-xs font-semibold truncate">{model.title}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{model.fileName}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                            {model.quantization}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                            {model.sizeGB}
                          </span>
                          {isActive && <Check size={14} className="text-purple-400 ml-1" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-slate-900/80 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
            <span className="truncate">Текущая: <span className="font-mono text-slate-200">{activeModelId}</span></span>
            <span className="text-slate-500 font-mono">Cloud + Local</span>
          </div>
        </div>
      )}
    </div>
  );
};
