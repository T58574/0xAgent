import React from 'react';
import { Zap, Folder, Sparkles } from 'lucide-react';
import { LocalModelItem, GgufMetadata } from '../../../types';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import {
  ParamNumberInput,
  ParamTextInput,
  ParamSlider,
  ParamToggleCard,
} from './atoms';
import { MtpSectionCard } from './MtpSectionCard';
import { CustomCliArgsInput } from './CustomCliArgsInput';

export interface ServerPerformanceParamsProps {
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
  onSelectSlotSavePath?: () => void;
  onApplyFastPreset?: () => void;
  onApplyFastMtpPreset?: () => void;
  modelMeta?: GgufMetadata | null;
  serverStatus?: 'stopped' | 'running' | 'checking';
  setSpecType: (val: string) => void;
}

const CTX_PRESETS = [
  { label: '4k', value: 4096 },
  { label: '8k', value: 8192 },
  { label: '16k', value: 16384 },
  { label: '32k', value: 32768 },
  { label: '65k', value: 65536 },
];

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
  setSpecDraftNgl,
  setSpecDraftNMax,
  setSpecDraftPMin,
  jinja,
  setJinja,
  reasoningPreserve,
  setReasoningPreserve,
  onSelectSlotSavePath,
  onApplyFastPreset,
  onApplyFastMtpPreset,
  modelMeta,
}) => {
  const { t, formatString } = useI18n();
  const isMtpEnabled = specType !== 'none' && specDraftModel !== 'none';

  const handleToggleMtp = () => {
    if (isMtpEnabled) {
      setSpecType('none');
      setSpecDraftModel('none');
    } else {
      setSpecType('default');
      setSpecDraftModel('');
      setSpecDraftNMax(3);
      setSpecDraftNgl(99);
      setSpecDraftPMin(0.05);
    }
  };

  const toggleItems = [
    {
      label: 'Flash Attention (-fa)',
      sub: t.settings.localServer.flashAttention,
      tooltip: {
        title: 'Flash Attention (-fa)',
        text: 'Optimizes attention layer calculation in VRAM. Accelerates generation by 1.5-2x.',
        benefit: '+50-100% speed',
      },
      value: flashAttn,
      toggle: () => setFlashAttn(!flashAttn),
    },
    {
      label: 'Jinja Template (--jinja)',
      sub: 'Prompt template formatting',
      tooltip: {
        title: 'Jinja Template (--jinja)',
        text: 'Enables native template rendering for chat models (Qwen, DeepSeek).',
        benefit: 'Ideal prompt & thought structure',
      },
      value: jinja,
      toggle: () => setJinja(!jinja),
    },
    {
      label: 'Preserve Reasoning',
      sub: 'Output thought process in chat',
      tooltip: {
        title: 'Preserve Reasoning',
        text: 'Preserves and renders <think>...</think> reasoning blocks in dialogue UI.',
        benefit: 'Full agent transparency',
      },
      value: reasoningPreserve,
      toggle: () => setReasoningPreserve(!reasoningPreserve),
    },
    {
      label: 'Prompt Cache',
      sub: 'RAM prompt caching',
      tooltip: {
        title: 'Prompt Cache',
        text: 'Keeps invariant prompt prefix in RAM for instant turns.',
        benefit: 'Instant response initiation',
      },
      value: promptCache,
      toggle: () => setPromptCache(!promptCache),
    },
    {
      label: 'Use Memory Map (--mmap)',
      sub: 'Fast model file mapping',
      tooltip: {
        title: 'Memory Map (--mmap)',
        text: 'Maps model file directly to virtual memory without RAM duplication.',
        benefit: 'Sub-second model loading',
      },
      value: mmap,
      toggle: () => setMmap(!mmap),
    },
    {
      label: 'Lock Memory (--mlock)',
      sub: 'Prevent swapping to disk',
      tooltip: {
        title: 'Lock Memory (--mlock)',
        text: 'Locks model memory in physical RAM, preventing paging to disk swap.',
        benefit: 'Prevents stutter under memory load',
      },
      value: mlock,
      toggle: () => setMlock(!mlock),
    },
    {
      label: 'Continuous Batching',
      sub: 'Non-blocking requests',
      tooltip: {
        title: 'Continuous Batching',
        text: 'Enables concurrent background request processing.',
        benefit: 'Multi-turn non-blocking queue',
      },
      value: contBatching,
      toggle: () => setContBatching(!contBatching),
    },
    {
      label: 'Embeddings Output',
      sub: 'Vector embeddings',
      tooltip: {
        title: 'Embeddings Output',
        text: 'Outputs numeric vector embeddings for semantic search.',
        benefit: 'Semantic code retrieval',
      },
      value: embedding,
      toggle: () => setEmbedding(!embedding),
    },
  ];

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <Card variant="default" className="space-y-4 rounded-2xl">
      {/* Title & Quick Presets Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
            {t.settings.localServer.params.perfParamsTitle}
          </h3>
          <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
            {t.settings.localServer.params.perfParamsDesc}
          </p>
        </div>

        {/* Action Presets */}
        <div className="flex items-center gap-2 shrink-0">
          {modelMeta?.supportsFastMtp && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onApplyFastMtpPreset}
              icon={<Sparkles size={12} className="text-[var(--theme-text-muted)]" />}
              title={t.settings.localServer.params.presetFastMtp}
            >
              {t.settings.localServer.params.presetFastMtp}
            </Button>
          )}
          <Button
            variant="secondary"
            size="xs"
            onClick={onApplyFastPreset}
            icon={<Zap size={12} className="text-[var(--theme-text-muted)]" />}
          >
            {t.settings.localServer.params.presetFast}
          </Button>
        </div>
      </div>

      {/* CORE PARAMETER 1: Context Window Size (-c) with quick presets */}
      <ParamSlider
        label={t.settings.localServer.params.ctxSizeLabel}
        value={ctxSize}
        onChange={setCtxSize}
        min={512}
        max={131072}
        step={512}
        presets={CTX_PRESETS}
        tooltip={{
          title: 'Context Window Size',
          text: 'Maximum tokens model retains in memory across turns.',
          benefit: '16k-32k fits 95% of software projects',
        }}
      />

      {/* CORE PARAMETER 2: GPU Layers & CPU Threads */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <ParamNumberInput
          label={t.settings.localServer.params.gpuLayersLabel}
          value={gpuLayers}
          onChange={setGpuLayers}
          tooltip={{
            title: 'GPU Offload Layers (-ngl)',
            text: 'Number of model layers loaded into VRAM. Set 99 to offload entirely to GPU.',
            benefit: 'Max speed on GPU',
          }}
        />
        <ParamNumberInput
          label={t.settings.localServer.params.threadsLabel}
          value={threads}
          min={0}
          placeholder={t.settings.localServer.params.threadsAuto}
          badge={
            threads === 0
              ? t.settings.localServer.params.threadsAuto
              : formatString(t.settings.localServer.params.threadsCount, { count: threads })
          }
          onChange={setThreads}
          tooltip={{
            title: 'CPU Threads (-t)',
            text: 'CPU compute threads. 0 chooses physical cores automatically.',
          }}
        />
      </div>

      {/* ADVANCED ENGINE TUNING (ACCORDION) */}
      <div className="pt-2 border-t border-[var(--theme-border)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[var(--theme-text)]">
              {t.settings.localServer.params.advancedTitle}
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)]">
              {t.settings.localServer.params.advancedDesc}
            </p>
          </div>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] font-semibold text-[var(--theme-accent)]"
          >
            {showAdvanced
              ? t.settings.localServer.params.hideAdvanced
              : t.settings.localServer.params.showAdvanced}
          </Button>
        </div>

        {showAdvanced && (
          <div className="space-y-3.5 pt-3.5 mt-2 border-t border-[var(--theme-border)]/60">
            {/* Host & Port */}
            <div className="grid grid-cols-2 gap-3">
              <ParamTextInput
                label={t.settings.localServer.params.hostLabel}
                value={host}
                onChange={setHost}
                tooltip={{
                  title: 'Host',
                  text: '127.0.0.1 (local only) or 0.0.0.0 (LAN access).',
                  benefit: 'Local isolation or LAN network distribution',
                }}
              />
              <ParamNumberInput
                label={t.settings.localServer.params.portLabel}
                value={port}
                onChange={setPort}
                tooltip={{
                  title: 'Port',
                  text: 'Server API port (default 11434).',
                }}
              />
            </div>

            {/* Batch & Micro-Batch */}
            <div className="grid grid-cols-2 gap-3">
              <ParamNumberInput
                label={t.settings.localServer.params.batchSizeLabel}
                value={batchSize}
                onChange={setBatchSize}
                tooltip={{
                  title: 'Batch Size (-b)',
                  text: 'Prompt processing token batch size.',
                }}
              />
              <ParamNumberInput
                label={t.settings.localServer.params.ubatchSizeLabel}
                value={ubatchSize}
                onChange={setUbatchSize}
                tooltip={{
                  title: 'Micro-Batch (-ub)',
                  text: 'Internal compute sub-batch in VRAM.',
                }}
              />
            </div>

            {/* Temperature & Predict */}
            <div className="grid grid-cols-2 gap-3">
              <ParamNumberInput
                label={t.settings.localServer.params.tempLabel}
                value={temp}
                min={0}
                max={2}
                step={0.05}
                badge={temp.toFixed(2)}
                onChange={setTemp}
                tooltip={{
                  title: 'Temperature',
                  text: 'Sampling randomness. 0.2-0.7 recommended for coding.',
                }}
              />
              <ParamNumberInput
                label={t.settings.localServer.params.predictLabel}
                value={predict}
                placeholder={t.settings.localServer.params.predictUnlimited}
                onChange={setPredict}
                tooltip={{
                  title: 'Max Output Tokens (-n)',
                  text: 'Maximum generation length per response.',
                }}
              />
            </div>

            {/* Sampling Parameters: Min-P, Top-K, Top-P, Repeat Penalty */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ParamNumberInput
                label={t.settings.localServer.params.minPLabel}
                value={minP}
                min={0}
                max={1}
                step={0.01}
                onChange={setMinP}
                tooltip={{
                  title: 'Min-P Sampling',
                  text: 'Trims low-probability tokens relative to top token.',
                }}
              />
              <ParamNumberInput
                label={t.settings.localServer.params.topKLabel}
                value={topK}
                onChange={setTopK}
                tooltip={{
                  title: 'Top-K Sampling',
                  text: 'Restricts candidate pool to top K tokens.',
                }}
              />
              <ParamNumberInput
                label={t.settings.localServer.params.topPLabel}
                value={topP}
                min={0}
                max={1}
                step={0.01}
                onChange={setTopP}
                tooltip={{
                  title: 'Top-P (Nucleus Sampling)',
                  text: 'Cumulative probability threshold for token candidate set.',
                }}
              />
              <ParamNumberInput
                label={t.settings.localServer.params.repeatPenaltyLabel}
                value={repeatPenalty}
                min={1}
                max={2}
                step={0.05}
                onChange={setRepeatPenalty}
                tooltip={{
                  title: 'Repeat Penalty',
                  text: 'Penalizes repeated tokens. 1.0 recommended for syntax-precise code.',
                }}
              />
            </div>

            {/* Parallel Slots & Cache Reuse */}
            <div className="grid grid-cols-2 gap-3">
              <ParamNumberInput
                label={t.settings.localServer.params.slotsLabel}
                value={parallelSlots}
                min={1}
                max={8}
                onChange={setParallelSlots}
                tooltip={{
                  title: 'Parallel Slots (-np)',
                  text: 'Concurrent dialogue slots. Single slot (1) saves VRAM.',
                  benefit: '1 slot saves up to 70% VRAM',
                }}
              />
              <ParamNumberInput
                label={t.settings.localServer.params.cacheReuseLabel}
                value={cacheReuse}
                onChange={setCacheReuse}
                tooltip={{
                  title: 'Cache Reuse (KV Chunk)',
                  text: 'Minimum chunk size for KV prompt cache reuse.',
                }}
              />
            </div>

            {/* Slot Save Path */}
            <ParamTextInput
              label={t.settings.localServer.params.slotSavePathLabel}
              value={slotSavePath}
              onChange={setSlotSavePath}
              placeholder="~/.0xagent/slots or C:\path\to\slots"
              actionButton={
                <button
                  type="button"
                  onClick={onSelectSlotSavePath}
                  className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Folder size={12} />
                  <span>{t.common.browse}</span>
                </button>
              }
              tooltip={{
                title: 'Slot State Directory',
                text: 'Directory where server state and KV cache are saved across sessions.',
              }}
            />

            {/* MTP Section Card */}
            <MtpSectionCard
              isMtpEnabled={isMtpEnabled}
              onToggleMtp={handleToggleMtp}
              modelMeta={modelMeta}
            />

            {/* Extra CLI Arguments */}
            <CustomCliArgsInput
              customArgs={customArgs}
              setCustomArgs={setCustomArgs}
            />

            {/* Switches Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--theme-border)]">
              {toggleItems.map((item, i) => (
                <ParamToggleCard
                  key={i}
                  label={item.label}
                  sub={item.sub}
                  value={item.value}
                  onToggle={item.toggle}
                  tooltip={item.tooltip}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
