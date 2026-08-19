import React, { useState } from 'react';
import { Zap, Folder, Sparkles, Cpu, HelpCircle, ChevronDown, ChevronUp, Gauge, Check } from 'lucide-react';
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
  onSelectSlotSavePath?: () => void;
  onApplyFastPreset?: () => void;
  onApplyFastMtpPreset?: () => void;
}

// Apple-Style Help Tooltip Popover
const InfoTooltip: React.FC<{ title: string; text: string; benefit?: string }> = ({ title, text, benefit }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block ml-1 align-middle" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-0.5 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
        title="Справка"
      >
        <HelpCircle size={13} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-64 p-3 rounded-2xl bento-card bg-[var(--theme-panel-solid)] border border-[var(--theme-border)] shadow-2xl backdrop-blur-2xl text-left animate-fadeIn pointer-events-none">
          <div className="text-xs font-bold text-[var(--theme-text)] mb-1 flex items-center gap-1.5">
            <span>{title}</span>
          </div>
          <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed mb-1.5">{text}</p>
          {benefit && (
            <div className="pt-1.5 border-t border-[var(--theme-border)] text-[10px] font-semibold text-[var(--theme-accent)] flex items-center gap-1">
              <span>✦ Эффект:</span>
              <span>{benefit}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  const [showAdvancedMtp, setShowAdvancedMtp] = useState(false);

  // Is Speculative Decoding Enabled?
  const isMtpEnabled = specType !== 'none' && specDraftModel !== 'none';

  // Toggle MTP on / off
  const handleToggleMtp = () => {
    if (isMtpEnabled) {
      setSpecType('none');
      setSpecDraftModel('none');
    } else {
      setSpecType('default');
      setSpecDraftModel('');
      setSpecDraftNMax(3);
      setSpecDraftNgl(99);
      setSpecDraftPMin(0);
    }
  };

  // Speed Presets (Apple-Style)
  const applySpeedProfile = (profile: 'balanced' | 'turbo' | 'accurate') => {
    setSpecType('default');
    if (specDraftModel === 'none') setSpecDraftModel('');
    
    if (profile === 'balanced') {
      setSpecDraftNMax(3);
      setSpecDraftPMin(0);
    } else if (profile === 'turbo') {
      setSpecDraftNMax(5);
      setSpecDraftPMin(0.05);
    } else if (profile === 'accurate') {
      setSpecDraftNMax(2);
      setSpecDraftPMin(0.1);
    }
  };

  const toggleItems = [
    {
      label: 'Flash Attention (-fa)',
      sub: 'Ускорение внимания на GPU',
      helpTitle: 'Flash Attention (-fa)',
      helpText: 'Оптимизирует вычисление слоя внимания в VRAM. Ускоряет генерацию в 1.5–2 раза и снижает нагрев видеокарты.',
      benefit: '+50-100% к скорости генерации',
      value: flashAttn,
      toggle: () => setFlashAttn(!flashAttn),
    },
    {
      label: 'Jinja Template (--jinja)',
      sub: 'Шаблоны промптов и мыслей',
      helpTitle: 'Jinja Template (--jinja)',
      helpText: 'Включает нативный рендеринг системных шаблонов чата и формата рассуждений для современных моделей (Qwen, DeepSeek).',
      benefit: 'Идеальное форматирование мыслей',
      value: jinja,
      toggle: () => setJinja(!jinja),
    },
    {
      label: 'Preserve Reasoning',
      sub: 'Отображение хода мыслей',
      helpTitle: 'Preserve Reasoning',
      helpText: 'Сохраняет и выводит цепочку мыслей <think>...</think> в интерфейсе чата, позволяя видеть логику агента перед кодом.',
      benefit: 'Прозрачность решений ассистента',
      value: reasoningPreserve,
      toggle: () => setReasoningPreserve(!reasoningPreserve),
    },
    {
      label: 'Prompt Cache',
      sub: 'Кэширование истории в ОЗУ',
      helpTitle: 'Prompt Cache',
      helpText: 'Сохраняет неизменную часть системного промпта и контекста в оперативной памяти, избавляя от повторного чтения при каждом вопросе.',
      benefit: 'Мгновенный старт генерации',
      value: promptCache,
      toggle: () => setPromptCache(!promptCache),
    },
    {
      label: 'Use Memory Map (--mmap)',
      sub: 'Быстрая загрузка файла модели',
      helpTitle: 'Memory Map (--mmap)',
      helpText: 'Загружает модель напрямую через виртуальную память Windows без полного дублирования файла в оперативную память.',
      benefit: 'Запуск сервера за 1–2 секунды',
      value: mmap,
      toggle: () => setMmap(!mmap),
    },
    {
      label: 'Lock Memory (--mlock)',
      sub: 'Запрет сброса в файл подкачки',
      helpTitle: 'Lock Memory (--mlock)',
      helpText: 'Блокирует память модели в физической RAM, запрещая Windows сбрасывать её на жесткий диск/SSD при нехватке памяти.',
      benefit: 'Защита от фризов при нагрузке',
      value: mlock,
      toggle: () => setMlock(!mlock),
    },
    {
      label: 'Continuous Batching',
      sub: 'Параллельная обработка запросов',
      helpTitle: 'Continuous Batching',
      helpText: 'Позволяет серверу обрабатывать новые входящие запросы в фоне без блокировки главного потока.',
      benefit: 'Многозадачность без ожидания',
      value: contBatching,
      toggle: () => setContBatching(!contBatching),
    },
    {
      label: 'Embeddings Output',
      sub: 'Векторные эмбеддинги',
      helpTitle: 'Embeddings Output',
      helpText: 'Включает генерацию числовых векторных представлений текста для семантического поиска по коду и памяти.',
      benefit: 'Векторный поиск по проекту',
      value: embedding,
      toggle: () => setEmbedding(!embedding),
    },
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
              className="px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:bg-[var(--theme-panel)] text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Применить пресет для спекулятивного декодирования (Speculative Draft / MTP)"
            >
              <Sparkles size={13} className="text-[var(--theme-text-muted)]" />
              <span>Speculative Draft (2x)</span>
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
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Host (IP-адрес)</label>
            <InfoTooltip
              title="Host (Сетевой адрес)"
              text="IP-адрес, на котором локальный сервер слушает входящие запросы. 127.0.0.1 доступен только с вашего ПК, 0.0.0.0 открывает доступ в локальной сети."
              benefit="Локальная изоляция или раздача по LAN"
            />
          </div>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Port (Порт)</label>
            <InfoTooltip
              title="Port (Сетевой порт)"
              text="Сетевой порт API сервера. По умолчанию 11434 (стандарт OpenAI/Ollama) или 8080."
            />
          </div>
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
          <div className="flex items-center">
            <label className="font-bold text-xs text-[var(--theme-text)]">Размер контекста (-c)</label>
            <InfoTooltip
              title="Размер контекста (-c)"
              text="Максимальное количество токенов истории диалога и кода, которые модель может удерживать в памяти одновременно."
              benefit="16k–32k достаточно для 95% проектов"
            />
          </div>
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
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">GPU Layers (-ngl)</label>
            <InfoTooltip
              title="Слои GPU (-ngl)"
              text="Сколько слоев нейросети выгрузить в видеопамять (VRAM). Значение 99 выгружает всю модель на видеокарту для максимальной скорости."
              benefit="Максимальная скорость на GPU"
            />
          </div>
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center">
              <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">CPU Threads (-t)</label>
              <InfoTooltip
                title="Потоки процессора (-t)"
                text="Количество потоков CPU для вычислений. 0 — автоматический подбор под физические ядра вашего процессора."
              />
            </div>
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
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Batch Size (-b)</label>
            <InfoTooltip
              title="Размер батча (-b)"
              text="Размер пакета токенов для одновременной обработки промпта. Значение 2048 оптимально для быстрого чтения длинного кода."
            />
          </div>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Micro-Batch (-ub)</label>
            <InfoTooltip
              title="Микро-батч (-ub)"
              text="Размер подпакета вычислений внутри VRAM. 512 обеспечивает идеальный баланс между скоростью и экономией видеопамяти."
            />
          </div>
          <input
            type="number"
            value={ubatchSize}
            onChange={(e) => setUbatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Temperature & Predict */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center">
              <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Температура (Креативность)</label>
              <InfoTooltip
                title="Температура"
                text="Степень случайности и креативности модели. Для программирования рекомендуется 0.2–0.7 (строгая логика), для идей — 0.8–1.0."
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--theme-text-muted)] font-bold">{temp.toFixed(2)}</span>
          </div>
          <input
            type="number"
            step="0.05"
            min="0"
            max="2"
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Макс. токенов ответа (-n)</label>
            <InfoTooltip
              title="Лимит токенов ответа (-n)"
              text="Максимальная длина одного ответа модели. -1 или большие значения позволяют писать длинные файлы без обрезки."
            />
          </div>
          <input
            type="number"
            value={predict}
            onChange={(e) => setPredict(Number(e.target.value))}
            placeholder="-1 = Без лимита"
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Sampling Parameters: Min-P, Top-K, Top-P, Repeat Penalty */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Min-P</label>
            <InfoTooltip
              title="Min-P сэмплинг"
              text="Отсекает маловероятные токены относительно самого вероятного. Значение 0.05 отсекает мусорные варианты и защищает от галлюцинаций."
            />
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={minP}
            onChange={(e) => setMinP(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Top-K</label>
            <InfoTooltip
              title="Top-K сэмплинг"
              text="Ограничивает выборку K наиболее вероятными токенами на каждом шаге генерации. 20–40 идеально для точного кода."
            />
          </div>
          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Top-P</label>
            <InfoTooltip
              title="Top-P (Nucleus Sampling)"
              text="Суммарная вероятность пула токенов для выбора. 0.95 сохраняет вариативность языка без потери строгости."
            />
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={topP}
            onChange={(e) => setTopP(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Штраф повторов</label>
            <InfoTooltip
              title="Штраф за повторы (Repeat Penalty)"
              text="Предотвращает зацикливание модели на одних и тех же словах. Для кода рекомендуется 1.0 (без штрафа, чтобы не ломать синтаксис)."
            />
          </div>
          <input
            type="number"
            step="0.05"
            min="1"
            max="2"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Parallel Slots & Cache Reuse */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Параллельные слоты (-np)</label>
            <InfoTooltip
              title="Параллельные слоты (-np)"
              text="Количество одновременно обрабатываемых диалогов. Для персонального локального использования рекомендуется строго 1 слот для экономии VRAM."
              benefit="1 слот экономит до 70% видеопамяти"
            />
          </div>
          <input
            type="number"
            min="1"
            max="8"
            value={parallelSlots}
            onChange={(e) => setParallelSlots(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Cache Reuse (KV Chunk)</label>
            <InfoTooltip
              title="Повторное использование кэша"
              text="Минимальный размер блока кэша для переиспользования между запросами. 256 ускоряет повторные запросы."
            />
          </div>
          <input
            type="number"
            value={cacheReuse}
            onChange={(e) => setCacheReuse(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Slot Save Path */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Папка сохранения слотов (--slot-save-path)</label>
            <InfoTooltip
              title="Сохранение состояния слотов"
              text="Путь к директории, в которую сервер сохраняет состояние KV-кэша для мгновенного восстановления контекста после перезагрузки."
            />
          </div>
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

      {/* ========================================================================= */}
      {/* 🚀 APPLE-STYLE SPECULATIVE ACCELERATION (MTP & DRAFT) SECTION */}
      {/* ========================================================================= */}
      <div className="p-4.5 rounded-3xl bento-card space-y-4 border border-[var(--theme-border)] bg-[var(--theme-panel)]/80 shadow-md">
        
        {/* Main Apple-Style Master Switch Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--theme-accent)]" />
              <span className="text-xs font-bold text-[var(--theme-text)]">
                Ускорение генерации (Speculative Decoding & MTP)
              </span>
              <InfoTooltip
                title="Спекулятивное декодирование (MTP / Draft)"
                text="Революционная технология аппаратного ускорения: маленькая драфт-модель быстро предугадывает следующие 3–5 токенов, а большая модель верифицирует их за 1 шаг GPU. Это дает до 2x–3x прироста скорости без потери качества."
                benefit="Удваивает скорость генерации (до 50–70 tok/s)"
              />
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)]">
              Аппаратное предугадывание следующих токенов через легкую драфт-модель
            </p>
          </div>

          {/* Master Toggle Pill */}
          <button
            type="button"
            onClick={handleToggleMtp}
            className={`w-12 h-6.5 rounded-full p-1 flex items-center transition-all cursor-pointer shrink-0 shadow-inner ${
              isMtpEnabled ? 'bg-[var(--theme-accent)]' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
            title={isMtpEnabled ? 'Отключить спекулятивное ускорение' : 'Включить спекулятивное ускорение'}
          >
            <div
              className={`w-4.5 h-4.5 rounded-full bg-white transition-transform shadow-md ${
                isMtpEnabled ? 'translate-x-5.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* When Enabled: Apple Segmented Speed Controls & Model Selector */}
        {isMtpEnabled && (
          <div className="space-y-3.5 pt-2 border-t border-[var(--theme-border)] animate-fadeIn">
            
            {/* Speed Profile Segmented Control */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--theme-text-muted)] flex items-center gap-1.5">
                <Gauge size={13} className="text-[var(--theme-accent)]" />
                <span>Профиль скорости (Агрессивность драфта)</span>
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)]">
                <button
                  type="button"
                  onClick={() => applySpeedProfile('balanced')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    specDraftNMax === 3
                      ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-sm border border-[var(--theme-border)] font-bold'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>⚡ Баланс (2.0x)</span>
                    {specDraftNMax === 3 && <Check size={12} className="text-[var(--theme-accent)]" />}
                  </div>
                  <span className="text-[9px] opacity-70 font-normal">3 токена • Рекомендуется</span>
                </button>

                <button
                  type="button"
                  onClick={() => applySpeedProfile('turbo')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    specDraftNMax === 5
                      ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-sm border border-[var(--theme-border)] font-bold'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>🔥 Турбо (2.5x+)</span>
                    {specDraftNMax === 5 && <Check size={12} className="text-[var(--theme-accent)]" />}
                  </div>
                  <span className="text-[9px] opacity-70 font-normal">5 токенов • Макс. скорость</span>
                </button>

                <button
                  type="button"
                  onClick={() => applySpeedProfile('accurate')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    specDraftNMax === 2
                      ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-sm border border-[var(--theme-border)] font-bold'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>🎯 Точный (1.5x)</span>
                    {specDraftNMax === 2 && <Check size={12} className="text-[var(--theme-accent)]" />}
                  </div>
                  <span className="text-[9px] opacity-70 font-normal">2 токена • Для сложных задач</span>
                </button>
              </div>
            </div>

            {/* Draft Model GGUF Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[var(--theme-text-muted)] flex items-center gap-1.5">
                  <Cpu size={13} className="text-[var(--theme-accent)]" />
                  <span>Драфт-модель (--spec-draft-model)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSpecDraftModel('')}
                    className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer font-medium"
                    title="Автоматический поиск совместимой драфт-модели в папке models/"
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
                <option value="" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">-- Авто-детект драфт-модели (по умолчанию) --</option>
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
                  placeholder="C:\models\Qwen3.8-1.5B.gguf"
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-text-muted)] focus:text-[var(--theme-text)] focus:outline-none transition-colors"
                />
              )}
            </div>

            {/* Collapsible Advanced Fine-Tuning CLI Parameters */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedMtp(!showAdvancedMtp)}
                className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer font-medium transition-colors"
              >
                <span>{showAdvancedMtp ? 'Скрыть тонкие параметры' : '⚙️ Тонкие параметры CLI (--spec-type, -ngld, -p-min)'}</span>
                {showAdvancedMtp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showAdvancedMtp && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-[var(--theme-text-muted)]">Режим (--spec-type)</label>
                    <select
                      value={specType}
                      onChange={(e) => setSpecType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:outline-none cursor-pointer"
                    >
                      <option value="default" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">default (стандартный)</option>
                      <option value="draft-mtp" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">draft-mtp (MTP)</option>
                      <option value="draft-eagle" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">draft-eagle</option>
                    </select>
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
              )}
            </div>

          </div>
        )}
      </div>

      {/* Extra CLI Arguments (KV Quantization Presets) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">Дополнительные CLI флаги (Custom Args)</label>
            <InfoTooltip
              title="Дополнительные CLI флаги"
              text="Прямые параметры командной строки llama.cpp. Например, квантование контекста -ctk q8_0 -ctv q8_0 экономит до 50% видеопамяти VRAM."
              benefit="Квантование KV-кэша удваивает доступный контекст"
            />
          </div>
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

      {/* Switches Grid with Apple-Style Subtitles and Info Popovers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--theme-border)]">
        {toggleItems.map((item, i) => (
          <div
            key={i}
            onClick={item.toggle}
            className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
              item.value
                ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] shadow-sm'
                : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <div className="space-y-0.5 pr-2">
              <div className="flex items-center">
                <span className="text-[11px] font-bold text-[var(--theme-text)]">{item.label}</span>
                <InfoTooltip title={item.helpTitle} text={item.helpText} benefit={item.benefit} />
              </div>
              <p className="text-[10px] text-[var(--theme-text-muted)] line-clamp-1">{item.sub}</p>
            </div>

            <div
              className={`w-8 h-4.5 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
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
