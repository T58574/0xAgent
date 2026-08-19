import { useState, useEffect } from 'react';
import * as api from '../services/api';
import { AppConfig } from '../types';

interface UseServerControllerOptions {
  config: AppConfig | null;
  addLog: (msg: string) => void;
  setActiveView: (view: 'chat' | 'workspace' | 'settings' | 'analytics' | 'knowledge') => void;
}

export function useServerController({ config, addLog, setActiveView }: UseServerControllerOptions) {
  const [isServerOffline, setIsServerOffline] = useState<boolean>(true);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const host = config?.local_server?.host || '127.0.0.1';
        const port = config?.local_server?.port || 11434;
        const h = await api.get_server_health(host, port);
        setIsServerOffline(!h.ok);
      } catch {
        setIsServerOffline(true);
      }
    };

    checkServer();
    const timer = setInterval(checkServer, 3000);

    const un = api.listen<{ status: string }>('llama-server-status', (event) => {
      if (event.payload.status === 'running') {
        setIsServerOffline(false);
      } else if (event.payload.status === 'stopped') {
        setIsServerOffline(true);
      }
    });

    return () => {
      clearInterval(timer);
      un();
    };
  }, [config]);

  const handleStartServer = async () => {
    try {
      let currentCfg = config;
      if (!currentCfg) {
        try {
          currentCfg = await api.get_config();
        } catch {}
      }
      const ls = currentCfg?.local_server;
      const serverConfig = ls
        ? {
            exePath: ls.exe_path || undefined,
            modelPath: ls.model_path || undefined,
            host: ls.host || '127.0.0.1',
            port: ls.port || 11434,
            ctxSize: ls.ctx_size,
            gpuLayers: ls.gpu_layers,
            threads: ls.threads,
            batchSize: ls.batch_size,
            ubatchSize: ls.ubatch_size,
            temp: ls.temp,
            repeatPenalty: ls.repeat_penalty,
            minP: ls.min_p,
            topK: ls.top_k,
            topP: ls.top_p,
            predict: ls.predict,
            flashAttn: ls.flash_attn,
            mmap: ls.mmap,
            mlock: ls.mlock,
            embedding: ls.embedding,
            contBatching: ls.cont_batching,
            parallelSlots: ls.parallel_slots,
            cacheReuse: ls.cache_reuse,
            slotSavePath: ls.slot_save_path,
            customArgs: ls.custom_args,
          }
        : {};

      addLog('Sending launch request to local llama-server process...');
      const res = await api.start_local_server(serverConfig);
      if (res && res.success) {
        setIsServerOffline(false);
        addLog('Local llama.cpp server spawned successfully.');
      }
    } catch (err: any) {
      console.error('Failed to start server:', err);
      const errMsg = err.message || String(err);
      addLog(`[SERVER START ERROR] ${errMsg}`);
      if (errMsg.includes('не найден') || errMsg.includes('не задан') || errMsg.includes('GGUF')) {
        setActiveView('settings');
      }
      throw err;
    }
  };

  return {
    isServerOffline,
    setIsServerOffline,
    handleStartServer,
  };
}
