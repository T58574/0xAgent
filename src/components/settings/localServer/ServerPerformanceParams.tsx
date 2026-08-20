import React from 'react';
import { Zap, Folder, Sparkles } from 'lucide-react';
import { LocalModelItem, GgufMetadata } from '../../../types';
import {
  InfoTooltip,
  ParamNumberInput,
  ParamTextInput,
  ParamSlider,
  ParamToggleCard,
} from './atoms';

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
  modelMeta?: GgufMetadata | null;
  serverStatus?: 'stopped' | 'running' | 'checking';
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
  specDraftNgl: _specDraftNgl,
  setSpecDraftNgl,
  specDraftNMax: _specDraftNMax,
  setSpecDraftNMax,
  specDraftPMin: _specDraftPMin,
  setSpecDraftPMin,
  jinja,
  setJinja,
  reasoningPreserve,
  setReasoningPreserve,
  reasoningFormat: _reasoningFormat,
  setReasoningFormat: _setReasoningFormat,
  scannedDraftModels: _scannedDraftModels = [],
  onSelectDraftModelFile: _onSelectDraftModelFile,
  onSelectSlotSavePath,
  onApplyFastPreset,
  onApplyFastMtpPreset,
  modelMeta,
  serverStatus: _serverStatus,
}) => {
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
      sub: 'Ускорение внимания на GPU',
      tooltip: {
        title: 'Flash Attention (-fa)',
        text: 'Оптимизирует вычисление слоя внимания в VRAM. Ускоряет генерацию в 1.5–2 раза и снижает нагрев видеокарты.',
        benefit: '+50-100% к скорости генерации',
      },
      value: flashAttn,
      toggle: () => setFlashAttn(!flashAttn),
    },
    {
      label: 'Jinja Template (--jinja)',
      sub: 'Шаблоны промптов и мыслей',
      tooltip: {
        title: 'Jinja Template (--jinja)',
        text: 'Включает нативный рендеринг системных шаблонов чата и формата рассуждений для современных моделей (Qwen, DeepSeek).',
        benefit: 'Идеальное форматирование мыслей',
      },
      value: jinja,
      toggle: () => setJinja(!jinja),
    },
    {
      label: 'Preserve Reasoning',
      sub: 'Отображение хода мыслей',
      tooltip: {
        title: 'Preserve Reasoning',
        text: 'Сохраняет и выводит цепочку мыслей <think>...</think> в интерфейсе чата, позволяя видеть логику агента перед кодом.',
        benefit: 'Прозрачность решений ассистента',
      },
      value: reasoningPreserve,
      toggle: () => setReasoningPreserve(!reasoningPreserve),
    },
    {
      label: 'Prompt Cache',
      sub: 'Кэширование истории в ОЗУ',
      tooltip: {
        title: 'Prompt Cache',
        text: 'Сохраняет неизменную часть системного промпта и контекста в оперативной памяти, избавляя от повторного чтения при каждом вопросе.',
        benefit: 'Мгновенный старт генерации',
      },
      value: promptCache,
      toggle: () => setPromptCache(!promptCache),
    },
    {
      label: 'Use Memory Map (--mmap)',
      sub: 'Быстрая загрузка файла модели',
      tooltip: {
        title: 'Memory Map (--mmap)',
        text: 'Загружает модель напрямую через виртуальную память Windows без полного дублирования файла в оперативную память.',
        benefit: 'Запуск сервера за 1–2 секунды',
      },
      value: mmap,
      toggle: () => setMmap(!mmap),
    },
    {
      label: 'Lock Memory (--mlock)',
      sub: 'Запрет сброса в файл подкачки',
      tooltip: {
        title: 'Lock Memory (--mlock)',
        text: 'Блокирует память модели в физической RAM, запрещая Windows сбрасывать её на жесткий диск/SSD при нехватке памяти.',
        benefit: 'Защита от фризов при нагрузке',
      },
      value: mlock,
      toggle: () => setMlock(!mlock),
    },
    {
      label: 'Continuous Batching',
      sub: 'Параллельная обработка запросов',
      tooltip: {
        title: 'Continuous Batching',
        text: 'Позволяет серверу обрабатывать новые входящие запросы в фоне без блокировки главного потока.',
        benefit: 'Многозадачность без ожидания',
      },
      value: contBatching,
      toggle: () => setContBatching(!contBatching),
    },
    {
      label: 'Embeddings Output',
      sub: 'Векторные эмбеддинги',
      tooltip: {
        title: 'Embeddings Output',
        text: 'Включает генерацию числовых векторных представлений текста для семантического поиска по коду и памяти.',
        benefit: 'Векторный поиск по проекту',
      },
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
              <span>Пресет MTP / Draft</span>
            </button>
          )}
          <button
            type="button"
            onClick={onApplyFastPreset}
            className="px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:bg-[var(--theme-panel)] text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
          >
            <Zap size={13} className="text-[var(--theme-text-muted)]" />
            <span>Быстрый пресет (Flash Attention)</span>
          </button>
        </div>
      </div>

      {/* Host & Port */}
      <div className="grid grid-cols-2 gap-3">
        <ParamTextInput
          label="Host (IP-адрес)"
          value={host}
          onChange={setHost}
          tooltip={{
            title: 'Host (Сетевой адрес)',
            text: 'IP-адрес, на котором локальный сервер слушает входящие запросы. 127.0.0.1 доступен только с вашего ПК, 0.0.0.0 открывает доступ в локальной сети.',
            benefit: 'Локальная изоляция или раздача по LAN',
          }}
        />
        <ParamNumberInput
          label="Port (Порт)"
          value={port}
          onChange={setPort}
          tooltip={{
            title: 'Port (Сетевой порт)',
            text: 'Сетевой порт API сервера. По умолчанию 11434 (стандарт OpenAI/Ollama) или 8080.',
          }}
        />
      </div>

      {/* Context Size -c with quick presets */}
      <ParamSlider
        label="Размер контекста (-c)"
        value={ctxSize}
        onChange={setCtxSize}
        min={512}
        max={131072}
        step={512}
        presets={CTX_PRESETS}
        tooltip={{
          title: 'Размер контекста (-c)',
          text: 'Максимальное количество токенов истории диалога и кода, которые модель может удерживать в памяти одновременно.',
          benefit: '16k–32k достаточно для 95% проектов',
        }}
      />

      {/* GPU Layers & CPU Threads */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <ParamNumberInput
          label="GPU Layers (-ngl)"
          value={gpuLayers}
          onChange={setGpuLayers}
          tooltip={{
            title: 'Слои GPU (-ngl)',
            text: 'Сколько слоев нейросети выгрузить в видеопамять (VRAM). Значение 99 выгружает всю модель на видеокарту для максимальной скорости.',
            benefit: 'Максимальная скорость на GPU',
          }}
        />
        <ParamNumberInput
          label="CPU Threads (-t)"
          value={threads}
          min={0}
          placeholder="0 = Авто"
          badge={threads === 0 ? 'Авто' : `${threads} потоков`}
          onChange={setThreads}
          tooltip={{
            title: 'Потоки процессора (-t)',
            text: 'Количество потоков CPU для вычислений. 0 — автоматический подбор под физические ядра вашего процессора.',
          }}
        />
      </div>

      {/* Batch & Micro-Batch */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <ParamNumberInput
          label="Batch Size (-b)"
          value={batchSize}
          onChange={setBatchSize}
          tooltip={{
            title: 'Размер батча (-b)',
            text: 'Размер пакета токенов для одновременной обработки промпта. Значение 2048 оптимально для быстрого чтения длинного кода.',
          }}
        />
        <ParamNumberInput
          label="Micro-Batch (-ub)"
          value={ubatchSize}
          onChange={setUbatchSize}
          tooltip={{
            title: 'Микро-батч (-ub)',
            text: 'Размер подпакета вычислений внутри VRAM. 512 обеспечивает идеальный баланс между скоростью и экономией видеопамяти.',
          }}
        />
      </div>

      {/* Temperature & Predict */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <ParamNumberInput
          label="Температура (Креативность)"
          value={temp}
          min={0}
          max={2}
          step={0.05}
          badge={temp.toFixed(2)}
          onChange={setTemp}
          tooltip={{
            title: 'Температура',
            text: 'Степень случайности и креативности модели. Для программирования рекомендуется 0.2–0.7 (строгая логика), для идей — 0.8–1.0.',
          }}
        />
        <ParamNumberInput
          label="Макс. токенов ответа (-n)"
          value={predict}
          placeholder="-1 = Без лимита"
          onChange={setPredict}
          tooltip={{
            title: 'Лимит токенов ответа (-n)',
            text: 'Максимальная длина одного ответа модели. -1 или большие значения позволяют писать длинные файлы без обрезки.',
          }}
        />
      </div>

      {/* Sampling Parameters: Min-P, Top-K, Top-P, Repeat Penalty */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <ParamNumberInput
          label="Min-P"
          value={minP}
          min={0}
          max={1}
          step={0.01}
          onChange={setMinP}
          tooltip={{
            title: 'Min-P сэмплинг',
            text: 'Отсекает маловероятные токены относительно самого вероятного. Значение 0.05 отсекает мусорные варианты и защищает от галлюцинаций.',
          }}
        />
        <ParamNumberInput
          label="Top-K"
          value={topK}
          onChange={setTopK}
          tooltip={{
            title: 'Top-K сэмплинг',
            text: 'Ограничивает выборку K наиболее вероятными токенами на каждом шаге генерации. 20–40 идеально для точного кода.',
          }}
        />
        <ParamNumberInput
          label="Top-P"
          value={topP}
          min={0}
          max={1}
          step={0.01}
          onChange={setTopP}
          tooltip={{
            title: 'Top-P (Nucleus Sampling)',
            text: 'Суммарная вероятность пула токенов для выбора. 0.95 сохраняет вариативность языка без потери строгости.',
          }}
        />
        <ParamNumberInput
          label="Штраф повторов"
          value={repeatPenalty}
          min={1}
          max={2}
          step={0.05}
          onChange={setRepeatPenalty}
          tooltip={{
            title: 'Штраф за повторы (Repeat Penalty)',
            text: 'Предотвращает зацикливание модели на одних и тех же словах. Для кода рекомендуется 1.0 (без штрафа, чтобы не ломать синтаксис).',
          }}
        />
      </div>

      {/* Parallel Slots & Cache Reuse */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <ParamNumberInput
          label="Параллельные слоты (-np)"
          value={parallelSlots}
          min={1}
          max={8}
          onChange={setParallelSlots}
          tooltip={{
            title: 'Параллельные слоты (-np)',
            text: 'Количество одновременно обрабатываемых диалогов. Для персонального локального использования рекомендуется строго 1 слот для экономии VRAM.',
            benefit: '1 слот экономит до 70% видеопамяти',
          }}
        />
        <ParamNumberInput
          label="Cache Reuse (KV Chunk)"
          value={cacheReuse}
          onChange={setCacheReuse}
          tooltip={{
            title: 'Повторное использование кэша',
            text: 'Минимальный размер блока кэша для переиспользования между запросами. 256 ускоряет повторные запросы.',
          }}
        />
      </div>

      {/* Slot Save Path */}
      <ParamTextInput
        label="Папка сохранения слотов (--slot-save-path)"
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
            <span>Обзор...</span>
          </button>
        }
        tooltip={{
          title: 'Сохранение состояния слотов',
          text: 'Путь к директории, в которую сервер сохраняет состояние KV-кэша для мгновенного восстановления контекста после перезагрузки.',
        }}
      />

      {/* 🚀 MINIMALIST SPECULATIVE ACCELERATION (MTP) SECTION */}
      <div className="p-4 rounded-3xl bento-card space-y-3 border border-[var(--theme-border)] bg-[var(--theme-panel)]/80 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--theme-accent)]" />
              <span className="text-xs font-bold text-[var(--theme-text)]">
                Ускорение генерации (MTP)
              </span>
              <InfoTooltip
                title="Аппаратное MTP ускорение"
                text="Спекулятивное декодирование токенов за 1 шаг GPU. Для моделей со встроенными MTP-слоями ускорение работает нативно на весах основной модели без дополнительных файлов."
                benefit="Спекулятивное предсказание токенов за шаг"
              />
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)]">
              Аппаратное предугадывание следующих токенов через встроенный MTP-слой модели
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleMtp}
            className={`w-12 h-6.5 rounded-full p-1 flex items-center transition-all cursor-pointer shrink-0 shadow-inner ${
              isMtpEnabled ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
            title={isMtpEnabled ? 'Отключить MTP ускорение' : 'Включить MTP ускорение'}
          >
            <div
              className={`w-4.5 h-4.5 rounded-full bg-white transition-transform shadow-md ${
                isMtpEnabled ? 'translate-x-5.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {isMtpEnabled && (
          <div className="pt-2 border-t border-[var(--theme-border)] animate-fadeIn">
            {modelMeta?.supportsFastMtp ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <Zap size={14} className="animate-pulse text-emerald-500" />
                  <span>Встроенный MTP-слой активен (Native draft-mtp)</span>
                </div>
                <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                  Определены аппаратные MTP-головы (<code className="font-mono text-emerald-600 dark:text-emerald-300 font-semibold">nextn_predict_layers = 1</code>). Ускорение работает нативно на весах модели.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <Zap size={14} className="text-emerald-500" />
                  <span>Спекулятивное ускорение активно</span>
                </div>
                <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                  Аппаратное предугадывание следующих токенов включено.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extra CLI Arguments (KV Quantization Presets) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center">
            <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">
              Дополнительные CLI флаги (Custom Args)
            </label>
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
  );
};
