import React, { useState, useEffect } from 'react';
import { Cpu, Play, Square, Folder, Download, HardDrive, RefreshCw } from 'lucide-react';
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
  const [isInstallingLlama, setIsInstallingLlama] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const list = await api.get_gguf_models();
        setAvailableModels(list);
      } catch (err) {
        console.error('Failed to load GGUF models list:', err);
      }
    }
    loadModels();
  }, []);

  // Open Native Windows OpenFileDialog for Executable
  const handleSelectExe = async () => {
    try {
      const file = await api.select_file_native("Executable Files (*.exe)|*.exe|All Files (*.*)|*.*");
      if (file) setExePath(file);
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  };

  // Open Native Windows OpenFileDialog for GGUF Model
  const handleSelectModel = async () => {
    try {
      const file = await api.select_file_native("GGUF Model Files (*.gguf)|*.gguf|All Files (*.*)|*.*");
      if (file) setModelPath(file);
    } catch (err) {
      console.error('Failed to select GGUF model:', err);
    }
  };

  // 1-Click Llama.cpp Installer from GitHub Releases
  const handleInstallLlama = async () => {
    setIsInstallingLlama(true);
    try {
      const res = await api.install_llama_cpp();
      setExePath(res.exePath);
      alert((res as any).message || 'Llama.cpp успешно установлен!');
    } catch (err: any) {
      console.error(err);
      alert(`Ошибка установки: ${err.message || err}`);
    } finally {
      setIsInstallingLlama(false);
    }
  };

  // 1-Click GGUF Model Downloader
  const handleDownloadModel = async (model: any) => {
    setDownloadingModelId(model.id);
    try {
      const res = await api.download_gguf_model(model.url, model.filename);
      setModelPath(res.modelPath);
      alert((res as any).message || 'Модель успешно загружена!');
    } catch (err: any) {
      console.error(err);
      alert(`Ошибка скачивания: ${err.message || err}`);
    } finally {
      setDownloadingModelId(null);
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

      {/* Fast 1-Click Llama.cpp Installer & GGUF Model Downloader Card */}
      <div className="p-4 rounded-md glass-card border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Download size={14} className="text-emerald-400" />
              <span>Авто-установщик Llama.cpp & Загрузчик GGUF Моделей</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Загружает официальные бинарники Llama.cpp с GitHub и GGUF модели напрямую в папки программы
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallLlama}
            disabled={isInstallingLlama}
            className="flat-btn px-3 py-1.5 rounded text-xs font-medium text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {isInstallingLlama ? <RefreshCw size={13} className="animate-spin" /> : <HardDrive size={13} />}
            <span>{isInstallingLlama ? 'Установка...' : 'Установить Llama.cpp с GitHub (1-клик)'}</span>
          </button>
        </div>

        {/* Popular GGUF Models Parser Cards */}
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-medium text-slate-300">Доступные модели с весами (Hugging Face GGUF):</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {availableModels.map((m) => {
              const isDownloading = downloadingModelId === m.id;
              return (
                <div key={m.id} className="p-3 rounded border border-white/10 bg-slate-900/40 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">{m.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{m.desc}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadModel(m)}
                    disabled={isDownloading}
                    className="flat-btn px-2.5 py-1 rounded text-[11px] font-medium text-slate-200 hover:text-white cursor-pointer flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50"
                  >
                    {isDownloading ? <RefreshCw size={11} className="animate-spin text-sky-400" /> : <Download size={11} className="text-emerald-400" />}
                    <span>{isDownloading ? 'Загрузка...' : `Скачать (${m.size})`}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
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
              title="Выбрать файл llama-server.exe"
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
              title="Выбрать файл .gguf"
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

      {/* Pro Custom Toggle Switches Grid */}
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
