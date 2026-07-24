import React from 'react';
import { Cpu, Zap } from 'lucide-react';
import * as api from '../../services/api';

interface LocalServerTabProps {
  exePath: string;
  setExePath: (val: string) => void;
  modelPath: string;
  setModelPath: (val: string) => void;
  host: string;
  setHost: (val: string) => void;
  port: number;
  setPort: (val: number) => void;
  ctxSize: number;
  setCtxSize: (val: number) => void;
  threads: number;
  setThreads: (val: number) => void;
  gpuLayers: number;
  setGpuLayers: (val: number) => void;
  temp: number;
  setTemp: (val: number) => void;
  predict: number;
  setPredict: (val: number) => void;
  batchSize: number;
  setBatchSize: (val: number) => void;
  ubatchSize: number;
  setUbatchSize: (val: number) => void;
  minP: number;
  setMinP: (val: number) => void;
  topK: number;
  setTopK: (val: number) => void;
  topP: number;
  setTopP: (val: number) => void;
  repeatPenalty: number;
  setRepeatPenalty: (val: number) => void;
  seed: number;
  setSeed: (val: number) => void;
  flashAttn: boolean;
  setFlashAttn: (val: boolean) => void;
  embedding: boolean;
  setEmbedding: (val: boolean) => void;
  contBatching: boolean;
  setContBatching: (val: boolean) => void;
  promptCache: boolean;
  setPromptCache: (val: boolean) => void;
  mlock: boolean;
  setMlock: (val: boolean) => void;
  mmap: boolean;
  setMmap: (val: boolean) => void;
  customArgs: string;
  setCustomArgs: (val: string) => void;
  serverStatus: 'stopped' | 'running' | 'checking';
  setServerStatus: (val: 'stopped' | 'running' | 'checking') => void;
  serverLogs: string[];
  setServerLogs: (val: string[]) => void;
  serverLogsAutoScroll: boolean;
  setServerLogsAutoScroll: (val: boolean) => void;
  setApiUrl: (val: string) => void;
}

