import React from 'react';
import { Cpu, Play, Square, Folder } from 'lucide-react';
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
  batchSize: number;
  setBatchSize: (val: number) => void;
  ubatchSize: number;
  setUbatchSize: (val: number) => void;
  minP: number;
  setMinP: (val: number) => void;
  repeatPenalty: number;
  setRepeatPenalty: (val: number) => void;
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

  const handleStartServer = () => {
    setServerStatus('running');
    setApiUrl(`http://${host}:${port}/v1`);
    setServerLogs([...serverLogs, `[SYSTEM] Local llama server bound to http://${host}:${port}/v1`]);
  };

  const handleStopServer = () => {
    setServerStatus('stopped');
    setServerLogs([...serverLogs, '[SYSTEM] Server stopped.']);
  };

  const toggleItems = [
    { label: 'Flash Attention (-fa)', value: flashAttn, toggle: () => setFlashAttn(!flashAttn) },
    { label: 'Prompt Cache', value: promptCache, toggle: () => setPromptCache(!promptCache) },
    { label: 'Use Memory Map (--mmap)', value: mmap, toggle: () => setMmap(!mmap) },
    { label: 'Lock Memory (--mlock)', value: mlock, toggle: () => setMlock(!mlock) },
    { label: 'Continuous Batching', value: contBatching, toggle: () => setContBatching(!contBatching) },
    { label: 'Embeddings Output', value: embedding, toggle: () => setEmbedding(!embedding) },
  ];

  return (
    <div className="space-y-5 font-sans text-slate-100 max-w-4xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Параметры сервера Llama.cpp</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Конфигурация локального движка выполнения GGUF моделей с GPU Offload (99 слоев)
        </p>
      </div>

      {/* Executable & Model Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Исполняемый файл (llama-server.exe)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={exePath}
              onChange={(e) => setExePath(e.target.value)}
              placeholder="C:\llama-server.exe"
              className="flex-1 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSelectExe}
              className="flat-btn px-2.5 py-2 text-xs font-medium rounded-md text-slate-200 hover:text-white cursor-pointer shrink-0"
            >
              <Folder size={13} />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Файл GGUF Модели (.gguf)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelPath}
              onChange={(e) => setModelPath(e.target.value)}
              placeholder="C:\models\model.gguf"
              className="flex-1 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSelectModel}
              className="flat-btn px-2.5 py-2 text-xs font-medium rounded-md text-slate-200 hover:text-white cursor-pointer shrink-0"
            >
              <Folder size={13} />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Хост и Порт
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="127.0.0.1"
              className="w-1/2 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="11434"
              className="w-1/2 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Numerical Parameters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-md glass-card">
        <div>
          <label className="text-[11px] font-medium text-slate-300">Context Size (-c)</label>
          <input
            type="number"
            value={ctxSize}
            onChange={(e) => setCtxSize(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-300">CPU Threads (-t)</label>
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-300">GPU Offload (-ngl)</label>
          <input
            type="number"
            value={gpuLayers || 99}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-300">Batch Size (-b)</label>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-300">Micro-Batch (-ub)</label>
          <input
            type="number"
            value={ubatchSize}
            onChange={(e) => setUbatchSize(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-300">Temperature</label>
          <input
            type="number"
            step="0.05"
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-300">Min P</label>
          <input
            type="number"
            step="0.01"
            value={minP}
            onChange={(e) => setMinP(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-300">Repeat Penalty</label>
          <input
            type="number"
            step="0.05"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
      </div>

      {/* Pro Custom Toggle Switches Grid (No default checkboxes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 select-none">
        {toggleItems.map((item, idx) => (
          <div
            key={idx}
            onClick={item.toggle}
            className="p-3 rounded-md glass-card flex items-center justify-between border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
          >
            <span className="text-xs font-medium text-slate-300">{item.label}</span>
            <div
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                item.value ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Start / Stop Server Triggers */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleStartServer}
          disabled={serverStatus === 'running'}
          className="flex-1 flat-btn py-2.5 rounded-md text-xs font-medium text-emerald-400 hover:text-emerald-300 border-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Play size={13} />
          <span>Запустить сервер llama.cpp</span>
        </button>
        <button
          type="button"
          onClick={handleStopServer}
          disabled={serverStatus !== 'running'}
          className="flex-1 flat-btn py-2.5 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 border-rose-500/30 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Square size={13} />
          <span>Остановить сервер</span>
        </button>
      </div>

      {/* Server Console Output */}
      <div className="border border-white/10 rounded-md bg-slate-950/90 overflow-hidden flex flex-col">
        <div className="bg-slate-900/80 px-3 py-2 flex justify-between items-center text-xs text-slate-400 select-none border-b border-white/5">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <Cpu size={13} />
            <span>Логи сервера</span>
          </span>
          <div className="flex gap-3 text-[11px]">
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
              className="hover:text-white font-medium cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="p-3 font-mono text-[11px] text-emerald-400 h-28 overflow-y-auto space-y-1 leading-tight select-text scrollbar-none">
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
