import { useState, useEffect, useRef } from 'react';
import { AppConfig, AppTheme } from '../../types';

export function useSettingsState(
  config: AppConfig | null,
  onSaveConfig: (updated: AppConfig) => Promise<void>
) {
  const [activeSubtab, setActiveSubtab] = useState<'general' | 'personas' | 'themes' | 'local_server'>('general');

  // General state
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [modelsPath, setModelsPath] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [planningEnabled, setPlanningEnabled] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [apiTimeoutSec, setApiTimeoutSec] = useState(120);
  const [autoSaveHistory, setAutoSaveHistory] = useState(true);
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [compactChat, setCompactChat] = useState(false);
  const [ttsVoiceEnabled, setTtsVoiceEnabled] = useState(true);
  const [ttsVoice, setTtsVoice] = useState('ru-RU-DmitryNeural');
  const [ttsRate, setTtsRate] = useState('+15%');
  const [ttsPitch, setTtsPitch] = useState('-5Hz');
  const [ttsPlayOnSpeaker, setTtsPlayOnSpeaker] = useState(true);
  const [ttsPlayInBrowser, setTtsPlayInBrowser] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [proactiveCompanionEnabled, setProactiveCompanionEnabled] = useState(true);

  // Active theme state
  const [activeTheme, setActiveTheme] = useState<AppTheme>('obsidian');

  // Local Server state
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
      setModelName(config.model_name || 'gemini-3.6-flash');
      setGroqApiKey(config.groq_api_key || '');
      setGeminiApiKey(config.gemini_api_key || '');
      setModelsPath(config.models_path || '');
      setReasoningEnabled(config.reasoning_enabled !== false);
      setPlanningEnabled(config.planning_mode !== false);
      if (config.temperature !== undefined && config.temperature !== null) setTemperature(config.temperature);
      if (config.max_tokens) setMaxTokens(config.max_tokens);
      if (config.api_timeout_sec) setApiTimeoutSec(config.api_timeout_sec);
      if (config.auto_save_history !== undefined && config.auto_save_history !== null) setAutoSaveHistory(config.auto_save_history);
      if (config.sound_notifications !== undefined && config.sound_notifications !== null) setSoundNotifications(config.sound_notifications);
      if (config.compact_chat !== undefined && config.compact_chat !== null) setCompactChat(config.compact_chat);

      if (config.tts_config) {
        if (config.tts_config.enabled !== undefined && config.tts_config.enabled !== null) setTtsVoiceEnabled(config.tts_config.enabled);
        if (config.tts_config.voice) setTtsVoice(config.tts_config.voice);
        if (config.tts_config.rate) setTtsRate(config.tts_config.rate);
        if (config.tts_config.pitch) setTtsPitch(config.tts_config.pitch);
        if (config.tts_config.play_on_speaker !== undefined) setTtsPlayOnSpeaker(config.tts_config.play_on_speaker);
        if (config.tts_config.play_in_browser !== undefined) setTtsPlayInBrowser(config.tts_config.play_in_browser);
        if (config.tts_config.wake_word_enabled !== undefined) setWakeWordEnabled(config.tts_config.wake_word_enabled);
      }
      if (config.proactive_companion_enabled !== undefined && config.proactive_companion_enabled !== null) {
        setProactiveCompanionEnabled(config.proactive_companion_enabled);
      }

      const theme = (config.active_theme as AppTheme) || 'obsidian';
      setActiveTheme(theme);
      document.documentElement.setAttribute('data-theme', theme);

      if (config.local_server) {
        const ls = config.local_server;
        if (ls.exe_path !== undefined && ls.exe_path !== null) setExePath(ls.exe_path);
        if (ls.model_path !== undefined && ls.model_path !== null) setModelPath(ls.model_path);
        if (ls.host) setHost(ls.host);
        if (ls.port !== undefined && ls.port !== null) setPort(ls.port);
        if (ls.ctx_size !== undefined && ls.ctx_size !== null) setCtxSize(ls.ctx_size);
        if (ls.threads !== undefined && ls.threads !== null) setThreads(ls.threads);
        if (ls.gpu_layers !== undefined && ls.gpu_layers !== null) setGpuLayers(ls.gpu_layers);
        if (ls.temp !== undefined && ls.temp !== null) setTemp(ls.temp);
        if (ls.batch_size !== undefined && ls.batch_size !== null) setBatchSize(ls.batch_size);
        if (ls.ubatch_size !== undefined && ls.ubatch_size !== null) setUbatchSize(ls.ubatch_size);
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
        if (ls.slot_save_path !== undefined && ls.slot_save_path !== null) setSlotSavePath(ls.slot_save_path);
        if (ls.custom_args !== undefined && ls.custom_args !== null) setCustomArgs(ls.custom_args);
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
          gemini_api_key: geminiApiKey.trim() || null,
          models_path: modelsPath.trim() || null,
          reasoning_enabled: reasoningEnabled,
          planning_mode: planningEnabled,
          temperature,
          max_tokens: maxTokens,
          api_timeout_sec: apiTimeoutSec,
          auto_save_history: autoSaveHistory,
          sound_notifications: soundNotifications,
          compact_chat: compactChat,
          tts_config: {
            enabled: ttsVoiceEnabled,
            voice: ttsVoice,
            rate: ttsRate,
            pitch: ttsPitch,
            play_on_speaker: ttsPlayOnSpeaker,
            play_in_browser: ttsPlayInBrowser,
            wake_word_enabled: wakeWordEnabled,
          },
          proactive_companion_enabled: proactiveCompanionEnabled,
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
    geminiApiKey,
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

  const handleSelectTheme = (theme: AppTheme) => {
    setActiveTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  return {
    activeSubtab,
    setActiveSubtab,
    apiUrl,
    setApiUrl,
    modelName,
    setModelName,
    groqApiKey,
    setGroqApiKey,
    geminiApiKey,
    setGeminiApiKey,
    modelsPath,
    setModelsPath,
    reasoningEnabled,
    setReasoningEnabled,
    planningEnabled,
    setPlanningEnabled,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    apiTimeoutSec,
    setApiTimeoutSec,
    autoSaveHistory,
    setAutoSaveHistory,
    soundNotifications,
    setSoundNotifications,
    compactChat,
    setCompactChat,
    ttsVoiceEnabled,
    setTtsVoiceEnabled,
    ttsVoice,
    setTtsVoice,
    ttsRate,
    setTtsRate,
    ttsPitch,
    setTtsPitch,
    ttsPlayOnSpeaker,
    setTtsPlayOnSpeaker,
    ttsPlayInBrowser,
    setTtsPlayInBrowser,
    wakeWordEnabled,
    setWakeWordEnabled,
    proactiveCompanionEnabled,
    setProactiveCompanionEnabled,
    activeTheme,
    handleSelectTheme,
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
    parallelSlots,
    setParallelSlots,
    cacheReuse,
    setCacheReuse,
    slotSavePath,
    setSlotSavePath,
    customArgs,
    setCustomArgs,
    serverStatus,
    setServerStatus,
    serverLogs,
    setServerLogs,
    serverLogsAutoScroll,
    setServerLogsAutoScroll,
    saveStatus,
  };
}