export const LocalServerTab: React.FC<LocalServerTabProps> = ({
  exePath,
  setExePath,
  modelPath,
  setModelPath,
  host,
  setHost,
  port,
  setPort,
  ctxSize,
  setCtxSize,
  threads,
  setThreads,
  gpuLayers,
  setGpuLayers,
  temp,
  setTemp,
  batchSize,
  setBatchSize,
  ubatchSize,
  setUbatchSize,
  minP,
  setMinP,
  repeatPenalty,
  setRepeatPenalty,
  flashAttn,
  setFlashAttn,
  embedding,
  setEmbedding,
  contBatching,
  setContBatching,
  promptCache,
  setPromptCache,
  mlock,
  setMlock,
  mmap,
  setMmap,
  serverStatus,
  setServerStatus,
  serverLogs,
  setServerLogs,
  serverLogsAutoScroll,
  setServerLogsAutoScroll,
  setApiUrl,
}) => {
  const handleSelectExe = async () => {
    try {
      const file = await api.select_workspace();
      if (file) setExePath(file);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectModel = async () => {
    try {
      const file = await api.select_workspace();
      if (file) setModelPath(file);
    } catch (err) {
      console.error(err);
    }
  };

  const applyPreset = (preset: 'weak' | 'medium' | 'nvidia' | 'amd') => {
    if (preset === 'weak') {
      setCtxSize(2048);
      setThreads(4);
      setGpuLayers(0);
      setBatchSize(512);
      setUbatchSize(128);
      setMlock(false);
      setMmap(true);
    } else if (preset === 'medium') {
      setCtxSize(4096);
      setThreads(8);
      setGpuLayers(12);
      setBatchSize(1024);
      setUbatchSize(256);
      setMlock(false);
      setMmap(true);
    } else if (preset === 'nvidia') {
      setCtxSize(8192);
      setThreads(12);
      setGpuLayers(99);
      setBatchSize(2048);
      setUbatchSize(512);
      setMlock(true);
      setMmap(true);
    } else if (preset === 'amd') {
      setCtxSize(8192);
      setThreads(8);
      setGpuLayers(35);
      setBatchSize(1024);
      setUbatchSize(256);
      setMlock(false);
      setMmap(true);
    }
  };

  const handleStartServer = () => {
    setServerStatus('running');
    setApiUrl(`http://${host}:${port}/v1`);
    setServerLogs([...serverLogs, `[SYSTEM] Local llama server bound to http://${host}:${port}/v1`]);
  };

  const handleStopServer = () => {
    setServerStatus('stopped');
    setServerLogs([...serverLogs, '[SYSTEM] Server stopped.']);
  };

  return (
    <div className="max-w-4xl space-y-5 font-sans text-slate-100">
      {/* Presets & Auto-optimize */}
      <div className="p-4 rounded-2xl glass-card border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-hud text-xs text-sky-400 font-bold uppercase tracking-wider">
            <Zap size={14} />
            <span>ГОТОВЫЕ ПРЕСЕТЫ И АВТО-ОПТИМИЗАЦИЯ</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => applyPreset('weak')}
            className="skeuo-btn px-3 py-1.5 rounded-xl text-xs font-hud text-slate-300 hover:text-white"
          >
            Слабый ПК (4 threads / CPU)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('medium')}
            className="skeuo-btn px-3 py-1.5 rounded-xl text-xs font-hud text-slate-300 hover:text-white"
          >
            Средний ПК (8 threads / Low GPU)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('nvidia')}
            className="skeuo-btn px-3 py-1.5 rounded-xl text-xs font-hud text-emerald-400 border-emerald-500/30"
          >
            NVIDIA GPU Offload (99 layers)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('amd')}
            className="skeuo-btn px-3 py-1.5 rounded-xl text-xs font-hud text-indigo-400 border-indigo-500/30"
          >
            AMD Vulkan / ROCm (35 layers)
          </button>
        </div>
      </div>

      {/* Main Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
            Исполняемый файл (llama-server.exe)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={exePath}
              onChange={(e) => setExePath(e.target.value)}
              placeholder="e.g. C:\llama.cpp\llama-server.exe"
              className="flex-1 px-3 py-2 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSelectExe}
              className="skeuo-btn px-3 py-1 text-xs font-hud uppercase rounded-xl text-slate-300 hover:text-white"
            >
              Обзор
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
            Файл GGUF Модели (.gguf)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelPath}
              onChange={(e) => setModelPath(e.target.value)}
              placeholder="e.g. C:\models\model.gguf"
              className="flex-1 px-3 py-2 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSelectModel}
              className="skeuo-btn px-3 py-1 text-xs font-hud uppercase rounded-xl text-slate-300 hover:text-white"
            >
              Обзор
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
            Хост и Порт
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="127.0.0.1"
              className="w-1/2 px-3 py-2 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="11434"
              className="w-1/2 px-3 py-2 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Numerical Parameters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl glass-card border border-white/10">
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">Context Size (-c)</label>
          <input
            type="number"
            value={ctxSize}
            onChange={(e) => setCtxSize(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">CPU Threads (-t)</label>
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">GPU Offload (-ngl)</label>
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">Batch Size (-b)</label>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">Micro-Batch (-ub)</label>
          <input
            type="number"
            value={ubatchSize}
            onChange={(e) => setUbatchSize(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">Temperature</label>
          <input
            type="number"
            step="0.05"
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">Min P</label>
          <input
            type="number"
            step="0.01"
            value={minP}
            onChange={(e) => setMinP(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] font-hud font-bold text-slate-400 uppercase">Repeat Penalty</label>
          <input
            type="number"
            step="0.05"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono"
          />
        </div>
      </div>

      {/* Flags Checkboxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl glass-card border border-white/10 text-xs select-none">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={flashAttn} onChange={(e) => setFlashAttn(e.target.checked)} className="rounded border-white/20 bg-slate-900 text-indigo-500" />
          <span>Flash Attention (-fa)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={promptCache} onChange={(e) => setPromptCache(e.target.checked)} className="rounded border-white/20 bg-slate-900 text-indigo-500" />
          <span>Prompt Cache</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={mmap} onChange={(e) => setMmap(e.target.checked)} className="rounded border-white/20 bg-slate-900 text-indigo-500" />
          <span>Use Memory Map (--mmap)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={mlock} onChange={(e) => setMlock(e.target.checked)} className="rounded border-white/20 bg-slate-900 text-indigo-500" />
          <span>Lock Memory (--mlock)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={contBatching} onChange={(e) => setContBatching(e.target.checked)} className="rounded border-white/20 bg-slate-900 text-indigo-500" />
          <span>Continuous Batching</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={embedding} onChange={(e) => setEmbedding(e.target.checked)} className="rounded border-white/20 bg-slate-900 text-indigo-500" />
          <span>Embeddings Output</span>
        </label>
      </div>

      {/* Control Triggers */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleStartServer}
          disabled={serverStatus === 'running'}
          className="flex-1 skeuo-btn py-2.5 rounded-xl text-xs font-hud font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 border-emerald-500/30 disabled:opacity-40"
        >
          Запустить сервер llama.cpp
        </button>
        <button
          type="button"
          onClick={handleStopServer}
          disabled={serverStatus !== 'running'}
          className="flex-1 skeuo-btn py-2.5 rounded-xl text-xs font-hud font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 border-rose-500/30 disabled:opacity-40"
        >
          Остановить сервер
        </button>
      </div>

      {/* Server Console Log */}
      <div className="border border-white/10 rounded-2xl bg-slate-950/90 overflow-hidden flex flex-col shadow-inner">
        <div className="bg-slate-900/80 px-3 py-2 flex justify-between items-center text-[10px] font-hud text-slate-400 select-none border-b border-white/5">
          <span className="flex items-center gap-1.5 uppercase font-bold text-sky-400">
            <Cpu size={12} />
            <span>ЛОГИ ВЫВОДА ЛОКАЛЬНОГО СЕРВЕРА</span>
          </span>
          <div className="flex gap-3">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={serverLogsAutoScroll}
                onChange={(e) => setServerLogsAutoScroll(e.target.checked)}
                className="rounded bg-slate-800 border-white/10 text-xs"
              />
              <span>Auto scroll</span>
            </label>
            <button
              type="button"
              onClick={() => setServerLogs([])}
              className="hover:text-white font-bold cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="p-3 font-mono text-[10px] text-emerald-400 h-32 overflow-y-auto space-y-1 leading-tight select-text scrollbar-none">
          {serverLogs.length > 0 ? (
            serverLogs.map((log, index) => (
              <div key={index} className="break-all">{log}</div>
            ))
          ) : (
            <div className="text-slate-500 italic">Логи сервера появятся здесь при запуске.</div>
          )}
        </div>
      </div>
    </div>
  );
};
