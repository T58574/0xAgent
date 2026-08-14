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
    <div className="p-4 rounded-xl bento-card space-y-4 font-sans text-[var(--theme-text)]">
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
        <span className="text-xs font-semibold text-[var(--theme-text)]">Параметры производительности</span>
        <button
          type="button"
          onClick={onApplyFastPreset}
          className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Zap size={12} className="text-[var(--theme-text-muted)]" />
          <span>Быстрый пресет (50+ t/s)</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Host (IP-адрес)</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Port (Порт)</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Context Size -c with quick presets */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <label className="font-semibold text-xs text-[var(--theme-text)]">Размер контекста (-c)</label>
          <div className="flex gap-1">
            {[4096, 8192, 16384, 32768, 65536].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setCtxSize(sz)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono cursor-pointer transition-colors border ${
                  ctxSize === sz
                    ? 'bg-white/15 text-[var(--theme-text)] border-[var(--theme-border)] font-bold'
                    : 'bg-white/5 text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text)]'
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
          className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
        />
      </div>

      {/* GPU Layers & CPU Threads */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">GPU Layers (-ngl)</label>
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">CPU Threads (-t)</label>
            <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">{threads === 0 ? 'Авто' : `${threads} потоков`}</span>
          </div>
          <input
            type="number"
            min="0"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            placeholder="0 = Авто"
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Batch & Micro-Batch */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Batch Size (-b)</label>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Micro-Batch (-ub)</label>
          <input
            type="number"
            value={ubatchSize}
            onChange={(e) => setUbatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Temp, Min-P, Repeat Penalty, Top-K, Top-P, Max Tokens (Predict) */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Temp (--temp)</label>
          <input
            type="number"
            step="0.05"
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Min-P (--min-p)</label>
          <input
            type="number"
            step="0.01"
            value={minP}
            onChange={(e) => setMinP(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Repeat Penalty</label>
          <input
            type="number"
            step="0.05"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Top-K (--top-k)</label>
          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            placeholder="40"
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Top-P (--top-p)</label>
          <input
            type="number"
            step="0.05"
            value={topP}
            onChange={(e) => setTopP(Number(e.target.value))}
            placeholder="1"
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Макс. токенов (-n)</label>
          <input
            type="number"
            value={predict}
            onChange={(e) => setPredict(Number(e.target.value))}
            placeholder="4264"
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Parallel Slots & Cache Reuse */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Параллельные слоты (--parallel)</label>
          <input
            type="number"
            value={parallelSlots}
            onChange={(e) => setParallelSlots(Number(e.target.value))}
            placeholder="2"
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Переиспользование кэша</label>
          <input
            type="number"
            value={cacheReuse}
            onChange={(e) => setCacheReuse(Number(e.target.value))}
            placeholder="256"
            className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Slot Save Path */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Папка сохранения слотов (--slot-save-path)</label>
          <button
            type="button"
            onClick={onSelectSlotSavePath}
            className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-normal"
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
          className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
        />
      </div>

      {/* Extra CLI Arguments */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between items-center text-xs">
          <label className="text-[11px] font-medium text-[var(--theme-text-muted)]">Дополнительные CLI флаги (Custom Args)</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCustomArgs('-ctk q8_0 -ctv q8_0')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono cursor-pointer transition-colors border ${
                customArgs.includes('q8_0')
                  ? 'bg-white/15 text-[var(--theme-text)] border-[var(--theme-border)] font-bold'
                  : 'bg-white/5 text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text)]'
              }`}
              title="Сжатие KV-кэша в 8-бит (экономит 50% VRAM контекста)"
            >
              Q8_0 KV
            </button>
            <button
              type="button"
              onClick={() => setCustomArgs('-ctk q4_0 -ctv q4_0')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono cursor-pointer transition-colors border ${
                customArgs.includes('q4_0')
                  ? 'bg-white/15 text-[var(--theme-text)] border-[var(--theme-border)] font-bold'
                  : 'bg-white/5 text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text)]'
              }`}
              title="Сжатие KV-кэша в 4-бит (максимальная экономия VRAM)"
            >
              Q4_0 KV
            </button>
            {customArgs && (
              <button
                type="button"
                onClick={() => setCustomArgs('')}
                className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
                title="Очистить"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={customArgs}
          onChange={(e) => setCustomArgs(e.target.value)}
          placeholder="Например: -ctk q8_0 -ctv q8_0"
          className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
        />
      </div>

      {/* Switches Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--theme-border)]">
        {toggleItems.map((item, i) => (
          <div
            key={i}
            onClick={item.toggle}
            className="flex items-center justify-between p-2.5 rounded-lg bento-card cursor-pointer hover:border-white/20 transition-colors"
          >
            <span className="text-[11px] text-[var(--theme-text)]">{item.label}</span>
            <div
              className={`w-8 h-4.5 rounded-md p-0.5 flex items-center transition-colors ${
                item.value ? 'bg-white/30' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-sm bg-white transition-transform ${
                  item.value ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
