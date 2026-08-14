import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  Cpu,
  HardDrive,
  Check,
  Volume2,
  Play,
  Square,
  RefreshCw,
  Search,
  Sliders,
} from 'lucide-react';
import { AppConfig, AvailableModelsResponse } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface ServerStatusData {
  running: boolean;
  host: string;
  port: number;
  modelPath?: string | null;
  modelName?: string | null;
}

interface ModelSelectorDropdownProps {
  config: AppConfig | null;
  onModelChanged?: (newModelId: string) => void;
  direction?: 'up' | 'down';
  compact?: boolean;
}

export const ModelSelectorDropdown: React.FC<ModelSelectorDropdownProps> = ({
  config,
  onModelChanged,
  direction = 'up',
  compact = true,
}) => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatusData>({
    running: false,
    host: '127.0.0.1',
    port: 11434,
    modelPath: null,
    modelName: null,
  });
  const [modelsData, setModelsData] = useState<AvailableModelsResponse>({
    cloud: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: 'Medium', speed: 'Medium', provider: 'Google AI Studio' },
      { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT', badge: 'Fast', speed: 'Fast', provider: 'Google AI Studio' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', badge: 'Ultra Fast', speed: 'Ultra Fast', provider: 'Google AI Studio' },
      { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash Preview TTS', badge: 'Fast', speed: 'TTS Audio', provider: 'Google AI Studio', isAudio: true },
    ],
    local: [],
    activeModelId: config?.model_name || 'gemini-3.6-flash',
  });

  const activeModelId = config?.model_name || modelsData.activeModelId || 'gemini-3.6-flash';
  const isLocalActive = activeModelId.startsWith('local:') || activeModelId.endsWith('.gguf');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchModelsAndStatus = async () => {
    try {
      const [data, status] = await Promise.all([
        api.get_available_models(),
        api.get_server_status(),
      ]);
      setModelsData(data);
      setServerStatus(status as ServerStatusData);
    } catch (err) {
      console.error('Failed to fetch available models / status:', err);
    }
  };

  useEffect(() => {
    fetchModelsAndStatus();
    const interval = setInterval(fetchModelsAndStatus, 4000);
    return () => clearInterval(interval);
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

  const isModelRunning = (model: any): boolean => {
    if (!serverStatus.running || !serverStatus.modelPath) return false;
    const serverModelPath = serverStatus.modelPath.toLowerCase().replace(/\\/g, '/');
    const modelFilePath = (model.filePath || '').toLowerCase().replace(/\\/g, '/');
    if (modelFilePath && serverModelPath === modelFilePath) return true;
    const serverBasename = serverModelPath.split('/').pop() || '';
    const modelBasename = (model.fileName || '').toLowerCase();
    return serverBasename === modelBasename;
  };

  // Switch to an API Model and STOP local server if running
  const handleSelectCloudModel = async (modelId: string) => {
    setIsOpen(false);
    try {
      let currentCfg = config;
      if (!currentCfg) currentCfg = await api.get_config();
      const updatedCfg: AppConfig = { ...currentCfg, model_name: modelId };
      await api.save_config(updatedCfg);

      setModelsData((prev) => ({ ...prev, activeModelId: modelId }));
      if (onModelChanged) onModelChanged(modelId);

      // Auto-stop local server if running to save resources
      if (serverStatus.running) {
        try {
          await api.stop_local_server();
          setServerStatus((prev) => ({ ...prev, running: false }));
          showToast(`Модель: ${modelId}. Локальный сервер остановлен.`, 'info');
        } catch {
          showToast(`Модель: ${modelId}`, 'success');
        }
      } else {
        showToast(`Модель: ${modelId}`, 'success');
      }
    } catch (err: any) {
      console.error('Failed to select cloud model:', err);
      showToast(`Ошибка смены модели: ${err.message || err}`, 'error');
    }
  };

  // Switch to a Local GGUF Model and start/switch local server
  const handleSelectLocalModel = async (model: any) => {
    setIsOpen(false);
    try {
      let currentCfg = config;
      if (!currentCfg) currentCfg = await api.get_config();
      const updatedCfg: AppConfig = {
        ...currentCfg,
        model_name: model.id,
        local_server: {
          ...(currentCfg?.local_server || {}),
          model_path: model.filePath,
        },
      };
      await api.save_config(updatedCfg);
      setModelsData((prev) => ({ ...prev, activeModelId: model.id }));
      if (onModelChanged) onModelChanged(model.id);

      // Auto-start or restart server with this model
      if (!serverStatus.running || !isModelRunning(model)) {
        setIsStartingServer(true);
        showToast(`Запуск llama.cpp (${model.title || model.fileName})...`, 'info');
        try {
          const ls = updatedCfg.local_server;
          await api.start_local_server({
            modelPath: model.filePath,
            exePath: ls?.exe_path,
            host: ls?.host || '127.0.0.1',
            port: ls?.port || 11434,
            ctxSize: ls?.ctx_size,
            gpuLayers: ls?.gpu_layers,
            threads: ls?.threads,
            flashAttn: ls?.flash_attn,
          });
          setServerStatus((prev) => ({
            ...prev,
            running: true,
            modelPath: model.filePath,
            modelName: model.title || model.fileName,
          }));
          showToast('Локальный сервер готов!', 'success');
        } catch (serverErr: any) {
          showToast(`Ошибка старта сервера: ${serverErr.message || serverErr}`, 'error');
        } finally {
          setIsStartingServer(false);
        }
      } else {
        showToast(`Локальная модель: ${model.title || model.fileName}`, 'success');
      }
    } catch (err: any) {
      console.error('Failed to select local model:', err);
      showToast(`Ошибка смены модели: ${err.message || err}`, 'error');
    }
  };

  // Manual Toggle Server Run/Stop
  const handleToggleServer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (serverStatus.running) {
      try {
        await api.stop_local_server();
        setServerStatus((prev) => ({ ...prev, running: false }));
        showToast('Сервер llama.cpp остановлен', 'info');
      } catch (err: any) {
        showToast(`Ошибка остановки: ${err.message || err}`, 'error');
      }
    } else {
      setIsStartingServer(true);
      try {
        let currentCfg = config;
        if (!currentCfg) currentCfg = await api.get_config();
        const ls = currentCfg?.local_server;
        const res = await api.start_local_server({
          modelPath: ls?.model_path,
          exePath: ls?.exe_path,
          host: ls?.host || '127.0.0.1',
          port: ls?.port || 11434,
          ctxSize: ls?.ctx_size,
          gpuLayers: ls?.gpu_layers,
          threads: ls?.threads,
          flashAttn: ls?.flash_attn,
        });
        if (res?.success) {
          setServerStatus((prev) => ({ ...prev, running: true }));
          showToast('Сервер llama.cpp запущен!', 'success');
        }
      } catch (err: any) {
        showToast(`Ошибка запуска: ${err.message || err}`, 'error');
      } finally {
        setIsStartingServer(false);
      }
    }
  };

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
      {compact ? (
        <button
          type="button"
          onClick={() => {
            if (!isOpen) fetchModelsAndStatus();
            setIsOpen(!isOpen);
          }}
          className={`inline-flex items-center gap-1.5 px-2 py-1 mt-0.5 rounded-md text-xs font-mono transition-all cursor-pointer shrink-0 border ${
            isOpen || isLocalActive
              ? 'bg-white/10 text-[var(--theme-text)] border-[var(--theme-border)] shadow-sm'
              : 'bg-white/5 hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
          }`}
          title={`Текущая модель: ${activeModelId}`}
        >
          <div className="relative shrink-0 flex items-center">
            {isLocalActive ? <Cpu size={12} /> : <Cloud size={12} />}
            {isLocalActive && serverStatus.running && (
              <span className="w-1.5 h-1.5 rounded-full bg-white absolute -top-0.5 -right-0.5 animate-pulse" />
            )}
          </div>
          <span className="max-w-[120px] truncate">{getDisplayTitle(activeModelId)}</span>
          <Sliders size={10} className="text-[var(--theme-text-muted)] opacity-60 shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!isOpen) fetchModelsAndStatus();
            setIsOpen(!isOpen);
          }}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-xs ${
            isOpen
              ? 'bg-white/15 border-[var(--theme-border)] text-[var(--theme-text)] shadow-sm'
              : 'bento-card text-[var(--theme-text)] hover:border-[var(--theme-border)]'
          }`}
          title={`Текущая модель: ${activeModelId}`}
        >
          <div className="relative shrink-0 flex items-center">
            {isLocalActive ? (
              <Cpu size={14} className="text-[var(--theme-text-muted)]" />
            ) : (
              <Cloud size={14} className="text-[var(--theme-text-muted)]" />
            )}
            {isLocalActive && serverStatus.running && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-text)] absolute -top-0.5 -right-0.5 animate-pulse" />
            )}
          </div>

          <span className="font-medium text-xs text-[var(--theme-text)] truncate max-w-[140px] sm:max-w-[180px]">
            {getDisplayTitle(activeModelId)}
          </span>
          <Sliders size={12} className="text-[var(--theme-text-muted)] shrink-0" />
        </button>
      )}

      {/* Unified Minimalist Persona-Style Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute left-0 ${
            direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } w-72 rounded-2xl bento-card p-2 shadow-2xl z-50 border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl animate-fadeIn space-y-1`}
        >
          
          {/* Quick Search */}
          <div className="relative mb-1.5">
            <input
              type="text"
              placeholder="Поиск модели..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-black/40 border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none font-sans"
              autoFocus
            />
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--theme-text-muted)]" />
          </div>

          <div
            className="max-h-72 overflow-y-auto space-y-2 pr-0.5"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.15) transparent',
            }}
          >
            {/* Section 1: Cloud API */}
            <div>
              <div className="px-2 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)]/50 mb-1 flex items-center justify-between">
                <span>Облачные API</span>
                <span className="opacity-60 text-[9px]">Google AI</span>
              </div>

              <div className="space-y-0.5">
                {filteredCloud.map((model) => {
                  const isActive = activeModelId === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleSelectCloudModel(model.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                        isActive
                          ? 'bg-white/10 text-[var(--theme-text)] font-semibold border-[var(--theme-border)] shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {model.isAudio ? (
                          <Volume2 size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                        ) : (
                          <Cloud size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                        )}
                        <span className="truncate">{model.name}</span>
                      </div>
                      {isActive && <Check size={13} className="text-[var(--theme-text)] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Local GGUF */}
            <div>
              <div className="px-2 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)]/50 mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>Локальные GGUF</span>
                  <span className="text-[9px] font-mono opacity-60">
                    ({serverStatus.running ? 'online' : 'offline'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleServer}
                  disabled={isStartingServer}
                  className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[var(--theme-text)] border border-[var(--theme-border)] text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {isStartingServer ? (
                    <RefreshCw size={9} className="animate-spin" />
                  ) : serverStatus.running ? (
                    <Square size={8} fill="currentColor" />
                  ) : (
                    <Play size={8} fill="currentColor" />
                  )}
                  <span>{serverStatus.running ? 'Стоп' : 'Старт'}</span>
                </button>
              </div>

              <div className="space-y-0.5">
                {filteredLocal.length === 0 ? (
                  <div className="text-[10px] text-[var(--theme-text-muted)] italic py-1.5 px-2 font-mono text-center">
                    нет файлов в models/
                  </div>
                ) : (
                  filteredLocal.map((model) => {
                    const isActive = activeModelId === model.id || activeModelId === model.fileName || activeModelId === `local:${model.fileName}`;
                    const isRunning = isModelRunning(model);
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelectLocalModel(model)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                          isActive
                            ? 'bg-white/10 text-[var(--theme-text)] font-semibold border-[var(--theme-border)] shadow-sm'
                            : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative shrink-0">
                            <HardDrive size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                            {isRunning && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white absolute -top-0.5 -right-0.5 animate-pulse" />
                            )}
                          </div>
                          <span className="truncate">{model.title || model.fileName}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-60 shrink-0">{model.sizeGB}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
