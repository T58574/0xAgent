import React, { useState, useEffect } from 'react';
import { X, Save, Undo } from 'lucide-react';
import { AppConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'colors' | 'local_server'>('general');

  // General settings state
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');

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
  const [ctxSize, setCtxSize] = useState(8192);
  const [gpuLayers, setGpuLayers] = useState(0);
  const [flashAttn, setFlashAttn] = useState(false);
  const [customArgs, setCustomArgs] = useState('');

  // Download tool states
  const [serverVersion, setServerVersion] = useState('b3600');
  const [buildType, setBuildType] = useState('cpu'); // 'cpu' | 'cuda'

  const [downloadType, setDownloadType] = useState<'server' | 'model' | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadDownloaded, setDownloadDownloaded] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');

  // Hugging Face downloader state
  const [hfRepo, setHfRepo] = useState('Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF');
  const [hfFilename, setHfFilename] = useState('qwen2.5-coder-1.5b-instruct-q4_k_m.gguf');

  // Server process state
  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'checking'>('stopped');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [serverLogsAutoScroll, setServerLogsAutoScroll] = useState(true);

  // Local paths
  const [binDir, setBinDir] = useState('');
  const [modelsDir, setModelsDir] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url);
      setModelName(config.model_name);
      setSystemPrompt(config.system_prompt);
      setGroqApiKey(config.groq_api_key || '');

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
    }
  }, [config, isOpen]);

  // Query status and default paths on mount/modal-open
  useEffect(() => {
    if (!isOpen) return;

    const fetchStatus = async () => {
      try {
        const statusObj = await import('@tauri-apps/api/core').then(m => m.invoke<any>('get_llama_server_status'));
        if (statusObj.status === 'running') {
          setServerStatus('running');
          setPort(statusObj.port);
        } else {
          setServerStatus('stopped');
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchPaths = async () => {
      try {
        const paths = await import('@tauri-apps/api/core').then(m => m.invoke<any>('get_local_paths'));
        setBinDir(paths.bin_dir);
        setModelsDir(paths.models_dir);
        if (!modelPath) {
          setModelPath(`${paths.models_dir}\\qwen2.5-coder-1.5b-instruct-q4_k_m.gguf`);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchStatus();
    fetchPaths();

    let unlistenProgress: any;
    let unlistenLogs: any;

    const setupListeners = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenProgress = await listen<any>('download-progress', (event) => {
        const payload = event.payload;
        setDownloadType(payload.type);
        setDownloadStatus(payload.status);
        setDownloadProgress(payload.progress);
        if (payload.downloaded) setDownloadDownloaded(payload.downloaded);
        if (payload.total) setDownloadTotal(payload.total);

        if (payload.status === 'completed') {
          if (payload.type === 'server') {
            setExePath(payload.path);
          } else {
            setModelPath(payload.path);
          }
          setTimeout(() => {
            setDownloadType(null);
            setDownloadProgress(0);
          }, 3000);
        }
      });

      unlistenLogs = await listen<string>('llama-server-log', (event) => {
        setServerLogs((prev) => [...prev, event.payload].slice(-300));
      });
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenLogs) unlistenLogs();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartLlamaServer = async () => {
    setServerStatus('checking');
    try {
      await import('@tauri-apps/api/core').then(m =>
        m.invoke('start_llama_server', {
          config: {
            exe_path: exePath.trim() ? exePath.trim() : null,
            model_path: modelPath,
            host,
            port: Number(port),
            ctx_size: Number(ctxSize),
            gpu_layers: Number(gpuLayers),
            flash_attn: flashAttn,
            custom_args: customArgs.trim() ? customArgs.trim() : null,
          }
        })
      );
      setServerStatus('running');
      setApiUrl(`http://${host}:${port}/v1`);
      setServerLogs((prev) => [...prev, "[SYSTEM] Llama-server started successfully."]);
    } catch (e: any) {
      setServerStatus('stopped');
      setServerLogs((prev) => [...prev, `[SYSTEM ERROR] Failed to start server: ${e}`]);
    }
  };

  const handleStopLlamaServer = async () => {
    try {
      await import('@tauri-apps/api/core').then(m => m.invoke('stop_llama_server'));
      setServerStatus('stopped');
      setServerLogs((prev) => [...prev, "[SYSTEM] Llama-server stopped."]);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleDownloadServer = async () => {
    setDownloadType('server');
    setDownloadProgress(0);
    setDownloadStatus('starting');
    try {
      await import('@tauri-apps/api/core').then(m =>
        m.invoke('download_llama_server', {
          version: serverVersion.trim(),
          buildType,
        })
      );
    } catch (e: any) {
      setDownloadType(null);
      alert(`Download failed: ${e}`);
    }
  };

  const handleDownloadModel = async () => {
    setDownloadType('model');
    setDownloadProgress(0);
    setDownloadStatus('starting');
    try {
      await import('@tauri-apps/api/core').then(m =>
        m.invoke('download_gguf_model', {
          repo: hfRepo.trim(),
          filename: hfFilename.trim(),
        })
      );
    } catch (e: any) {
      setDownloadType(null);
      alert(`Model download failed: ${e}`);
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
        theme_colors: {
          bg_color: bgColor,
          text_color: textColor,
          border_color: borderColor,
          active_color: activeColor,
          send_btn_color: sendBtnColor,
        },
      });
      onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl border border-black rounded-2xl bg-white shadow-2xl overflow-hidden text-black flex flex-col max-h-[95vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-black bg-neutral-50 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold uppercase tracking-wider">Developer settings</h2>
            {/* Tabs selector */}
            <div className="flex border border-black rounded-full p-0.5 bg-white select-none">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`px-3 py-0.5 text-[10px] font-bold uppercase rounded-full cursor-pointer transition-colors focus:outline-none ${
                  activeTab === 'general' ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'
                }`}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('colors')}
                className={`px-3 py-0.5 text-[10px] font-bold uppercase rounded-full cursor-pointer transition-colors focus:outline-none ${
                  activeTab === 'colors' ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'
                }`}
              >
                Colors
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('local_server')}
                className={`px-3 py-0.5 text-[10px] font-bold uppercase rounded-full cursor-pointer transition-colors focus:outline-none ${
                  activeTab === 'local_server' ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'
                }`}
              >
                Local Server
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full border border-black hover:bg-neutral-200 text-black transition-colors cursor-pointer focus:outline-none"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <>
              {/* API URL */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  API Connection URL
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="e.g. http://127.0.0.1:11434/v1"
                  required
                  className="w-full px-4 py-2 rounded-full bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors"
                />
              </div>

              {/* Model Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Model Name identifier
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. qwen2.5-coder:7b"
                  required
                  className="w-full px-4 py-2 rounded-full bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors"
                />
              </div>

              {/* Groq API Key */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Groq API Key (For Voice Transcription)
                </label>
                <input
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-4 py-2 rounded-full bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors"
                />
              </div>

              {/* System Instructions */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Agent System Instructions
                </label>
                <textarea
                  rows={6}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors resize-none"
                />
              </div>
            </>
          )}

          {/* COLORS TAB */}
          {activeTab === 'colors' && (
            <div className="space-y-4">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-2">
                Interface Color Settings (HEX)
              </p>

              {/* Background Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Window Background</div>
                  <div className="text-[10px] text-neutral-500">Main screen canvas color</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    placeholder="#ffffff"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Main Text</div>
                  <div className="text-[10px] text-neutral-500">Default typography text color</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    placeholder="#000000"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Border Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Border Outlines</div>
                  <div className="text-[10px] text-neutral-500">Outer containers and buttons borders</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    placeholder="#000000"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Active Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Active Item Background</div>
                  <div className="text-[10px] text-neutral-500">Active tabs and selected elements</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    placeholder="#f5f5f5"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Send Button Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Send Button Background</div>
                  <div className="text-[10px] text-neutral-500">Green submit button hex color</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sendBtnColor}
                    onChange={(e) => setSendBtnColor(e.target.value)}
                    placeholder="#86efac"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={sendBtnColor}
                    onChange={(e) => setSendBtnColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LOCAL SERVER TAB */}
          {activeTab === 'local_server' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2 mb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black">Local llama.cpp Server Launcher</h3>
                  <p className="text-[10px] text-neutral-500">Run local GGUF models directly within 0xAgent</p>
                </div>
                {/* Server Status Indicator */}
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    serverStatus === 'running' 
                      ? 'bg-green-500 animate-pulse' 
                      : serverStatus === 'checking'
                        ? 'bg-yellow-500 animate-pulse'
                        : 'bg-red-500'
                  }`} />
                  <span className="text-[10px] font-mono uppercase font-bold text-black">
                    {serverStatus}
                  </span>
                </div>
              </div>

              {/* Downloader Utilities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-neutral-200 pb-4">
                {/* llama-server downloader */}
                <div className="p-3 border border-black rounded-xl bg-neutral-50 space-y-2.5">
                  <div className="text-[10px] font-bold uppercase text-neutral-500">1. Download llama-server</div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] text-neutral-400 block font-bold">RELEASE</label>
                      <input
                        type="text"
                        value={serverVersion}
                        onChange={(e) => setServerVersion(e.target.value)}
                        placeholder="e.g. b3600"
                        className="w-full px-2.5 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-neutral-400 block font-bold">BUILD TYPE</label>
                      <select
                        value={buildType}
                        onChange={(e) => setBuildType(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-black bg-white rounded-full font-bold text-black focus:outline-none"
                      >
                        <option value="cpu">CPU (Generic)</option>
                        <option value="cuda">CUDA (Nvidia)</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadServer}
                    disabled={downloadType !== null}
                    className="w-full py-1 text-xs font-bold border border-black rounded-full bg-white hover:bg-neutral-100 disabled:opacity-40 cursor-pointer text-black"
                  >
                    Download Llama-Server
                  </button>
                  {binDir && (
                    <div className="text-[8px] text-neutral-400 truncate max-w-full font-mono mt-1" title={binDir}>
                      Folder: {binDir}
                    </div>
                  )}
                </div>

                {/* Model downloader */}
                <div className="p-3 border border-black rounded-xl bg-neutral-50 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-neutral-500">2. Download GGUF Model (Hugging Face)</div>
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={hfRepo}
                      onChange={(e) => setHfRepo(e.target.value)}
                      placeholder="HF Repository"
                      className="w-full px-3 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                    />
                    <input
                      type="text"
                      value={hfFilename}
                      onChange={(e) => setHfFilename(e.target.value)}
                      placeholder="Filename"
                      className="w-full px-3 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadModel}
                    disabled={downloadType !== null}
                    className="w-full py-1 text-xs font-bold border border-black rounded-full bg-white hover:bg-neutral-100 disabled:opacity-40 cursor-pointer text-black"
                  >
                    Download Model
                  </button>
                  {modelsDir && (
                    <div className="text-[8px] text-neutral-400 truncate max-w-full font-mono mt-1" title={modelsDir}>
                      Folder: {modelsDir}
                    </div>
                  )}
                </div>
              </div>

              {/* Download Progress Bar */}
              {downloadType && (
                <div className="p-3 border border-black rounded-xl bg-orange-50 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-orange-850 uppercase tracking-wide">
                    <span>Downloading {downloadType === 'server' ? 'Llama-Server' : 'GGUF Model'}...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden border border-neutral-300">
                    <div className="bg-orange-500 h-full transition-all" style={{ width: `${downloadProgress}%` }} />
                  </div>
                  <div className="text-[9px] text-orange-700 font-mono flex justify-between">
                    <span>Status: {downloadStatus}</span>
                    {downloadTotal > 0 && (
                      <span>
                        {(downloadDownloaded / 1024 / 1024).toFixed(1)}MB / {(downloadTotal / 1024 / 1024).toFixed(1)}MB
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Executable Configuration and Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-neutral-500 block uppercase">Llama-Server Binary Path (Optional)</label>
                    <input
                      type="text"
                      value={exePath}
                      onChange={(e) => setExePath(e.target.value)}
                      placeholder="Default: bin/llama-server.exe"
                      className="w-full px-3 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-neutral-500 block uppercase">GGUF Model Path</label>
                    <input
                      type="text"
                      value={modelPath}
                      onChange={(e) => setModelPath(e.target.value)}
                      placeholder="e.g. C:\models\model.gguf"
                      required
                      className="w-full px-3 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-neutral-500 block uppercase">Host</label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-neutral-500 block uppercase">Port</label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-neutral-500 block uppercase">Context</label>
                      <input
                        type="number"
                        value={ctxSize}
                        onChange={(e) => setCtxSize(Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-neutral-500 block uppercase">GPU Layers</label>
                      <input
                        type="number"
                        value={gpuLayers}
                        onChange={(e) => setGpuLayers(Number(e.target.value))}
                        className="w-full px-3 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                      />
                    </div>
                    <div className="flex-1 justify-center flex flex-col pl-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase flex items-center gap-1 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={flashAttn}
                          onChange={(e) => setFlashAttn(e.target.checked)}
                          className="rounded border-black"
                        />
                        <span>Flash Attn</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-neutral-500 block uppercase">Custom CLI Flags (Optional)</label>
                    <input
                      type="text"
                      value={customArgs}
                      onChange={(e) => setCustomArgs(e.target.value)}
                      placeholder="e.g. --temp 0.2 --threads 4"
                      className="w-full px-3 py-1 text-xs border border-black bg-white rounded-full font-mono text-black focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleStartLlamaServer}
                      disabled={serverStatus === 'running' || serverStatus === 'checking'}
                      className="flex-1 py-1.5 text-xs font-bold border border-black rounded-full bg-[#86EFAC] text-black hover:bg-green-400 disabled:opacity-40 cursor-pointer focus:outline-none"
                    >
                      Запустить сервер
                    </button>
                    <button
                      type="button"
                      onClick={handleStopLlamaServer}
                      disabled={serverStatus !== 'running'}
                      className="flex-1 py-1.5 text-xs font-bold border border-red-500 text-red-600 rounded-full bg-red-50 hover:bg-red-100 disabled:opacity-40 cursor-pointer focus:outline-none"
                    >
                      Остановить
                    </button>
                  </div>
                </div>
              </div>

              {/* Server Terminal View */}
              <div className="border border-black rounded-xl bg-neutral-900 overflow-hidden flex flex-col">
                <div className="bg-neutral-950 p-2 flex justify-between items-center text-[9px] font-mono text-neutral-400 select-none">
                  <span>Server Console Outputs</span>
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
                      className="hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="p-3 font-mono text-[9px] text-[#00FF00] h-32 overflow-y-auto space-y-0.5 leading-tight select-text scrollbar-none">
                  {serverLogs.length > 0 ? (
                    serverLogs.map((log, index) => (
                      <div key={index} className="break-all text-[#00ff00]">{log}</div>
                    ))
                  ) : (
                    <div className="text-neutral-500 italic">No output received yet. Click "Запустить сервер" to boot the engine.</div>
                  )}
                  {/* auto scroll anchor */}
                  <div ref={(el) => {
                    if (serverLogsAutoScroll) el?.scrollIntoView({ behavior: 'smooth' });
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 mt-5 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-black bg-white hover:bg-neutral-100 text-black text-xs font-bold cursor-pointer transition-colors focus:outline-none"
            >
              <Undo size={12} />
              <span>Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-full border border-black bg-white hover:bg-neutral-100 text-black text-xs font-bold cursor-pointer transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-full border border-black bg-[#86EFAC] hover:bg-green-400 text-black text-xs font-bold cursor-pointer transition-colors focus:outline-none"
              >
                <Save size={12} />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
