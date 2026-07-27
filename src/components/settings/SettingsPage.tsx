import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Palette, Cpu, Check, RefreshCw, ChevronLeft, Shield, User } from 'lucide-react';
import { AppConfig } from '../../types';
import { GeneralTab } from './GeneralTab';
import { PersonasTab } from './PersonasTab';
import { ThemesTab } from './ThemesTab';
import { LocalServerTab } from './LocalServerTab';
import { SecurityTab } from './SecurityTab';

interface SettingsPageProps {
  config: AppConfig | null;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
  onCancel: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  config,
  onSaveConfig,
  onCancel,
}) => {
  const [activeSubtab, setActiveSubtab] = useState<'general' | 'personas' | 'themes' | 'local_server' | 'security'>('general');

  // General state
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [modelsPath, setModelsPath] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [planningEnabled, setPlanningEnabled] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [apiTimeoutSec, setApiTimeoutSec] = useState(120);
  const [autoSaveHistory, setAutoSaveHistory] = useState(true);
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [compactChat, setCompactChat] = useState(false);

  // Active theme state
  const [activeTheme, setActiveTheme] = useState<'obsidian' | 'cyber' | 'graphite' | 'matrix'>('obsidian');

  // Local Server state matching user screenshot baseline defaults
  const [exePath, setExePath] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(11434);
  const [ctxSize, setCtxSize] = useState(65536);
  const [threads, setThreads] = useState(12);
  const [gpuLayers, setGpuLayers] = useState(99);
  const [temp, setTemp] = useState(1.05);
  const [batchSize, setBatchSize] = useState(2048);
  const [ubatchSize, setUbatchSize] = useState(512);
  const [minP, setMinP] = useState(0.08);
  const [topK, setTopK] = useState(40);
  const [topP, setTopP] = useState(1);
  const [predict, setPredict] = useState(4264);
  const [repeatPenalty, setRepeatPenalty] = useState(1.1);
  const [flashAttn, setFlashAttn] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [contBatching, setContBatching] = useState(true);
  const [promptCache, setPromptCache] = useState(true);
  const [mlock, setMlock] = useState(false);
  const [mmap, setMmap] = useState(true);
  const [parallelSlots, setParallelSlots] = useState(2);
  const [cacheReuse, setCacheReuse] = useState(256);
  const [slotSavePath, setSlotSavePath] = useState('');
  const [customArgs, setCustomArgs] = useState('');

  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'checking'>('stopped');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [serverLogsAutoScroll, setServerLogsAutoScroll] = useState(true);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const isInitialMount = useRef(true);

  // Populate state on config change
  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url || 'http://127.0.0.1:11434/v1');
      setModelName(config.model_name || 'qwen2.5-coder:7b');
      setGroqApiKey(config.groq_api_key || '');
      setModelsPath(config.models_path || '');
      setReasoningEnabled(config.reasoning_enabled !== false);
      setPlanningEnabled(config.planning_mode !== false);
      if (config.temperature !== undefined && config.temperature !== null) setTemperature(config.temperature);
      if (config.max_tokens) setMaxTokens(config.max_tokens);
      if (config.api_timeout_sec) setApiTimeoutSec(config.api_timeout_sec);
      if (config.auto_save_history !== undefined && config.auto_save_history !== null) setAutoSaveHistory(config.auto_save_history);
      if (config.sound_notifications !== undefined && config.sound_notifications !== null) setSoundNotifications(config.sound_notifications);
      if (config.compact_chat !== undefined && config.compact_chat !== null) setCompactChat(config.compact_chat);

      const theme = (config.active_theme as any) || 'obsidian';
      setActiveTheme(theme);
      document.documentElement.setAttribute('data-theme', theme);

      if (config.local_server) {
        const ls = config.local_server;
        if (ls.exe_path) setExePath(ls.exe_path);
        if (ls.model_path) setModelPath(ls.model_path);
        if (ls.host) setHost(ls.host);
        if (ls.port) setPort(ls.port);
        if (ls.ctx_size) setCtxSize(ls.ctx_size);
        if (ls.threads) setThreads(ls.threads);
        if (ls.gpu_layers !== undefined && ls.gpu_layers !== null) setGpuLayers(ls.gpu_layers);
        if (ls.temp !== undefined && ls.temp !== null) setTemp(ls.temp);
        if (ls.batch_size) setBatchSize(ls.batch_size);
        if (ls.ubatch_size) setUbatchSize(ls.ubatch_size);
        if (ls.min_p !== undefined && ls.min_p !== null) setMinP(ls.min_p);
        if (ls.top_k !== undefined && ls.top_k !== null) setTopK(ls.top_k);
        if (ls.top_p !== undefined && ls.top_p !== null) setTopP(ls.top_p);
        if (ls.predict !== undefined && ls.predict !== null) setPredict(ls.predict);
        if (ls.repeat_penalty !== undefined && ls.repeat_penalty !== null) setRepeatPenalty(ls.repeat_penalty);
        if (ls.flash_attn !== undefined && ls.flash_attn !== null) setFlashAttn(ls.flash_attn);
        if (ls.embedding !== undefined && ls.embedding !== null) setEmbedding(ls.embedding);
        if (ls.cont_batching !== undefined && ls.cont_batching !== null) setContBatching(ls.cont_batching);
        if (ls.prompt_cache !== undefined && ls.prompt_cache !== null) setPromptCache(ls.prompt_cache);
        if (ls.mlock !== undefined && ls.mlock !== null) setMlock(ls.mlock);
        if (ls.mmap !== undefined && ls.mmap !== null) setMmap(ls.mmap);
        if (ls.parallel_slots !== undefined && ls.parallel_slots !== null) setParallelSlots(ls.parallel_slots);
        if (ls.cache_reuse !== undefined && ls.cache_reuse !== null) setCacheReuse(ls.cache_reuse);
        if (ls.slot_save_path) setSlotSavePath(ls.slot_save_path);
        if (ls.custom_args) setCustomArgs(ls.custom_args);
      }
    }
  }, [config]);

  // AUTOMATIC DEBOUNCED SAVE ON STATE CHANGE
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      if (!config) return;
      try {
        await onSaveConfig({
          ...config,
          api_url: apiUrl,
          model_name: modelName,
          groq_api_key: groqApiKey.trim() || null,
          models_path: modelsPath.trim() || null,
          reasoning_enabled: reasoningEnabled,
          planning_mode: planningEnabled,
          temperature,
          max_tokens: maxTokens,
          api_timeout_sec: apiTimeoutSec,
          auto_save_history: autoSaveHistory,
          sound_notifications: soundNotifications,
          compact_chat: compactChat,
          active_theme: activeTheme,
          local_server: {
            exe_path: exePath.trim() || null,
            model_path: modelPath.trim() || null,
            host,
            port,
            ctx_size: ctxSize,
            threads,
            gpu_layers: gpuLayers,
            temp,
            batch_size: batchSize,
            ubatch_size: ubatchSize,
            min_p: minP,
            top_k: topK,
            top_p: topP,
            predict,
            repeat_penalty: repeatPenalty,
            flash_attn: flashAttn,
            embedding,
            cont_batching: contBatching,
            prompt_cache: promptCache,
            mlock,
            mmap,
            parallel_slots: parallelSlots,
            cache_reuse: cacheReuse,
            slot_save_path: slotSavePath.trim() || null,
            custom_args: customArgs.trim() || null,
          },
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    apiUrl,
    modelName,
    groqApiKey,
    modelsPath,
    reasoningEnabled,
    temperature,
    maxTokens,
    apiTimeoutSec,
    autoSaveHistory,
    soundNotifications,
    compactChat,
    activeTheme,
    exePath,
    modelPath,
    host,
    port,
    ctxSize,
    threads,
    gpuLayers,
    temp,
    batchSize,
    ubatchSize,
    minP,
    topK,
    topP,
    predict,
    repeatPenalty,
    flashAttn,
    embedding,
    contBatching,
    promptCache,
    mlock,
    mmap,
    parallelSlots,
    cacheReuse,
    slotSavePath,
    customArgs,
  ]);

  const handleSelectTheme = (theme: 'obsidian' | 'cyber' | 'graphite' | 'matrix') => {
    setActiveTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  return (
    <div className="w-full h-full bg-scifi-grid text-slate-100 flex flex-col overflow-hidden font-sans select-text">
      {/* Settings Top Header Bar */}
      <div className="px-4 py-3 border-b border-white/10 glass-panel flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flat-btn p-1.5 rounded-md text-slate-400 hover:text-white cursor-pointer"
            title="Вернуться в чат"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-semibold text-slate-100">Настройки приложения</h2>
        </div>

        {/* Auto-save Indicator */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-900/60 px-3 py-1 rounded-md border border-white/10">
          {saveStatus === 'saving' ? (
            <>
              <RefreshCw size={12} className="animate-spin text-sky-400" />
              <span>Сохранение...</span>
            </>
          ) : (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-slate-300">Сохранено</span>
            </>
          )}
        </div>
      </div>

      {/* Main Settings Layout (Sidebar Navigation + Right Content Panel) */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        {/* Left Vertical Navigation Menu */}
        <div className="w-full md:w-56 glass-panel border-r border-white/10 p-3 shrink-0 flex flex-row md:flex-col gap-1 select-none overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSubtab('general')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              activeSubtab === 'general'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Sliders size={14} className={activeSubtab === 'general' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Основные</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubtab('personas')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              activeSubtab === 'personas'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <User size={14} className={activeSubtab === 'personas' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Личности (Personas)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubtab('themes')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              activeSubtab === 'themes'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Palette size={14} className={activeSubtab === 'themes' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Темы оформления</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubtab('local_server')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              activeSubtab === 'local_server'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Cpu size={14} className={activeSubtab === 'local_server' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Сервер LLM</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubtab('security')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              activeSubtab === 'security'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Shield size={14} className={activeSubtab === 'security' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Безопасность</span>
          </button>
        </div>

        {/* Right Scrollable Content Panel (pb-28 prevents overlapping with bottom navigation bar) */}
        <div className="flex-1 h-full overflow-y-auto p-4 md:p-8 pb-28 scrollbar-none">
          {activeSubtab === 'general' && (
            <GeneralTab
              apiUrl={apiUrl}
              setApiUrl={setApiUrl}
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              reasoningEnabled={reasoningEnabled}
              setReasoningEnabled={setReasoningEnabled}
              autoSaveHistory={autoSaveHistory}
              setAutoSaveHistory={setAutoSaveHistory}
              soundNotifications={soundNotifications}
              setSoundNotifications={setSoundNotifications}
              compactChat={compactChat}
              setCompactChat={setCompactChat}
            />
          )}

          {activeSubtab === 'personas' && (
            <PersonasTab />
          )}

          {activeSubtab === 'themes' && (
            <ThemesTab
              activeTheme={activeTheme}
              onSelectTheme={handleSelectTheme}
            />
          )}

          {activeSubtab === 'local_server' && (
            <LocalServerTab
              exePath={exePath}
              setExePath={setExePath}
              modelPath={modelPath}
              setModelPath={setModelPath}
              host={host}
              setHost={setHost}
              port={port}
              setPort={setPort}
              ctxSize={ctxSize}
              setCtxSize={setCtxSize}
              threads={threads}
              setThreads={setThreads}
              gpuLayers={gpuLayers}
              setGpuLayers={setGpuLayers}
              temp={temp}
              setTemp={setTemp}
              batchSize={batchSize}
              setBatchSize={setBatchSize}
              ubatchSize={ubatchSize}
              setUbatchSize={setUbatchSize}
              minP={minP}
              setMinP={setMinP}
              topK={topK}
              setTopK={setTopK}
              topP={topP}
              setTopP={setTopP}
              predict={predict}
              setPredict={setPredict}
              repeatPenalty={repeatPenalty}
              setRepeatPenalty={setRepeatPenalty}
              flashAttn={flashAttn}
              setFlashAttn={setFlashAttn}
              embedding={embedding}
              setEmbedding={setEmbedding}
              contBatching={contBatching}
              setContBatching={setContBatching}
              promptCache={promptCache}
              setPromptCache={setPromptCache}
              mlock={mlock}
              setMlock={setMlock}
              mmap={mmap}
              setMmap={setMmap}
              parallelSlots={parallelSlots}
              setParallelSlots={setParallelSlots}
              cacheReuse={cacheReuse}
              setCacheReuse={setCacheReuse}
              slotSavePath={slotSavePath}
              setSlotSavePath={setSlotSavePath}
              customArgs={customArgs}
              setCustomArgs={setCustomArgs}
              serverStatus={serverStatus}
              setServerStatus={setServerStatus}
              serverLogs={serverLogs}
              setServerLogs={setServerLogs}
              serverLogsAutoScroll={serverLogsAutoScroll}
              setServerLogsAutoScroll={setServerLogsAutoScroll}
              setApiUrl={setApiUrl}
            />
          )}

          {activeSubtab === 'security' && (
            <SecurityTab />
          )}
        </div>
      </div>
    </div>
  );
};
