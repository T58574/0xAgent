import React from 'react';
import { Zap, Folder, Sparkles, Cpu } from 'lucide-react';
import { LocalModelItem } from '../../../types';

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
  specDraftModel: string;
  setSpecDraftModel: (val: string) => void;
  specType: string;
  setSpecType: (val: string) => void;
  specDraftNgl: number;
  setSpecDraftNgl: (val: number) => void;
  specDraftNMax: number;
  setSpecDraftNMax: (val: number) => void;
  specDraftPMin: number;
  setSpecDraftPMin: (val: number) => void;
  jinja: boolean;
  setJinja: (val: boolean) => void;
  reasoningPreserve: boolean;
  setReasoningPreserve: (val: boolean) => void;
  reasoningFormat: string;
  setReasoningFormat: (val: string) => void;
  scannedDraftModels?: LocalModelItem[];
  onSelectDraftModelFile?: () => void;
  onSelectSlotSavePath: () => void;
  onApplyFastPreset: () => void;
  onApplyFastMtpPreset?: () => void;
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
  specDraftModel,
  setSpecDraftModel,
  specType,
  setSpecType,
  specDraftNgl,
  setSpecDraftNgl,
  specDraftNMax,
  setSpecDraftNMax,
  specDraftPMin,
  setSpecDraftPMin,
  jinja,
  setJinja,
  reasoningPreserve,
  setReasoningPreserve,
  reasoningFormat,
  setReasoningFormat,
  scannedDraftModels = [],
  onSelectDraftModelFile,
  onSelectSlotSavePath,
  onApplyFastPreset,
  onApplyFastMtpPreset,
}) => {
  const toggleItems = [
    { label: 'Flash Attention (-fa)', value: flashAttn, toggle: () => setFlashAttn(!flashAttn) },
    { label: 'Jinja Template (--jinja)', value: jinja, toggle: () => setJinja(!jinja) },
    { label: 'Preserve Reasoning', value: reasoningPreserve, toggle: () => setReasoningPreserve(!reasoningPreserve) },
    { label: 'Prompt Cache', value: promptCache, toggle: () => setPromptCache(!promptCache) },
    { label: 'Use Memory Map (--mmap)', value: mmap, toggle: () => setMmap(!mmap) },
    { label: 'Lock Memory (--mlock)', value: mlock, toggle: () => setMlock(!mlock) },
    { label: 'Continuous Batching', value: contBatching, toggle: () => setContBatching(!contBatching) },
    { label: 'Embeddings Output', value: embedding, toggle: () => setEmbedding(!embedding) },
  ];

  return (
    <div className="p-4 rounded-2xl bento-card space-y-4 font-sans text-[var(--theme-text)]">
      {/* Header & Quick Profiles */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border)] pb-3">
        <div>
          <span className="text-xs font-bold text-[var(--theme-text)]">Параметры производительности</span>
          <p className="text-[11px] text-[var(--theme-text-muted)]">Конфигурация потоков, VRAM слоев и контекста</p>
        </div>
        <div className="flex items-center gap-2">
          {onApplyFastMtpPreset && (
            <button
              type="button"
              onClick={onApplyFastMtpPreset}
              className="px-3 py-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-600 dark:text-sky-300 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Применить оптимизированный пресет для Qwen 3.8 + HauhauCS FastMTP (до 3x ускорения)"
            >
              <Sparkles size={13} className="text-sky-500 dark:text-sky-300" />
              <span>FastMTP Qwen3.8 (3x)</span>
            </button>
          )}
          <button
            type="button"
            onClick={onApplyFastPreset}
            className="px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:bg-[var(--theme-panel)] text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
          >
            <Zap size={13} className="text-[var(--theme-text-muted)]" />
            <span>Быстрый пресет (50+ t/s)</span>
          </button>
        </div>
      </div>

      {/* Host & Port */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Host (IP-адрес)</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Port (Порт)</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Context Size -c with quick presets */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <label className="font-bold text-xs text-[var(--theme-text)]">Размер контекста (-c)</label>
          <div className="flex gap-1.5">
            {[4096, 8192, 16384, 32768, 65536].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setCtxSize(sz)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer transition-all border ${
                  ctxSize === sz
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] font-bold shadow-sm'
                    : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
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
          className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
        />
      </div>

      {/* GPU Layers & CPU Threads */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">GPU Layers (-ngl)</label>
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">CPU Threads (-t)</label>
            <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">{threads === 0 ? 'Авто' : `${threads} потоков`}</span>
          </div>
          <input
            type="number"
            min="0"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            placeholder="0 = Авто"
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Batch & Micro-Batch */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Batch Size (-b)</label>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Micro-Batch (-ub)</label>
          <input
            type="number"
            value={ubatchSize}
            onChange={(e) => setUbatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Temp, Min-P, Repeat Penalty */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Temp (--temp)</label>
          <input
            type="number"
            step="0.05"
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Min-P (--min-p)</label>
          <input
            type="number"
            step="0.01"
            value={minP}
            onChange={(e) => setMinP(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Repeat Penalty</label>
          <input
            type="number"
            step="0.05"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Top-K, Top-P, Predict */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Top-K (--top-k)</label>
          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            placeholder="40"
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Top-P (--top-p)</label>
          <input
            type="number"
            step="0.05"
            value={topP}
            onChange={(e) => setTopP(Number(e.target.value))}
            placeholder="1"
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Макс. токенов (-n)</label>
          <input
            type="number"
            value={predict}
            onChange={(e) => setPredict(Number(e.target.value))}
            placeholder="4264"
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Parallel Slots & Cache Reuse */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Параллельные слоты (--parallel)</label>
          <input
            type="number"
            value={parallelSlots}
            onChange={(e) => setParallelSlots(Number(e.target.value))}
            placeholder="2"
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Переиспользование кэша</label>
          <input
            type="number"
            value={cacheReuse}
            onChange={(e) => setCacheReuse(Number(e.target.value))}
            placeholder="256"
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Slot Save Path */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Папка сохранения слотов (--slot-save-path)</label>
          <button
            type="button"
            onClick={onSelectSlotSavePath}
            className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-medium"
          >
            <Folder size={12} />
            <span>Обзор...</span>
          </button>
        </div>
        <input
          type="text"
          value={slotSavePath}
          onChange={(e) => setSlotSavePath(e.target.value)}
          placeholder="~/.0xagent/slots or C:\path\to\slots"
          className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
        />
      </div>

      {/* Speculative Decoding & Custom FastMTP Section */}
      <div className="p-4 rounded-2xl bento-card space-y-3.5 border border-sky-500/30 bg-sky-500/5">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-sky-500 dark:text-sky-400" />
            <span className="text-xs font-bold text-sky-600 dark:text-sky-300">
              Спекулятивное декодирование / FastMTP (Custom MTP)
            </span>
          </div>
          <span className="text-[10px] font-mono text-sky-600 dark:text-sky-300 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/30 font-medium">
            Qwen 3.8 MTP / Draft Support
          </span>
        </div>

        {/* Draft Model GGUF Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)] flex items-center gap-1.5">
              <Cpu size={13} className="text-sky-500 dark:text-sky-400" />
              <span>Draft / FastMTP Модель (--spec-draft-model)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSpecDraftModel('')}
                className="text-[11px] text-[var(--theme-text-muted)] hover:text-sky-600 dark:hover:text-sky-300 transition-colors cursor-pointer font-medium"
                title="Автоматический поиск MTP сайдкара в папке models/"
              >
                [Авто-поиск]
              </button>
              {onSelectDraftModelFile && (
                <button
                  type="button"
                  onClick={onSelectDraftModelFile}
                  className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Folder size={12} />
                  <span>Обзор...</span>
                </button>
              )}
            </div>
          </div>

          <select
            value={
              scannedDraftModels.find(
                (m) => m.filePath.toLowerCase() === specDraftModel.toLowerCase() || m.fileName.toLowerCase() === specDraftModel.toLowerCase()
              )?.filePath || (specDraftModel ? 'custom' : '')
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val && val !== 'custom') {
                setSpecDraftModel(val);
              } else if (!val) {
                setSpecDraftModel('');
              }
            }}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none cursor-pointer transition-colors"
          >
            <option value="" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">-- Авто-детект FastMTP сайдкара (по умолчанию) --</option>
            <option value="none" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">[x] Отключить спекулятивное декодирование (--spec-type none)</option>
            {scannedDraftModels.map((m) => (
              <option key={m.id || m.filePath} value={m.filePath} className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">
                {m.fileName} ({m.quantization || 'GGUF'} • {m.sizeGB})
              </option>
            ))}
            {specDraftModel && specDraftModel !== 'none' && !scannedDraftModels.some((m) => m.filePath.toLowerCase() === specDraftModel.toLowerCase()) && (
              <option value="custom" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Пользовательский путь: {specDraftModel}</option>
            )}
          </select>

          {specDraftModel && specDraftModel !== 'none' && (
            <input
              type="text"
              value={specDraftModel}
              onChange={(e) => setSpecDraftModel(e.target.value)}
              placeholder="~/.0xagent/models/Qwen3.8-27B-FastMTP-32K.gguf"
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-text-muted)] focus:text-[var(--theme-text)] focus:outline-none transition-colors"
            />
          )}
        </div>

        {/* Spec Type & Draft Depth & GPU Layers & Min P & Reasoning Format */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-[var(--theme-text-muted)]">Режим (--spec-type)</label>
            <select
              value={specType}
              onChange={(e) => setSpecType(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:outline-none cursor-pointer"
            >
              <option value="draft-mtp" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">draft-mtp (FastMTP)</option>
              <option value="draft-simple" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">draft-simple</option>
              <option value="draft-eagle3" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">draft-eagle3</option>
              <option value="none" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">none (выкл)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px]">
              <label className="font-semibold text-[var(--theme-text-muted)]">Draft Depth</label>
              <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">n={specDraftNMax}</span>
            </div>
            <input
              type="number"
              min="1"
              max="10"
              value={specDraftNMax}
              onChange={(e) => setSpecDraftNMax(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-[var(--theme-text-muted)]">Draft GPU (-ngld)</label>
            <input
              type="number"
              value={specDraftNgl}
              onChange={(e) => setSpecDraftNgl(Number(e.target.value))}
              placeholder="99"
              className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-[var(--theme-text-muted)]">Min Prob (-p-min)</label>
            <input
              type="number"
              step="0.05"
              value={specDraftPMin}
              onChange={(e) => setSpecDraftPMin(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-[var(--theme-text-muted)]">Формат мыслей</label>
            <select
              value={reasoningFormat}
              onChange={(e) => setReasoningFormat(e.target.value)}
              className="w-full px-2 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:outline-none cursor-pointer"
            >
              <option value="deepseek" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">deepseek (Qwen 3.8)</option>
              <option value="chatml" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">chatml</option>
              <option value="" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">auto / default</option>
            </select>
          </div>
        </div>
      </div>

      {/* Extra CLI Arguments */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Дополнительные CLI флаги (Custom Args)</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCustomArgs('-ctk q8_0 -ctv q8_0')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer transition-all border ${
                customArgs.includes('q8_0')
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] font-bold shadow-sm'
                  : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
              }`}
              title="Сжатие KV-кэша в 8-бит (экономит 50% VRAM контекста)"
            >
              Q8_0 KV
            </button>
            <button
              type="button"
              onClick={() => setCustomArgs('-ctk q4_0 -ctv q4_0')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer transition-all border ${
                customArgs.includes('q4_0')
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] font-bold shadow-sm'
                  : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
              }`}
              title="Сжатие KV-кэша в 4-бит (максимальная экономия VRAM)"
            >
              Q4_0 KV
            </button>
            {customArgs && (
              <button
                type="button"
                onClick={() => setCustomArgs('')}
                className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-rose-500 border border-[var(--theme-border)] cursor-pointer"
                title="Очистить"
              >
                [x]
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={customArgs}
          onChange={(e) => setCustomArgs(e.target.value)}
          placeholder="Например: -ctk q8_0 -ctv q8_0"
          className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
        />
      </div>

      {/* Switches Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--theme-border)]">
        {toggleItems.map((item, i) => (
          <div
            key={i}
            onClick={item.toggle}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
              item.value
                ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] shadow-sm'
                : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <span className="text-[11px] font-medium text-[var(--theme-text)]">{item.label}</span>
            <div
              className={`w-8 h-4.5 rounded-full p-0.5 flex items-center transition-colors ${
                item.value ? 'bg-[var(--theme-accent)]' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                  item.value
                    ? 'translate-x-3.5 bg-[var(--theme-accent-text)]'
                    : 'translate-x-0 bg-white'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
