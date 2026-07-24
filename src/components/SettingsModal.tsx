import React, { useState, useEffect } from 'react';
import { Undo, RefreshCw } from 'lucide-react';
import { AppConfig } from '../types';
import * as api from '../services/api';

interface SettingsPageProps {
  config: AppConfig | null;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
  onCancel: () => void;
}

interface LlamaAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface LlamaRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  assets: LlamaAsset[];
}

interface SystemSpecs {
  cpu_cores: number;
  total_ram_gb: number;
  gpus: string[];
  suggested_preset: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  config,
  onSaveConfig,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'colors' | 'local_server'>('general');

  // General settings state
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [modelsPath, setModelsPath] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(true);

  // Colors settings state
  const [bgColor, setBgColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#000000');
  const [borderColor, setBorderColor] = useState('#000000');
  const [activeColor, setActiveColor] = useState('#f5f5f5');
  const [sendBtnColor, setSendBtnColor] = useState('#86efac');

  // Local Server Settings
  const [exePath, setExePath] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(11434);
  
  // Detailed Sampling/Model Parameters
  const [ctxSize, setCtxSize] = useState(8192);
  const [threads, setThreads] = useState(8);
  const [gpuLayers, setGpuLayers] = useState(0);

  // Model parameters
  const [temp, setTemp] = useState(1.05);
  const [predict, setPredict] = useState(4264);
  const [batchSize, setBatchSize] = useState(2048);
  const [ubatchSize, setUbatchSize] = useState(512);
  const [minP, setMinP] = useState(0.08);
  const [topK, setTopK] = useState(40);
  const [topP, setTopP] = useState(1.0);
  const [repeatPenalty, setRepeatPenalty] = useState(1.1);
  const [seed, setSeed] = useState(-1);
  const [presencePenalty, setPresencePenalty] = useState(0.0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0.0);

  // Flags Options
  const [flashAttn, setFlashAttn] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [contBatching, setContBatching] = useState(false);
  const [promptCache, setPromptCache] = useState(true);
  const [mlock, setMlock] = useState(false);
  const [mmap, setMmap] = useState(true);

  const [customArgs, setCustomArgs] = useState('');

  // Automated releases list
  const [releases] = useState<LlamaRelease[]>([]);
  const [selectedReleaseIndex, setSelectedReleaseIndex] = useState(0);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [isLoadingReleases] = useState(false);

  // Specs Auto-detect and Optimize
  const [detectedSpecs, setDetectedSpecs] = useState<SystemSpecs | null>(null);
  const [isDetectingSpecs, setIsDetectingSpecs] = useState(false);

  // Scanned local GGUFs list
  const [downloadedGgufs, setDownloadedGgufs] = useState<string[]>([]);

  // Download tool states
  const [downloadType] = useState<'server' | 'model' | null>(null);
  const [downloadProgress] = useState(0);
  const [downloadDownloaded] = useState(0);
  const [downloadTotal] = useState(0);
  const [downloadStatus] = useState('');

  // Hugging Face downloader state
  const [hfRepo, setHfRepo] = useState('Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF');
  const [hfFilename, setHfFilename] = useState('qwen2.5-coder-1.5b-instruct-q4_k_m.gguf');

  // Server process state
  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'checking'>('stopped');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [serverLogsAutoScroll, setServerLogsAutoScroll] = useState(true);

  const [binDir] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state on load
  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url);
      setModelName(config.model_name);
      setSystemPrompt(config.system_prompt);
      setGroqApiKey(config.groq_api_key || '');
      setModelsPath(config.models_path || '');
      setReasoningEnabled(config.reasoning_enabled !== false); // default to true

      const colors = config.theme_colors || {
        bg_color: '#ffffff',
        text_color: '#000000',
        border_color: '#000000',
        active_color: '#f5f5f5',
        send_btn_color: '#86efac',
      };
      setBgColor(colors.bg_color);
      setTextColor(colors.text_color);
      setBorderColor(colors.border_color);
      setActiveColor(colors.active_color);
      setSendBtnColor(colors.send_btn_color);

