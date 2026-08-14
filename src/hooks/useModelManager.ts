import { useState, useEffect, useCallback } from 'react';
import { AppConfig, AvailableModelsResponse } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

export interface ServerStatusData {
  running: boolean;
  host: string;
  port: number;
  modelPath?: string | null;
  modelName?: string | null;
}

export function useModelManager(
  config?: AppConfig | null,
  onModelChanged?: (newModelId: string) => void
) {
  const { showToast } = useToast();
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

  const fetchModelsAndStatus = useCallback(async () => {
    try {
      const [data, status] = await Promise.all([
        api.get_available_models(),
        api.get_server_status(),
      ]);
      setModelsData(data);
      setServerStatus(status as ServerStatusData);
    } catch (err) {
      console.error('Failed to fetch models/status:', err);
    }
  }, []);

  useEffect(() => {
    fetchModelsAndStatus();
    const interval = setInterval(fetchModelsAndStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchModelsAndStatus]);

  const isModelRunning = useCallback((model: any): boolean => {
    if (!serverStatus.running || !serverStatus.modelPath) return false;
    const serverModelPath = serverStatus.modelPath.toLowerCase().replace(/\\/g, '/');
    const modelFilePath = (model.filePath || '').toLowerCase().replace(/\\/g, '/');
    if (modelFilePath && serverModelPath === modelFilePath) return true;
    const serverBasename = serverModelPath.split('/').pop() || '';
    const modelBasename = (model.fileName || '').toLowerCase();
    return serverBasename === modelBasename;
  }, [serverStatus]);

  const selectCloudModel = useCallback(async (modelId: string) => {
    try {
      let currentCfg = config;
      if (!currentCfg) currentCfg = await api.get_config();
      const updatedCfg: AppConfig = { ...currentCfg, model_name: modelId };
      await api.save_config(updatedCfg);

      setModelsData((prev) => ({ ...prev, activeModelId: modelId }));
      if (onModelChanged) onModelChanged(modelId);

      if (serverStatus.running) {
        try {
          await api.stop_local_server();
          setServerStatus((prev) => ({ ...prev, running: false }));
          showToast(`Модель: ${modelId}. Сервер остановлен.`, 'info');
        } catch {
          showToast(`Модель: ${modelId}`, 'success');
        }
      } else {
        showToast(`Модель: ${modelId}`, 'success');
      }
    } catch (err: any) {
      showToast(`Ошибка смены модели: ${err.message || err}`, 'error');
    }
  }, [config, onModelChanged, serverStatus.running, showToast]);

  const selectLocalModel = useCallback(async (model: any) => {
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
      showToast(`Ошибка смены модели: ${err.message || err}`, 'error');
    }
  }, [config, isModelRunning, onModelChanged, serverStatus.running, showToast]);

  const toggleServer = useCallback(async (e: React.MouseEvent) => {
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
  }, [config, serverStatus.running, showToast]);

  const getDisplayTitle = useCallback((id: string): string => {
    const cloudMatch = modelsData.cloud.find((m) => m.id === id);
    if (cloudMatch) return cloudMatch.name;

    const localMatch = modelsData.local.find(
      (m) => m.id === id || m.fileName === id || `local:${m.fileName}` === id
    );
    if (localMatch) return localMatch.title || localMatch.fileName;

    if (id.startsWith('local:')) {
      const fn = id.replace(/^local:/, '');
      return fn.replace(/\.gguf$/i, '');
    }
    return id;
  }, [modelsData]);

  return {
    modelsData,
    serverStatus,
    activeModelId,
    isLocalActive,
    isStartingServer,
    fetchModelsAndStatus,
    selectCloudModel,
    selectLocalModel,
    toggleServer,
    getDisplayTitle,
  };
}
