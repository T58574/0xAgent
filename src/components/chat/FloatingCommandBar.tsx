import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Send,
  Square,
  Mic,
  MicOff,
  Terminal,
  Bot,
  Globe,
  Brain,
  Code,
  User,
  Cloud,
  Cpu,
  HardDrive,
  Check,
  Volume2,
  Play,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { AppConfig, PersonaMetadata, AvailableModelsResponse } from '../../types';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ServerStatusData {
  running: boolean;
  host: string;
  port: number;
  modelPath?: string | null;
  modelName?: string | null;
}

interface FloatingCommandBarProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onCancelAgent?: () => void;
  chatMode?: 'agent' | 'simple';
  planningMode: boolean;
  onTogglePlanningMode?: () => void;
  personas?: PersonaMetadata[];
  activePersonaId?: string;
  onSelectPersona?: (id: string) => void;
  attachedImages: string[];
  onAttachImages: (images: string[]) => void;
  onRemoveImage: (index: number) => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  isTranscribing?: boolean;
  onTriggerSlashCommand?: (command: string) => void;
  config?: AppConfig | null;
  onModelChanged?: (newModelId: string) => void;
}

interface SlashCommandItem {
  cmd: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  { cmd: '/goal', label: 'Автономная цель (/goal)', description: 'Глубокое решение задачи до полного результата', icon: <Bot size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/search', label: 'Поиск в сети (/search)', description: 'Быстрый поиск через SearXNG без затрат токенов', icon: <Globe size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/think', label: 'Режим рассуждений (/think)', description: 'Пошаговая цепочка рассуждений CoT', icon: <Brain size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/patch', label: 'Аудит и рефакторинг (/patch)', description: 'Создание безопасных diff-патчей в проекте', icon: <Code size={14} className="text-[var(--theme-text-muted)]" /> },
  { cmd: '/clear', label: 'Очистить контекст (/clear)', description: 'Сбросить текущий буфер сообщений', icon: <Terminal size={14} className="text-[var(--theme-text-muted)]" /> },
];

export const FloatingCommandBar: React.FC<FloatingCommandBarProps> = ({
  inputText,
  setInputText,
  onSubmit,
  agentStatus,
  onCancelAgent,
  chatMode: _chatMode,
  planningMode,
  onTogglePlanningMode,
  personas = [],
  activePersonaId = 'default',
  onSelectPersona,
  attachedImages,
  onAttachImages,
  onRemoveImage,
  isRecording = false,
  onToggleRecording,
  isTranscribing: _isTranscribing = false,
  onTriggerSlashCommand,
  config,
  onModelChanged,
}) => {
  const { showToast } = useToast();
  
  // Single active popup state - prevents any double opening
  const [openMenu, setOpenMenu] = useState<'none' | 'persona' | 'model' | 'slash'>('none');
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  // Model & Server Status State
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatusData>({
    running: false,
    host: '127.0.0.1',
    port: 11434,
    modelPath: null,
    modelName: null,
  });
  const [modelsData, setModelsData] = useState<AvailableModelsResponse>({
    cloud: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: 'Medium', speed: 'Medium', provider: 'Google AI Studio' },
      { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT', badge: 'Fast', speed: 'Fast', provider: 'Google AI Studio' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', badge: 'Ultra Fast', speed: 'Ultra Fast', provider: 'Google AI Studio' },
      { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash Preview TTS', badge: 'Fast', speed: 'TTS Audio', provider: 'Google AI Studio', isAudio: true },
    ],
    local: [],
    activeModelId: config?.model_name || 'gemini-3.6-flash',
  });

  const activeModelId = config?.model_name || modelsData.activeModelId || 'gemini-3.6-flash';
  const isLocalActive = activeModelId.startsWith('local:') || activeModelId.endsWith('.gguf');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const fetchModelsAndStatus = async () => {
    try {
      const [data, status] = await Promise.all([
        api.get_available_models(),
        api.get_server_status(),
      ]);
      setModelsData(data);
      setServerStatus(status as ServerStatusData);
    } catch (err) {
      console.error('Failed to fetch available models / status:', err);
    }
  };

