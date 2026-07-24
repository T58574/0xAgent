import React, { useState, useEffect } from 'react';
import { Undo, Save } from 'lucide-react';
import { AppConfig } from '../../types';
import { GeneralTab } from './GeneralTab';
import { ColorsTab } from './ColorsTab';
import { LocalServerTab } from './LocalServerTab';

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
  const [activeTab, setActiveTab] = useState<'general' | 'colors' | 'local_server'>('general');

  // General state
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [modelsPath, setModelsPath] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(true);

  // Colors state
  const [bgColor, setBgColor] = useState('#090d16');
  const [textColor, setTextColor] = useState('#f8fafc');
  const [borderColor, setBorderColor] = useState('rgba(255, 255, 255, 0.1)');
  const [activeColor, setActiveColor] = useState('rgba(30, 41, 59, 0.7)');
  const [sendBtnColor, setSendBtnColor] = useState('#3b82f6');

  // Local Server state
  const [exePath, setExePath] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(11434);
  const [ctxSize, setCtxSize] = useState(8192);
  const [threads, setThreads] = useState(8);
  const [gpuLayers, setGpuLayers] = useState(0);
  const [temp, setTemp] = useState(0.7);
  const [predict, setPredict] = useState(4096);
  const [batchSize, setBatchSize] = useState(2048);
  const [ubatchSize, setUbatchSize] = useState(512);
  const [minP, setMinP] = useState(0.08);
  const [topK, setTopK] = useState(40);
  const [topP, setTopP] = useState(0.95);
  const [repeatPenalty, setRepeatPenalty] = useState(1.1);
  const [seed, setSeed] = useState(-1);
  const [flashAttn, setFlashAttn] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [contBatching, setContBatching] = useState(false);
  const [promptCache, setPromptCache] = useState(true);
  const [mlock, setMlock] = useState(false);
  const [mmap, setMmap] = useState(true);
  const [customArgs, setCustomArgs] = useState('');

  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'checking'>('stopped');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [serverLogsAutoScroll, setServerLogsAutoScroll] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url);
      setModelName(config.model_name);
      setSystemPrompt(config.system_prompt);
      setGroqApiKey(config.groq_api_key || '');
      setModelsPath(config.models_path || '');
      setReasoningEnabled(config.reasoning_enabled !== false);

      if (config.theme_colors) {
        setBgColor(config.theme_colors.bg_color);
        setTextColor(config.theme_colors.text_color);
        setBorderColor(config.theme_colors.border_color);
        setActiveColor(config.theme_colors.active_color);
        setSendBtnColor(config.theme_colors.send_btn_color);
      }

      if (config.local_server) {
        const ls = config.local_server;
        if (ls.exe_path) setExePath(ls.exe_path);
        if (ls.model_path) setModelPath(ls.model_path);
        if (ls.host) setHost(ls.host);
        if (ls.port) setPort(ls.port);
        if (ls.ctx_size) setCtxSize(ls.ctx_size);
        if (ls.threads) setThreads(ls.threads);
        if (ls.gpu_layers) setGpuLayers(ls.gpu_layers);
      }
    }
  }, [config]);

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
          presence_penalty: 0,
          frequency_penalty: 0,
          flash_attn: flashAttn,
          embedding,
          cont_batching: contBatching,
          prompt_cache: promptCache,
          mlock,
          mmap,
          custom_args: customArgs.trim() || null,
        },
      });
      alert('Настройки успешно сохранены!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setApiUrl('http://127.0.0.1:11434/v1');
    setModelName('qwen2.5-coder:7b');
    setBgColor('#090d16');
    setTextColor('#f8fafc');
    setBorderColor('rgba(255, 255, 255, 0.1)');
    setActiveColor('rgba(30, 41, 59, 0.7)');
    setSendBtnColor('#3b82f6');
  };

  return (
    <div className="w-full h-full bg-scifi-grid text-slate-100 flex flex-col overflow-hidden p-4 md:p-6 select-text font-sans">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-white/10 shrink-0 gap-3 select-none">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-xs font-hud font-bold uppercase tracking-wider text-slate-200">НАСТРОЙКИ СИСТЕМЫ</h2>
          <div className="flex glass-panel rounded-xl p-1 gap-1 select-none border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-3 py-1 text-[10px] font-hud font-bold uppercase rounded-lg cursor-pointer transition-colors ${
                activeTab === 'general' ? 'bg-slate-800 text-white font-bold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Основное
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('colors')}
              className={`px-3 py-1 text-[10px] font-hud font-bold uppercase rounded-lg cursor-pointer transition-colors ${
                activeTab === 'colors' ? 'bg-slate-800 text-white font-bold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Цвета
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('local_server')}
              className={`px-3 py-1 text-[10px] font-hud font-bold uppercase rounded-lg cursor-pointer transition-colors ${
                activeTab === 'local_server' ? 'bg-slate-800 text-white font-bold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Сервер LLM
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="skeuo-btn px-4 py-1.5 rounded-xl text-xs font-hud uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer"
        >
          Вернуться в чат
        </button>
      </div>

      {/* Main Settings Form Scrollable Area */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-none">
        {activeTab === 'general' && (
          <GeneralTab
            apiUrl={apiUrl}
            setApiUrl={setApiUrl}
            modelName={modelName}
            setModelName={setModelName}
            groqApiKey={groqApiKey}
            setGroqApiKey={setGroqApiKey}
            modelsPath={modelsPath}
            setModelsPath={setModelsPath}
            reasoningEnabled={reasoningEnabled}
            setReasoningEnabled={setReasoningEnabled}
            systemPrompt={systemPrompt}
            setSystemPrompt={setSystemPrompt}
          />
        )}

        {activeTab === 'colors' && (
          <ColorsTab
            bgColor={bgColor}
            setBgColor={setBgColor}
            textColor={textColor}
            setTextColor={setTextColor}
            borderColor={borderColor}
            setBorderColor={setBorderColor}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            sendBtnColor={sendBtnColor}
            setSendBtnColor={setSendBtnColor}
          />
        )}

        {activeTab === 'local_server' && (
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
            predict={predict}
            setPredict={setPredict}
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
            repeatPenalty={repeatPenalty}
            setRepeatPenalty={setRepeatPenalty}
            seed={seed}
            setSeed={setSeed}
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

        {/* Action Triggers Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-6 shrink-0 select-none">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="skeuo-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-300 hover:text-white text-xs font-hud uppercase tracking-wider cursor-pointer"
          >
            <Undo size={13} />
            <span>По умолчанию</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="skeuo-btn flex items-center gap-1.5 px-6 py-2 rounded-xl text-emerald-400 hover:text-emerald-300 border-emerald-500/30 text-xs font-hud font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40"
          >
            <Save size={13} />
            <span>{isSaving ? 'Сохранение...' : 'Сохранить настройки'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
