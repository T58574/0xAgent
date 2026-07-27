import React from 'react';
import { Zap, Folder } from 'lucide-react';

interface ServerPerformanceParamsProps {
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
  topK: number;
  setTopK: (val: number) => void;
  topP: number;
  setTopP: (val: number) => void;
  predict: number;
  setPredict: (val: number) => void;
  repeatPenalty: number;
  setRepeatPenalty: (val: number) => void;
  flashAttn: boolean;
  setFlashAttn: (val: boolean) => void;
  mmap: boolean;
  setMmap: (val: boolean) => void;
  mlock: boolean;
  setMlock: (val: boolean) => void;
  embedding: boolean;
  setEmbedding: (val: boolean) => void;
  contBatching: boolean;
  setContBatching: (val: boolean) => void;
  promptCache: boolean;
  setPromptCache: (val: boolean) => void;
  parallelSlots: number;
  setParallelSlots: (val: number) => void;
  cacheReuse: number;
  setCacheReuse: (val: number) => void;
  slotSavePath: string;
  setSlotSavePath: (val: string) => void;
  customArgs: string;
  setCustomArgs: (val: string) => void;
  onSelectSlotSavePath: () => void;
  onApplyFastPreset: () => void;
}

export const ServerPerformanceParams: React.FC<ServerPerformanceParamsProps> = ({
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
  topK,
  setTopK,
  topP,
  setTopP,
  predict,
  setPredict,
  repeatPenalty,
  setRepeatPenalty,
  flashAttn,
  setFlashAttn,
  mmap,
  setMmap,
  mlock,
  setMlock,
  embedding,
  setEmbedding,
  contBatching,
  setContBatching,
  promptCache,
  setPromptCache,
  parallelSlots,
  setParallelSlots,
  cacheReuse,
  setCacheReuse,
  slotSavePath,
  setSlotSavePath,
  customArgs,
  setCustomArgs,
  onSelectSlotSavePath,
  onApplyFastPreset,
}) => {
  const toggleItems = [
    { label: 'Flash Attention (-fa)', value: flashAttn, toggle: () => setFlashAttn(!flashAttn) },
    { label: 'Prompt Cache', value: promptCache, toggle: () => setPromptCache(!promptCache) },
    { label: 'Use Memory Map (--mmap)', value: mmap, toggle: () => setMmap(!mmap) },
    { label: 'Lock Memory (--mlock)', value: mlock, toggle: () => setMlock(!mlock) },
    { label: 'Continuous Batching', value: contBatching, toggle: () => setContBatching(!contBatching) },
    { label: 'Embeddings Output', value: embedding, toggle: () => setEmbedding(!embedding) },
  ];

  return (
    <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-xs font-semibold text-slate-200">Параметры производительности</span>
        <button
          type="button"
          onClick={onApplyFastPreset}
          className="flat-btn px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
        >
          <Zap size={12} />
          <span>⚡ Быстрый пресет (50+ t/s)</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Host (IP-адрес)</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Port (Порт)</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Context Size -c with quick presets */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <label className="font-semibold text-slate-200">Размер контекста (-c)</label>
          <div className="flex gap-1">
            {[4096, 8192, 16384, 32768, 65536].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setCtxSize(sz)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                  ctxSize === sz ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {sz / 1024}k
              </button>
            ))}
          </div>
        </div>
        <input
          type="number"
          value={ctxSize}
          onChange={(e) => setCtxSize(Number(e.target.value))}
          className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
        />
      </div>

      {/* GPU Layers & CPU Threads */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">GPU Layers (-ngl)</label>
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">CPU Threads (-t)</label>
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Batch & Micro-Batch */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Batch Size (-b)</label>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Micro-Batch (-ub)</label>
          <input
            type="number"
            value={ubatchSize}
            onChange={(e) => setUbatchSize(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Temp, Min-P, Repeat Penalty, Top-K, Top-P, Max Tokens (Predict) */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Temp (--temp)</label>
          <input
            type="number"
            step="0.05"
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Min-P (--min-p)</label>
          <input
            type="number"
            step="0.01"
            value={minP}
            onChange={(e) => setMinP(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Repeat Penalty</label>
          <input
            type="number"
            step="0.05"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Top-K (--top-k)</label>
          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            placeholder="40"
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Top-P (--top-p)</label>
          <input
            type="number"
            step="0.05"
            value={topP}
            onChange={(e) => setTopP(Number(e.target.value))}
            placeholder="1"
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Макс. токенов (-n)</label>
          <input
            type="number"
            value={predict}
            onChange={(e) => setPredict(Number(e.target.value))}
            placeholder="4264"
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Parallel Slots & Cache Reuse */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Параллельные слоты (--parallel)</label>
          <input
            type="number"
            value={parallelSlots}
            onChange={(e) => setParallelSlots(Number(e.target.value))}
            placeholder="2"
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-300">Переиспользование кэша (--cache-reuse)</label>
          <input
            type="number"
            value={cacheReuse}
            onChange={(e) => setCacheReuse(Number(e.target.value))}
            placeholder="256"
            className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Slot Save Path */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-slate-300">Папка сохранения слотов (--slot-save-path)</label>
          <button
            type="button"
            onClick={onSelectSlotSavePath}
            className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-normal"
          >
            <Folder size={12} />
            <span>Обзор...</span>
          </button>
        </div>
        <input
          type="text"
          value={slotSavePath}
          onChange={(e) => setSlotSavePath(e.target.value)}
          placeholder="C:\Users\user\.0xagent\slots"
          className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Extra CLI Arguments */}
      <div className="space-y-1 pt-1">
        <label className="text-[11px] font-medium text-slate-300">Дополнительные CLI флагов запуска (Custom Args)</label>
        <input
          type="text"
          value={customArgs}
          onChange={(e) => setCustomArgs(e.target.value)}
          placeholder="Например: --tensor-split 1,1 -ctk f16"
          className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Custom Pro Switches Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
        {toggleItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-white/5">
            <span className="text-[11px] text-slate-300">{item.label}</span>
            <div
              onClick={item.toggle}
              className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${
                item.value ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  item.value ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