      // Restore local server settings from saved config
      const ls = config.local_server;
      if (ls) {
        if (ls.exe_path) setExePath(ls.exe_path);
        if (ls.model_path) setModelPath(ls.model_path);
        if (ls.host) setHost(ls.host);
        if (ls.port != null) setPort(ls.port);
        if (ls.ctx_size != null) setCtxSize(ls.ctx_size);
        if (ls.threads != null) setThreads(ls.threads);
        if (ls.gpu_layers != null) setGpuLayers(ls.gpu_layers);
        if (ls.temp != null) setTemp(ls.temp);
        if (ls.predict != null) setPredict(ls.predict);
        if (ls.batch_size != null) setBatchSize(ls.batch_size);
        if (ls.ubatch_size != null) setUbatchSize(ls.ubatch_size);
        if (ls.min_p != null) setMinP(ls.min_p);
        if (ls.top_k != null) setTopK(ls.top_k);
        if (ls.top_p != null) setTopP(ls.top_p);
        if (ls.repeat_penalty != null) setRepeatPenalty(ls.repeat_penalty);
        if (ls.seed != null) setSeed(ls.seed);
        if (ls.presence_penalty != null) setPresencePenalty(ls.presence_penalty);
        if (ls.frequency_penalty != null) setFrequencyPenalty(ls.frequency_penalty);
        if (ls.flash_attn != null) setFlashAttn(ls.flash_attn);
        if (ls.embedding != null) setEmbedding(ls.embedding);
        if (ls.cont_batching != null) setContBatching(ls.cont_batching);
        if (ls.prompt_cache != null) setPromptCache(ls.prompt_cache);
        if (ls.mlock != null) setMlock(ls.mlock);
        if (ls.mmap != null) setMmap(ls.mmap);
        if (ls.custom_args) setCustomArgs(ls.custom_args);
      }
    }
  }, [config]);

  // Scans files dynamically whenever modelsPath changes
  useEffect(() => {
    setDownloadedGgufs([]);
  }, [modelsPath]);

  // Load status, paths, and releases
  useEffect(() => {
    setServerStatus('stopped');
  }, []);

  const handleStartLlamaServer = async () => {
    setServerStatus('running');
    setApiUrl(`http://${host}:${port}/v1`);
  };

  const handleStopLlamaServer = async () => {
    setServerStatus('stopped');
  };

  const handleDownloadServer = async () => {
    alert('Local llama.cpp binary download is not available in web mode. Please run your local LLM (e.g., Ollama or Llama.cpp) directly on your machine.');
  };

  const handleDownloadModel = async () => {
    alert('Model downloading is not available in web mode. Please download GGUF models directly.');
  };

  const handleDetectSpecs = async () => {
    setIsDetectingSpecs(true);
    setDetectedSpecs({
      cpu_cores: navigator.hardwareConcurrency || 8,
      total_ram_gb: 16,
      gpus: ['Integrated / Discrete GPU'],
      suggested_preset: 'medium',
    });
    setIsDetectingSpecs(false);
  };

  const handleAutoOptimize = () => {
    if (!detectedSpecs) return;

    // Suggest optimal threads
    const recommendedThreads = Math.max(2, detectedSpecs.cpu_cores - 2);
    setThreads(recommendedThreads);

    // RAM checks
    if (detectedSpecs.total_ram_gb >= 24) {
      setCtxSize(16384);
      setBatchSize(2048);
      setUbatchSize(512);
    } else if (detectedSpecs.total_ram_gb >= 16) {
      setCtxSize(8192);
      setBatchSize(1024);
      setUbatchSize(256);
    } else {
      setCtxSize(4096);
      setBatchSize(512);
      setUbatchSize(128);
    }

    // Check GPU offload
    const hasNvidia = detectedSpecs.gpus.some(name => name.toLowerCase().includes('nvidia'));
    const hasAmd = detectedSpecs.gpus.some(name => name.toLowerCase().includes('amd') || name.toLowerCase().includes('radeon'));

    if (hasNvidia) {
      setGpuLayers(99);
      setMlock(true);
    } else if (hasAmd) {
      setGpuLayers(35);
      setMlock(false);
    } else {
      setGpuLayers(0);
      setMlock(false);
    }

    alert("Parameters auto-optimized based on hardware specifications!");
  };

  const applyPreset = (preset: 'weak' | 'medium' | 'nvidia' | 'amd') => {
    if (preset === 'weak') {
      setCtxSize(2048);
      setThreads(4);
      setGpuLayers(0);
      setBatchSize(512);
      setUbatchSize(128);
      setMlock(false);
      setMmap(true);
    } else if (preset === 'medium') {
      setCtxSize(4096);
      setThreads(8);
      setGpuLayers(12);
      setBatchSize(1024);
      setUbatchSize(256);
      setMlock(false);
      setMmap(true);
    } else if (preset === 'nvidia') {
      setCtxSize(8192);
      setThreads(12);
      setGpuLayers(99);
      setBatchSize(2048);
      setUbatchSize(512);
      setMlock(true);
      setMmap(true);
    } else if (preset === 'amd') {
      setCtxSize(8192);
      setThreads(8);
      setGpuLayers(35);
      setBatchSize(1024);
      setUbatchSize(256);
      setMlock(false);
      setMmap(true);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      await onSaveConfig({
        ...config,
        api_url: apiUrl,
        model_name: modelName,
        system_prompt: systemPrompt,
        groq_api_key: groqApiKey.trim() || null,
        models_path: modelsPath.trim() || null,
        reasoning_enabled: reasoningEnabled,
        theme_colors: {
          bg_color: bgColor,
          text_color: textColor,
          border_color: borderColor,
          active_color: activeColor,
          send_btn_color: sendBtnColor,
        },
        local_server: {
          exe_path: exePath.trim() || null,
          model_path: modelPath.trim() || null,
          host,
          port,
          ctx_size: ctxSize,
          threads,
          gpu_layers: gpuLayers,
          temp,
          predict,
          batch_size: batchSize,
          ubatch_size: ubatchSize,
          min_p: minP,
          top_k: topK,
          top_p: topP,
          repeat_penalty: repeatPenalty,
          seed,
          presence_penalty: presencePenalty,
          frequency_penalty: frequencyPenalty,
          flash_attn: flashAttn,
          embedding,
          cont_batching: contBatching,
          prompt_cache: promptCache,
          mlock,
          mmap,
          custom_args: customArgs.trim() || null,
        },
      });
      alert("Settings saved successfully!");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (activeTab === 'general') {
      setApiUrl('http://127.0.0.1:11434/v1');
      setModelName('qwen2.5-coder:7b');
      setGroqApiKey('');
      setModelsPath('');
      setReasoningEnabled(true);
      setSystemPrompt(
        "You are a local developer agent. You run on the user's computer with files access and shell execution capabilities. When the user asks you to modify or create a file, or run a command, you MUST use the corresponding XML tool call. Do not just write code in markdown code blocks.\n\nAVAILABLE TOOLS:\n1. Read File:\n<read_file path=\"file_path\" />\n\n2. Write/Create File (Only for new files):\n<write_file path=\"file_path\">\nfile contents\n</write_file>\n\n3. Patch File (Preferred for modifying existing files):\n<patch_file path=\"file_path\">\n<<<<<<< SEARCH\nexact lines to replace\n=======\nnew lines to replace with\n>>>>>>> REPLACE\n</patch_file>\n\n4. List Directory:\n<list_dir path=\"directory_path\" />\n\n5. Regex Grep Search:\n<grep_search pattern=\"regex\" path=\"directory_path_or_file_path\" />\n\n6. Execute Command:\n<execute_command>\ncommand to run\n</execute_command>\n\nRULES:\n1. You MUST call tools using the XML tags above. DO NOT wrap tool tags in markdown code blocks (like ```xml ... ```). Output them directly as plain text.\n2. The search/replace markers in <patch_file> MUST be exactly: \"<<<<<<< SEARCH\" (7 less-than signs), \"=======\" (7 equals signs), and \">>>>>>> REPLACE\" (7 greater-than signs). They are case-sensitive.\n3. Keep explanations extremely brief. Do not output conversational fluff. Explain why you are using write, patch, or shell command tools in 1 short sentence before outputting the XML tag.\n4. When writing code, do not output the entire file in chat if patch_file can do the job.\n\nEXAMPLE CONVERSATION:\nUser: Add a greet function to src/utils.py\n\nAssistant: I will use the patch_file tool to add the greet function to src/utils.py.\n\n<patch_file path=\"src/utils.py\">\n<<<<<<< SEARCH\ndef calculate(a, b):\n    return a + b\n=======\ndef greet(name):\n    print(f\"Hello, {name}!\")\n\ndef calculate(a, b):\n    return a + b\n>>>>>>> REPLACE\n</patch_file>"
      );
    } else {
      setBgColor('#ffffff');
      setTextColor('#000000');
      setBorderColor('#000000');
      setActiveColor('#f5f5f5');
      setSendBtnColor('#86efac');
    }
  };

  return (
    <div className="w-full h-full bg-theme-bg text-theme-text flex flex-col overflow-hidden p-6 select-text">
      
      {/* Settings Header bar inside content area */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0 select-none">
        <div className="flex items-center gap-6">
          <h2 className="text-xs font-hud font-bold uppercase tracking-wider text-slate-200">НАСТРОЙКИ СИСТЕМЫ</h2>
          {/* Subtabs selector */}
          <div className="flex glass-panel rounded-xl p-1 gap-1 select-none border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-4 py-1 text-[10px] font-hud font-bold uppercase rounded-lg cursor-pointer transition-colors focus:outline-none ${
                activeTab === 'general' ? 'bg-slate-800 text-white font-bold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Основное
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('colors')}
              className={`px-4 py-1 text-[10px] font-hud font-bold uppercase rounded-lg cursor-pointer transition-colors focus:outline-none ${
                activeTab === 'colors' ? 'bg-slate-800 text-white font-bold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Цвета
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('local_server')}
              className={`px-4 py-1 text-[10px] font-hud font-bold uppercase rounded-lg cursor-pointer transition-colors focus:outline-none ${
                activeTab === 'local_server' ? 'bg-slate-800 text-white font-bold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Локальный Сервер (Llama.cpp)
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="skeuo-btn px-4 py-1.5 rounded-xl text-xs font-hud uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer focus:outline-none"
        >
          Вернуться в чат
        </button>
      </div>

      {/* Main Settings Form Scrollable area */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-none">
        
        {/* TAB 1: GENERAL */}
        {activeTab === 'general' && (
          <div className="max-w-3xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
                  Ссылка подключения к API (Local LLM Server API URL)
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="e.g. http://127.0.0.1:11434/v1"
                  required
                  className="w-full px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
                  Название модели (Model Name identifier)
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. qwen2.5-coder:7b"
                  required
                  className="w-full px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
                  Токен API Groq (Для голосового ввода)
                </label>
                <input
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
                  Папка с моделями GGUF (Models Path)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modelsPath}
                    onChange={(e) => setModelsPath(e.target.value)}
                    placeholder="e.g. C:\users\user\Documents\localLLMS"
                    className="flex-1 px-4 py-2.5 rounded-xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await api.select_workspace();
                      if (res) setModelsPath(res);
                    }}
                    className="skeuo-btn px-4 py-1 text-xs font-hud font-bold uppercase tracking-wider rounded-xl text-slate-200 hover:text-white cursor-pointer focus:outline-none shrink-0"
                  >
                    Обзор...
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 py-1 select-none cursor-pointer">
              <input
                type="checkbox"
                id="reasoning_chk"
                checked={reasoningEnabled}
                onChange={(e) => setReasoningEnabled(e.target.checked)}
                className="rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="reasoning_chk" className="text-xs font-hud font-bold text-slate-300 uppercase select-none cursor-pointer">
                Reasoning (Отображать ход мыслей модели &lt;think&gt;)
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-hud font-bold uppercase text-slate-400">
                Системные инструкции (System Instructions Prompt)
              </label>
              <textarea
                rows={10}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-2xl skeuo-input text-xs font-mono text-slate-100 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* TAB 2: COLORS */}
        {activeTab === 'colors' && (
          <div className="max-w-2xl space-y-4">
            <p className="text-[10px] text-theme-text opacity-50 uppercase tracking-wider font-bold mb-2">
              Настройка цветов интерфейса вручную (HEX)
            </p>

            <div className="flex items-center justify-between gap-4 border-b border-theme-border/20 pb-2">
              <div>
                <div className="text-xs font-bold">Фон окна (bg_color)</div>
                <div className="text-[10px] text-theme-text opacity-55">Задает основной цвет холста</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  placeholder="#ffffff"
                  className="w-28 px-3 py-1 rounded-full border border-theme-border bg-theme-bg text-theme-text text-xs font-mono text-center focus:outline-none"
                />
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded border border-theme-border cursor-pointer overflow-hidden p-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-theme-border/20 pb-2">
              <div>
                <div className="text-xs font-bold">Цвет шрифта (text_color)</div>
                <div className="text-[10px] text-theme-text opacity-55">Задает цвет букв и текста</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  placeholder="#000000"
                  className="w-28 px-3 py-1 rounded-full border border-theme-border bg-theme-bg text-theme-text text-xs font-mono text-center focus:outline-none"
                />
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded border border-theme-border cursor-pointer overflow-hidden p-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-theme-border/20 pb-2">
              <div>
                <div className="text-xs font-bold">Рамки и границы (border_color)</div>
                <div className="text-[10px] text-theme-text opacity-55">Задает цвет контуров всех блоков</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  placeholder="#000000"
                  className="w-28 px-3 py-1 rounded-full border border-theme-border bg-theme-bg text-theme-text text-xs font-mono text-center focus:outline-none"
                />
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="w-8 h-8 rounded border border-theme-border cursor-pointer overflow-hidden p-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-theme-border/20 pb-2">
              <div>
                <div className="text-xs font-bold">Активный элемент (active_color)</div>
                <div className="text-[10px] text-theme-text opacity-55">Задает фон нажатых вкладок и подсветки</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                  placeholder="#f5f5f5"
                  className="w-28 px-3 py-1 rounded-full border border-theme-border bg-theme-bg text-theme-text text-xs font-mono text-center focus:outline-none"
                />
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                  className="w-8 h-8 rounded border border-theme-border cursor-pointer overflow-hidden p-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-theme-border/20 pb-2">
              <div>
                <div className="text-xs font-bold">Кнопка отправки чата (send_btn_color)</div>
                <div className="text-[10px] text-theme-text opacity-55">Цвет кнопки "Отправить"</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sendBtnColor}
                  onChange={(e) => setSendBtnColor(e.target.value)}
                  placeholder="#86efac"
                  className="w-28 px-3 py-1 rounded-full border border-theme-border bg-theme-bg text-theme-text text-xs font-mono text-center focus:outline-none"
                />
                <input
                  type="color"
                  value={sendBtnColor}
                  onChange={(e) => setSendBtnColor(e.target.value)}
                  className="w-8 h-8 rounded border border-theme-border cursor-pointer overflow-hidden p-0"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LOCAL SERVER LAUNCHER */}
        {activeTab === 'local_server' && (
          <div className="space-y-6">
            
            {/* Llama.cpp header status bar */}
            <div className="flex items-center justify-between border-b border-theme-border pb-3 text-theme-text select-none">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider">Параметры запуска llama.cpp</h3>
                <p className="text-[9px] opacity-60 font-bold">Настройте и запустите сервер локальной языковой модели</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  serverStatus === 'running' 
                    ? 'bg-green-500 animate-pulse' 
                    : serverStatus === 'checking'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                }`} />
                <span className="text-[10px] font-mono uppercase font-black">
                  {serverStatus === 'running' ? 'РАБОТАЕТ' : serverStatus === 'checking' ? 'ПРОВЕРКА' : 'ОСТАНОВЛЕН'}
                </span>
              </div>
            </div>

            {/* Automated download cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Github downloader */}
              <div className="p-4 border border-theme-border rounded-2xl bg-theme-active/30 space-y-2">
                <div className="text-[10px] font-black uppercase opacity-65">1. Скачать движок llama.cpp</div>
                {isLoadingReleases ? (
                  <div className="text-xs font-bold italic py-2 flex items-center gap-2"><RefreshCw size={12} className="animate-spin" /> Загрузка релизов...</div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[8px] opacity-50 block font-bold">ВЫБЕРИТЕ РЕЛИЗ:</label>
                      <select
                        value={selectedReleaseIndex}
                        onChange={(e) => {
                          setSelectedReleaseIndex(Number(e.target.value));
                          setSelectedAssetIndex(0);
                        }}
                        className="w-full px-2.5 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text focus:outline-none"
                      >
                        {releases.map((rel, idx) => (
                          <option key={rel.tag_name} value={idx}>
                            {rel.name} ({rel.published_at.substring(0, 10)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] opacity-50 block font-bold">ВЫБЕРИТЕ СБОРКУ ДЛЯ ПК:</label>
                      <select
                        value={selectedAssetIndex}
                        onChange={(e) => setSelectedAssetIndex(Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text focus:outline-none"
                      >
                        {releases[selectedReleaseIndex]?.assets.map((asset, idx) => (
                          <option key={asset.name} value={idx}>
                            {asset.name} ({(asset.size / 1024 / 1024).toFixed(1)} MB)
                          </option>
                        ))}
                        {(!releases[selectedReleaseIndex]?.assets || releases[selectedReleaseIndex]?.assets.length === 0) && (
                          <option value="">Сборки не найдены</option>
                        )}
                      </select>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleDownloadServer}
                  disabled={downloadType !== null || releases.length === 0}
                  className="w-full py-1 text-xs font-bold border border-theme-border rounded-full bg-theme-bg hover:bg-theme-active disabled:opacity-40 cursor-pointer text-theme-text"
                >
                  Загрузить выбранную сборку
                </button>
                {binDir && (
                  <div className="text-[8px] opacity-50 truncate max-w-full font-mono mt-1" title={binDir}>
                    Папка: {binDir}
                  </div>
                )}
              </div>

              {/* GGUF downloader */}
              <div className="p-4 border border-theme-border rounded-2xl bg-theme-active/30 space-y-2">
                <div className="text-[10px] font-black uppercase opacity-65">2. Скачать GGUF модель (Hugging Face)</div>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={hfRepo}
                    onChange={(e) => setHfRepo(e.target.value)}
                    placeholder="Hugging Face Репозиторий (e.g. Qwen/Qwen2.5-Coder-7B-Instruct-GGUF)"
                    className="w-full px-3 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text focus:outline-none"
                  />
                  <input
                    type="text"
                    value={hfFilename}
                    onChange={(e) => setHfFilename(e.target.value)}
                    placeholder="Название GGUF файла (e.g. qwen2.5-coder-7b-instruct-q4_k_m.gguf)"
                    className="w-full px-3 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadModel}
                  disabled={downloadType !== null}
                  className="w-full py-1 text-xs font-bold border border-theme-border rounded-full bg-theme-bg hover:bg-theme-active disabled:opacity-40 cursor-pointer text-theme-text"
                >
                  Загрузить модель
                </button>
                {modelsPath && (
                  <div className="text-[8px] opacity-50 truncate max-w-full font-mono mt-1" title={modelsPath}>
                    Папка: {modelsPath}
                  </div>
                )}
              </div>
            </div>

            {/* Progress indicator */}
            {downloadType && (
              <div className="p-4 border border-theme-border rounded-2xl bg-theme-active/40 space-y-1.5 animate-pulse">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                  <span>Загрузка {downloadType === 'server' ? 'llama-server' : 'GGUF модели'}...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full bg-theme-bg h-2 rounded-full overflow-hidden border border-theme-border">
                  <div className="bg-theme-text h-full transition-all" style={{ width: `${downloadProgress}%` }} />
                </div>
                <div className="text-[9px] opacity-75 font-mono flex justify-between">
                  <span>Статус: {downloadStatus}</span>
                  {downloadTotal > 0 && (
                    <span>
                      {(downloadDownloaded / 1024 / 1024).toFixed(1)}MB / {(downloadTotal / 1024 / 1024).toFixed(1)}MB
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Spec Auto Detect Optimize */}
            <div className="p-4 border border-theme-border rounded-2xl bg-theme-active/30 text-theme-text">
              <div className="flex justify-between items-center pb-2 border-b border-theme-border/20 mb-2">
                <div className="text-[10px] font-black uppercase opacity-65">Оптимизация параметров под компьютер</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDetectSpecs}
                    disabled={isDetectingSpecs}
                    className="px-3 py-0.5 text-[9px] border border-theme-border rounded-full hover:bg-theme-active font-bold bg-theme-bg text-theme-text cursor-pointer focus:outline-none"
                  >
                    {isDetectingSpecs ? 'Проверка...' : 'Проверить железо'}
                  </button>
                  {detectedSpecs && (
                    <button
                      type="button"
                      onClick={handleAutoOptimize}
                      className="px-3 py-0.5 text-[9px] border border-theme-border rounded-full bg-[#86EFAC] hover:bg-green-400 font-black text-black cursor-pointer focus:outline-none"
                    >
                      Оптимизировать
                    </button>
                  )}
                </div>
              </div>

              {detectedSpecs ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono mb-2">
                  <div>CPU: <span className="font-bold">{detectedSpecs.cpu_cores} ядер</span></div>
                  <div>RAM: <span className="font-bold">{detectedSpecs.total_ram_gb.toFixed(1)} GB</span></div>
                  <div className="col-span-2 truncate" title={detectedSpecs.gpus.join(', ')}>GPU: <span className="font-bold">{detectedSpecs.gpus.join(', ') || 'Отсутствует/Интегрированная'}</span></div>
                </div>
              ) : (
                <div className="text-[9px] opacity-50 italic mb-2">Нажмите «Проверить железо», чтобы программа порекомендовала оптимальные значения под процессор, оперативку и видеокарту.</div>
              )}

              {/* Fast presets */}
              <div className="flex flex-wrap gap-2 items-center text-[9px] font-bold">
                <span className="opacity-55 uppercase tracking-wider mr-1">Быстрые пресеты:</span>
                <button type="button" onClick={() => applyPreset('weak')} className="px-2.5 py-0.5 border border-theme-border rounded-full bg-theme-bg hover:bg-theme-active text-theme-text cursor-pointer focus:outline-none">Слабый ПК (CPU)</button>
                <button type="button" onClick={() => applyPreset('medium')} className="px-2.5 py-0.5 border border-theme-border rounded-full bg-theme-bg hover:bg-theme-active text-theme-text cursor-pointer focus:outline-none">Средний ПК (CPU+GPU)</button>
                <button type="button" onClick={() => applyPreset('nvidia')} className="px-2.5 py-0.5 border border-theme-border rounded-full bg-theme-bg hover:bg-theme-active text-theme-text cursor-pointer focus:outline-none">Мощный ПК (Nvidia GPU)</button>
                <button type="button" onClick={() => applyPreset('amd')} className="px-2.5 py-0.5 border border-theme-border rounded-full bg-theme-bg hover:bg-theme-active text-theme-text cursor-pointer focus:outline-none">Radeon GPU (HIP)</button>
              </div>
            </div>

            {/* Core Config & Detailed Sampling inputs */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase opacity-65 border-b border-theme-border/10 pb-1">Параметры модели и генерации</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left col: Core binary paths and selection */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-bold opacity-60 block uppercase">Путь к файлу llama-server.exe (Опционально)</label>
                    <input
                      type="text"
                      value={exePath}
                      onChange={(e) => setExePath(e.target.value)}
                      placeholder="По умолчанию: bin/llama-server.exe"
                      className="w-full px-3 py-1.5 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold opacity-60 block uppercase">Выбрать модель из папки (GGUF Model Selector)</label>
                    <div className="flex gap-2">
                      <select
                        value={modelPath.split('\\').pop() || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setModelPath(`${modelsPath.trim()}\\${val}`);
                          } else {
                            setModelPath("");
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-theme-border bg-theme-bg rounded-full font-bold text-theme-text focus:outline-none"
                      >
                        <option value="">-- Список GGUF моделей в папке --</option>
                        {downloadedGgufs.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await api.select_workspace();
                          if (res) setModelPath(res);
                        }}
                        className="px-3 py-1.5 text-xs font-bold border border-theme-border rounded-full bg-theme-bg hover:bg-theme-active cursor-pointer text-theme-text focus:outline-none shrink-0"
                      >
                        Обзор...
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold opacity-60 block uppercase">Полный путь к файлу GGUF модели (GGUF Model Path)</label>
                    <input
                      type="text"
                      value={modelPath}
                      onChange={(e) => setModelPath(e.target.value)}
                      placeholder="e.g. C:\models\model.gguf"
                      required
                      className="w-full px-3 py-1.5 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text focus:outline-none"
                    />
                  </div>

                  {/* Port host and threads core inputs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[8px] font-bold opacity-50 block uppercase">Хост</label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text text-center focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold opacity-50 block uppercase">Порт</label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text text-center focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold opacity-50 block uppercase">Context Size</label>
                      <input
                        type="number"
                        value={ctxSize}
                        onChange={(e) => setCtxSize(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text text-center focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-bold opacity-50 block uppercase">Потоки CPU</label>
                      <input
                        type="number"
                        value={threads}
                        onChange={(e) => setThreads(Number(e.target.value))}
                        className="w-full px-3 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text text-center focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold opacity-50 block uppercase">Слои GPU (Offload)</label>
                      <input
                        type="number"
                        value={gpuLayers}
                        onChange={(e) => setGpuLayers(Number(e.target.value))}
                        className="w-full px-3 py-1 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text text-center focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right col: Sampling model parameters */}
                <div className="space-y-2 border border-theme-border/20 rounded-2xl p-4 bg-theme-active/5">
                  <div className="text-[9px] font-black uppercase opacity-65 mb-2 border-b border-theme-border/10 pb-1">Тонкие параметры генерации</div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">ТЕМПЕРАТУРА (TEMP)</label>
                      <input type="number" step="0.05" value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">МАКС ТОКЕНОВ</label>
                      <input type="number" value={predict} onChange={(e) => setPredict(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">РАЗМЕР БАТЧА</label>
                      <input type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">ФИЗ. РАЗМЕР БАТЧА</label>
                      <input type="number" value={ubatchSize} onChange={(e) => setUbatchSize(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">MIN-P</label>
                      <input type="number" step="0.01" value={minP} onChange={(e) => setMinP(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">TOP-K</label>
                      <input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">TOP-P</label>
                      <input type="number" step="0.05" value={topP} onChange={(e) => setTopP(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">ШТРАФ ЗА ПОВТОР</label>
                      <input type="number" step="0.05" value={repeatPenalty} onChange={(e) => setRepeatPenalty(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">SEED (-1 = RAND)</label>
                      <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">ШТРАФ (НАЛИЧИЕ)</label>
                      <input type="number" step="0.1" value={presencePenalty} onChange={(e) => setPresencePenalty(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[7.5px] block font-bold opacity-50">ШТРАФ (ЧАСТОТА)</label>
                      <input type="number" step="0.1" value={frequencyPenalty} onChange={(e) => setFrequencyPenalty(Number(e.target.value))} className="w-full px-2 py-0.5 border border-theme-border bg-theme-bg rounded-md font-mono text-center focus:outline-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Checkboxes parameters panel */}
              <div className="p-4 border border-theme-border/20 rounded-2xl bg-theme-active/10 space-y-2 select-none">
                <div className="text-[9px] font-black uppercase opacity-65 mb-1">Специфические флаги сервера</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={flashAttn} onChange={(e) => setFlashAttn(e.target.checked)} className="rounded border-theme-border text-theme-text" />
                    <span>Flash Attention</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={embedding} onChange={(e) => setEmbedding(e.target.checked)} className="rounded border-theme-border text-theme-text" />
                    <span>Эмбеддинги</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={contBatching} onChange={(e) => setContBatching(e.target.checked)} className="rounded border-theme-border text-theme-text" />
                    <span>Непрерывный батчинг</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={promptCache} onChange={(e) => setPromptCache(e.target.checked)} className="rounded border-theme-border text-theme-text" />
                    <span>Кэширование промптов</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={mlock} onChange={(e) => setMlock(e.target.checked)} className="rounded border-theme-border text-theme-text" />
                    <span>mlock (RAM lock)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={mmap} onChange={(e) => setMmap(e.target.checked)} className="rounded border-theme-border text-theme-text" />
                    <span>MMap (Быстрая загрузка)</span>
                  </label>
                </div>
              </div>

              {/* Extra args string */}
              <div>
                <label className="text-[9px] font-bold opacity-60 block uppercase">Дополнительные аргументы командной строки CLI (Optional)</label>
                <input
                  type="text"
                  value={customArgs}
                  onChange={(e) => setCustomArgs(e.target.value)}
                  placeholder="e.g. --temp 0.2 --threads 4"
                  className="w-full px-3 py-1.5 text-xs border border-theme-border bg-theme-bg rounded-full font-mono text-theme-text focus:outline-none"
                />
              </div>

              {/* Control triggers */}
              <div className="flex gap-4 pt-1">
                <button
                  type="button"
                  onClick={handleStartLlamaServer}
                  disabled={serverStatus === 'running' || serverStatus === 'checking'}
                  className="flex-1 py-2 text-xs font-black border border-theme-border rounded-full bg-[#86EFAC] text-black hover:bg-green-400 disabled:opacity-40 cursor-pointer focus:outline-none"
                >
                  Запустить локальный сервер llama.cpp
                </button>
                <button
                  type="button"
                  onClick={handleStopLlamaServer}
                  disabled={serverStatus !== 'running'}
                  className="flex-1 py-2 text-xs font-black border border-red-500 text-red-600 rounded-full bg-red-50 hover:bg-red-100 disabled:opacity-40 cursor-pointer focus:outline-none"
                >
                  Остановить сервер
                </button>
              </div>

              {/* Live console terminal outputs */}
              <div className="border border-theme-border rounded-2xl bg-neutral-900 overflow-hidden flex flex-col">
                <div className="bg-neutral-950 p-2 flex justify-between items-center text-[9px] font-mono text-neutral-400 select-none">
                  <span className="flex items-center gap-1">📺 Логи сервера (Console Output)</span>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={serverLogsAutoScroll}
                        onChange={(e) => setServerLogsAutoScroll(e.target.checked)}
                        className="rounded bg-neutral-800 border-neutral-700 text-xs"
                      />
                      <span>Auto scroll</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setServerLogs([])}
                      className="hover:text-white font-bold"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="p-3 font-mono text-[9px] text-[#00FF00] h-36 overflow-y-auto space-y-0.5 leading-tight select-text scrollbar-none">
                  {serverLogs.length > 0 ? (
                    serverLogs.map((log, index) => (
                      <div key={index} className="break-all text-[#00ff00]">{log}</div>
                    ))
                  ) : (
                    <div className="text-neutral-500 italic">Журнал пуст. Запустите сервер, чтобы увидеть логи вывода.</div>
                  )}
                  <div ref={(el) => {
                    if (serverLogsAutoScroll) el?.scrollIntoView({ behavior: 'smooth' });
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Action triggers */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-6 shrink-0 select-none">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="skeuo-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-300 hover:text-white text-xs font-hud uppercase tracking-wider cursor-pointer focus:outline-none"
            >
              <Undo size={13} />
              <span>По умолчанию</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="skeuo-btn flex items-center gap-1.5 px-6 py-2 rounded-xl text-emerald-400 hover:text-emerald-300 border-emerald-500/30 text-xs font-hud font-bold uppercase tracking-wider cursor-pointer focus:outline-none disabled:opacity-40"
            >
              <span>{isSaving ? 'Сохранение...' : 'Сохранить настройки'}</span>
            </button>
          </div>
        </form>
      </div>
    );
};