  useEffect(() => {
    fetchModelsAndStatus();
    const interval = setInterval(fetchModelsAndStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentPersona = personas.find((p) => p.id === activePersonaId) || {
    id: 'default',
    name: '0xAgent',
    icon: 'smart_toy',
  };

  const isModelRunning = (model: any): boolean => {
    if (!serverStatus.running || !serverStatus.modelPath) return false;
    const serverModelPath = serverStatus.modelPath.toLowerCase().replace(/\\/g, '/');
    const modelFilePath = (model.filePath || '').toLowerCase().replace(/\\/g, '/');
    if (modelFilePath && serverModelPath === modelFilePath) return true;
    const serverBasename = serverModelPath.split('/').pop() || '';
    const modelBasename = (model.fileName || '').toLowerCase();
    return serverBasename === modelBasename;
  };

  // Switch to an API Model and STOP local server
  const handleSelectCloudModel = async (modelId: string) => {
    setOpenMenu('none');
    try {
      let currentCfg = config;
      if (!currentCfg) currentCfg = await api.get_config();
      const updatedCfg: AppConfig = { ...currentCfg, model_name: modelId };
      await api.save_config(updatedCfg);

      setModelsData((prev) => ({ ...prev, activeModelId: modelId }));
      if (onModelChanged) onModelChanged(modelId);

      if (serverStatus.running) {
        try {
          await api.stop_local_server();
          setServerStatus((prev) => ({ ...prev, running: false }));
          showToast(`Модель: ${modelId}. Сервер остановлен.`, 'info');
        } catch {
          showToast(`Модель: ${modelId}`, 'success');
        }
      } else {
        showToast(`Модель: ${modelId}`, 'success');
      }
    } catch (err: any) {
      showToast(`Ошибка смены модели: ${err.message || err}`, 'error');
    }
  };

  // Switch to a Local GGUF Model and start/switch server
  const handleSelectLocalModel = async (model: any) => {
    setOpenMenu('none');
    try {
      let currentCfg = config;
      if (!currentCfg) currentCfg = await api.get_config();
      const updatedCfg: AppConfig = {
        ...currentCfg,
        model_name: model.id,
        local_server: {
          ...(currentCfg?.local_server || {}),
          model_path: model.filePath,
        },
      };
      await api.save_config(updatedCfg);
      setModelsData((prev) => ({ ...prev, activeModelId: model.id }));
      if (onModelChanged) onModelChanged(model.id);

      if (!serverStatus.running || !isModelRunning(model)) {
        setIsStartingServer(true);
        showToast(`Запуск llama.cpp (${model.title || model.fileName})...`, 'info');
        try {
          const ls = updatedCfg.local_server;
          await api.start_local_server({
            modelPath: model.filePath,
            exePath: ls?.exe_path,
            host: ls?.host || '127.0.0.1',
            port: ls?.port || 11434,
            ctxSize: ls?.ctx_size,
            gpuLayers: ls?.gpu_layers,
            threads: ls?.threads,
            flashAttn: ls?.flash_attn,
          });
          setServerStatus((prev) => ({
            ...prev,
            running: true,
            modelPath: model.filePath,
            modelName: model.title || model.fileName,
          }));
          showToast('Локальный сервер готов!', 'success');
        } catch (serverErr: any) {
          showToast(`Ошибка старта сервера: ${serverErr.message || serverErr}`, 'error');
        } finally {
          setIsStartingServer(false);
        }
      } else {
        showToast(`Локальная модель: ${model.title || model.fileName}`, 'success');
      }
    } catch (err: any) {
      showToast(`Ошибка смены модели: ${err.message || err}`, 'error');
    }
  };

  // Manual Toggle Server
  const handleToggleServer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (serverStatus.running) {
      try {
        await api.stop_local_server();
        setServerStatus((prev) => ({ ...prev, running: false }));
        showToast('Сервер llama.cpp остановлен', 'info');
      } catch (err: any) {
        showToast(`Ошибка остановки: ${err.message || err}`, 'error');
      }
    } else {
      setIsStartingServer(true);
      try {
        let currentCfg = config;
        if (!currentCfg) currentCfg = await api.get_config();
        const ls = currentCfg?.local_server;
        const res = await api.start_local_server({
          modelPath: ls?.model_path,
          exePath: ls?.exe_path,
          host: ls?.host || '127.0.0.1',
          port: ls?.port || 11434,
          ctxSize: ls?.ctx_size,
          gpuLayers: ls?.gpu_layers,
          threads: ls?.threads,
          flashAttn: ls?.flash_attn,
        });
        if (res?.success) {
          setServerStatus((prev) => ({ ...prev, running: true }));
          showToast('Сервер llama.cpp запущен!', 'success');
        }
      } catch (err: any) {
        showToast(`Ошибка запуска: ${err.message || err}`, 'error');
      } finally {
        setIsStartingServer(false);
      }
    }
  };

  const getDisplayTitle = (id: string): string => {
    const cloudMatch = modelsData.cloud.find((m) => m.id === id);
    if (cloudMatch) return cloudMatch.name;

    const localMatch = modelsData.local.find((m) => m.id === id || m.fileName === id || `local:${m.fileName}` === id);
    if (localMatch) return localMatch.title || localMatch.fileName;

    if (id.startsWith('local:')) {
      const fn = id.replace(/^local:/, '');
      return fn.replace(/\.gguf$/i, '');
    }
    return id;
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(180, Math.max(38, textareaRef.current.scrollHeight))}px`;
    }
  }, [inputText]);

  useEffect(() => {
    if (inputText.startsWith('/')) {
      const query = inputText.slice(1).toLowerCase();
      setSlashFilter(query);
      setOpenMenu('slash');
      setSelectedSlashIndex(0);
    } else if (openMenu === 'slash') {
      setOpenMenu('none');
    }
  }, [inputText]);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu('none');
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  const filteredSlashCommands = SLASH_COMMANDS.filter(
    (c) => c.cmd.toLowerCase().includes(slashFilter) || c.label.toLowerCase().includes(slashFilter)
  );

  const handleSelectSlash = (item: SlashCommandItem) => {
    setInputText(`${item.cmd} `);
    setOpenMenu('none');
    if (onTriggerSlashCommand) {
      onTriggerSlashCommand(item.cmd);
    }
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (openMenu === 'slash' && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSlash(filteredSlashCommands[selectedSlashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpenMenu('none');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onAttachImages([...attachedImages, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const isBusy = agentStatus === 'thinking' || agentStatus === 'executing_tool';

  return (
    <div className="relative w-full max-w-3xl mx-auto select-none" ref={menuRef}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* 1. Slash Commands Dropdown */}
      {openMenu === 'slash' && filteredSlashCommands.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 w-full bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn">
          <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--theme-border)]/50 mb-1">
            <span>Команды</span>
            <span>Tab / ↵ для выбора</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin">
            {filteredSlashCommands.map((item, idx) => (
              <button
                key={item.cmd}
                type="button"
                onClick={() => handleSelectSlash(item)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  idx === selectedSlashIndex
                    ? 'bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md bg-black/40 text-[var(--theme-text-muted)]">{item.icon}</div>
                  <div>
                    <div className="font-medium text-xs text-[var(--theme-text)]">{item.label}</div>
                    <div className="text-[11px] text-[var(--theme-text-muted)]">{item.description}</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[var(--theme-text-muted)]">{item.cmd}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Persona Selector Popover (Unified Persona Card Style) */}
      {openMenu === 'persona' && personas.length > 0 && (
        <div className="absolute bottom-full mb-2 left-4 w-60 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn">
          <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)]/50 mb-1">
            Персона
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (onSelectPersona) onSelectPersona(p.id);
                  setOpenMenu('none');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  p.id === activePersonaId
                    ? 'bg-white/10 text-[var(--theme-text)] font-semibold border border-[var(--theme-border)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
                }`}
              >
                <User size={13} className="text-[var(--theme-text-muted)]" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Model Selector Popover (EXACT SAME Container & Styling as Persona Popover) */}
      {openMenu === 'model' && (
        <div className="absolute bottom-full mb-2 left-24 sm:left-28 w-68 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn">
          {/* Cloud API Models */}
          <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)]/50 mb-1 flex items-center justify-between">
            <span>Облачные API</span>
            <span className="opacity-60 text-[9px]">Google AI</span>
          </div>
          <div className="space-y-0.5 mb-1.5">
            {modelsData.cloud.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectCloudModel(m.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  activeModelId === m.id
                    ? 'bg-white/10 text-[var(--theme-text)] font-semibold border border-[var(--theme-border)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {m.isAudio ? (
                    <Volume2 size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                  ) : (
                    <Cloud size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                  )}
                  <span className="truncate">{m.name}</span>
                </div>
                {activeModelId === m.id && <Check size={12} className="text-[var(--theme-text)] shrink-0" />}
              </button>
            ))}
          </div>

          {/* Local Models */}
          <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)]/50 mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span>Локальные GGUF</span>
              <span className="text-[9px] font-mono opacity-60">
                ({serverStatus.running ? 'online' : 'offline'})
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleServer}
              disabled={isStartingServer}
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[var(--theme-text)] border border-[var(--theme-border)] text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
            >
              {isStartingServer ? (
                <RefreshCw size={8} className="animate-spin" />
              ) : serverStatus.running ? (
                <Square size={7} fill="currentColor" />
              ) : (
                <Play size={7} fill="currentColor" />
              )}
              <span>{serverStatus.running ? 'Стоп' : 'Старт'}</span>
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-0.5 scrollbar-thin">
            {modelsData.local.length === 0 ? (
              <div className="text-[10px] text-[var(--theme-text-muted)] italic py-1 px-2.5 font-mono">
                нет файлов в ~/.0xagent/models/
              </div>
            ) : (
              modelsData.local.map((m) => {
                const isActive =
                  activeModelId === m.id || activeModelId === m.fileName || activeModelId === `local:${m.fileName}`;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectLocalModel(m)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-[var(--theme-text)] font-semibold border border-[var(--theme-border)]'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <HardDrive size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                      <span className="truncate">{m.title || m.fileName}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0">{m.sizeGB}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Attached Images Previews */}
      {attachedImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-2">
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-[var(--theme-border)] shadow-md">
              <img src={img} alt="attached preview" className="w-14 h-14 object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(idx)}
                className="absolute top-1 right-1 p-0.5 rounded-md bg-black/80 text-white hover:bg-white/20 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Floating Glass Container */}
      <form onSubmit={onSubmit}>
        <div className="bento-card p-2.5 bg-[var(--theme-panel)]/95 backdrop-blur-xl border border-[var(--theme-border)] focus-within:border-[var(--theme-border)] focus-within:ring-1 focus-within:ring-[var(--theme-border)] transition-all flex flex-col gap-1.5">
          
          {/* Top Row: Attachment + Full-width Textarea */}
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 mt-0.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              title="Прикрепить файл"
            >
              <Plus size={16} />
            </button>

            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Опишите задачу или введите / для спец-команд..."
              className="w-full bg-transparent text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] text-xs focus:outline-none resize-none min-h-[36px] max-h-[160px] py-1 leading-relaxed font-sans"
            />
          </div>

          {/* Bottom Action Controls: Chips, Toggles & Send */}
          <div className="flex items-center justify-between pt-1.5 border-t border-[var(--theme-border)] text-xs">
            
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Persona Selector Chip */}
              {personas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'persona' ? 'none' : 'persona')}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                    openMenu === 'persona'
                      ? 'bg-white/15 text-[var(--theme-text)] border-[var(--theme-border)] shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
                  }`}
                  title="Сменить персону"
                >
                  <User size={12} />
                  <span className="max-w-[85px] truncate">{currentPersona.name}</span>
                </button>
              )}

              {/* Model Selector Chip */}
              <button
                type="button"
                onClick={() => {
                  fetchModelsAndStatus();
                  setOpenMenu(openMenu === 'model' ? 'none' : 'model');
                }}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                  openMenu === 'model' || isLocalActive
                    ? 'bg-white/15 text-[var(--theme-text)] border-[var(--theme-border)] shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
                }`}
                title={`Текущая модель: ${activeModelId}`}
              >
                <div className="relative shrink-0 flex items-center">
                  {isLocalActive ? <Cpu size={12} /> : <Cloud size={12} />}
                  {isLocalActive && serverStatus.running && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white absolute -top-0.5 -right-0.5 animate-pulse" />
                  )}
                </div>
                <span className="max-w-[120px] truncate">{getDisplayTitle(activeModelId)}</span>
                <Sliders size={10} className="text-[var(--theme-text-muted)] opacity-60 shrink-0" />
              </button>

              {onTogglePlanningMode && (
                <button
                  type="button"
                  onClick={onTogglePlanningMode}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono transition-all cursor-pointer ${
                    planningMode
                      ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)]'
                      : 'bg-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-transparent'
                  }`}
                  title="Включить режим рассуждений / планирования"
                >
                  <Brain size={12} />
                  <span>Размышление</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setInputText('/');
                  setOpenMenu('slash');
                  textareaRef.current?.focus();
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer"
                title="Открыть меню команд"
              >
                <span>/</span>
                <span>Команды</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {onToggleRecording && (
                <button
                  type="button"
                  onClick={onToggleRecording}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRecording
                      ? 'bg-white/20 text-[var(--theme-text)] animate-pulse'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                  }`}
                  title="Голосовой ввод"
                >
                  {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}

              {isBusy && onCancelAgent ? (
                <button
                  type="button"
                  onClick={onCancelAgent}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[var(--theme-text)] transition-colors cursor-pointer"
                  title="Остановить выполнение"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim() && attachedImages.length === 0}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent text-[var(--theme-text)] transition-colors cursor-pointer"
                  title="Отправить"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>

        </div>
      </form>
    </div>
  );
};
