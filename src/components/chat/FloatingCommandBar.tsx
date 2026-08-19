import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  ArrowUp,
  Square,
  Terminal,
  Bot,
  Globe,
  Code,
  User,
  Cloud,
  Cpu,
  HardDrive,
  Check,
  Volume2,
  Play,
  RefreshCw,
  Mic,
  Shield,
  Sparkles,
} from 'lucide-react';
import { AppConfig, PersonaMetadata, PermissionPreset, ReasoningEffortLevel } from '../../types';
import { useModelManager } from '../../hooks/useModelManager';
import * as api from '../../services/api';

interface FloatingCommandBarProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onCancelAgent?: () => void;
  chatMode?: 'agent' | 'simple';
  planningMode?: boolean;
  onTogglePlanningMode?: () => void;
  personas?: PersonaMetadata[];
  activePersonaId?: string;
  onSelectPersona?: (id: string) => void;
  attachedImages: string[];
  onAttachImages: (images: string[]) => void;
  onRemoveImage: (index: number) => void;
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
  planningMode: _planningMode,
  onTogglePlanningMode: _onTogglePlanningMode,
  personas = [],
  activePersonaId = 'default',
  onSelectPersona,
  attachedImages,
  onAttachImages,
  onRemoveImage,
  onTriggerSlashCommand,
  config,
  onModelChanged,
}) => {
  // Single active popup state - prevents any double opening
  const [openMenu, setOpenMenu] = useState<'none' | 'persona' | 'model' | 'slash' | 'permission' | 'reasoning'>('none');
  const [permissionPreset, setPermissionPreset] = useState<PermissionPreset>(
    (config?.permission_preset as PermissionPreset) || 'prompt'
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortLevel>(
    (config?.reasoning_effort as ReasoningEffortLevel) || 'auto'
  );
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  useEffect(() => {
    if (config?.permission_preset) {
      setPermissionPreset(config.permission_preset as PermissionPreset);
    }
  }, [config?.permission_preset]);

  useEffect(() => {
    if (config?.reasoning_effort) {
      setReasoningEffort(config.reasoning_effort as ReasoningEffortLevel);
    }
  }, [config?.reasoning_effort]);

  const handleSelectPreset = async (preset: PermissionPreset) => {
    setPermissionPreset(preset);
    setOpenMenu('none');
    try {
      if (config) {
        await api.save_config({ ...config, permission_preset: preset });
      }
    } catch {}
  };

  const handleSelectReasoningEffort = async (effort: ReasoningEffortLevel) => {
    setReasoningEffort(effort);
    setOpenMenu('none');
    try {
      if (config) {
        await api.save_config({
          ...config,
          reasoning_effort: effort,
          reasoning_enabled: effort !== 'off',
        });
      }
    } catch {}
  };

  // Model & Server Management Hook
  const {
    modelsData,
    serverStatus,
    activeModelId,
    isLocalActive,
    isStartingServer,
    fetchModelsAndStatus,
    selectCloudModel,
    selectLocalModel,
    toggleServer,
    getDisplayTitle,
  } = useModelManager(config, onModelChanged);

  // Determine current active model's reasoning capabilities & recommendations
  const activeModelLower = (activeModelId || '').toLowerCase();
  const currentLocalMeta = isLocalActive
    ? modelsData?.local?.find((m) => m.filePath === activeModelId || m.fileName === activeModelId || m.title === activeModelId)
    : null;

  const supportsReasoning = Boolean(
    currentLocalMeta?.supportsReasoning ||
    activeModelLower.includes('qwen3') ||
    activeModelLower.includes('gemma-4') ||
    activeModelLower.includes('deepseek-r1') ||
    activeModelLower.includes('r1-distill') ||
    activeModelLower.includes('phi-4') ||
    activeModelLower.includes('thinking') ||
    activeModelLower.includes('gemini-3.6')
  );

  const recommendedEffort: ReasoningEffortLevel =
    currentLocalMeta?.recommendedReasoningEffort ||
    (activeModelLower.includes('qwen3')
      ? 'xhigh'
      : activeModelLower.includes('deepseek')
      ? 'high'
      : activeModelLower.includes('gemma') || activeModelLower.includes('gemini') || activeModelLower.includes('phi')
      ? 'medium'
      : 'off');

  const [daemonVoiceState, setDaemonVoiceState] = useState<'idle' | 'recording' | 'processing' | 'stopped'>('idle');
  const [voicePhraseNotification, setVoicePhraseNotification] = useState<string | null>(null);
  const isListeningForWake = Boolean(config?.tts_config?.wake_word_enabled);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  // Toggle native desktop Voice Daemon recording (zero browser mic overhead)
  const handleMicClick = async () => {
    try {
      await api.toggle_voice_daemon_recording();
    } catch (err) {
      console.error('Failed to toggle native voice recording:', err);
    }
  };

  // Subscribe to native desktop Voice Daemon events
  useEffect(() => {
    const un1 = api.listen<{ text: string }>('jarvis_voice_transcribed', (e) => {
      if (e.payload?.text) {
        const cur = inputTextRef.current;
        setInputText(cur ? `${cur} ${e.payload.text}` : e.payload.text);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    });

    const un2 = api.listen<{ state: 'idle' | 'recording' | 'processing' | 'stopped'; phrase?: string }>('jarvis_voice_state', (e) => {
      if (e.payload?.state) {
        setDaemonVoiceState(e.payload.state);
        if (e.payload.phrase) {
          setVoicePhraseNotification(e.payload.phrase);
          setTimeout(() => setVoicePhraseNotification(null), 3000);
        }
      }
    });

    return () => {
      un1();
      un2();
    };
  }, [setInputText]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentPersona = personas.find((p) => p.id === activePersonaId) || {
    id: 'default',
    name: '0xAgent',
    icon: 'smart_toy',
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(160, Math.max(30, textareaRef.current.scrollHeight))}px`;
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

    if (e.key === 'Escape' && openMenu !== 'none') {
      e.preventDefault();
      setOpenMenu('none');
      return;
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
  const canSubmit = inputText.trim().length > 0 || attachedImages.length > 0;

  return (
    <div className="relative w-full max-w-3xl mx-auto select-none font-sans" ref={menuRef}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* 1. Slash Commands Popover */}
      {openMenu === 'slash' && filteredSlashCommands.length > 0 && (
        <div className="absolute bottom-full mb-3 left-0 w-full bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn rounded-2xl">
          <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--theme-border)] mb-1">
            <span className="font-bold text-[var(--theme-text)]">Команды</span>
            <span>Tab / ↵ для выбора</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
            {filteredSlashCommands.map((item, idx) => (
              <button
                key={item.cmd}
                type="button"
                onClick={() => handleSelectSlash(item)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  idx === selectedSlashIndex
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-semibold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${idx === selectedSlashIndex ? 'bg-white/20 text-[var(--theme-accent-text)]' : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)]'}`}>{item.icon}</div>
                  <div>
                    <div className="font-bold text-xs">{item.label}</div>
                    <div className={`text-[11px] ${idx === selectedSlashIndex ? 'opacity-80' : 'text-[var(--theme-text-muted)]'}`}>{item.description}</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] opacity-75">{item.cmd}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Persona Selector Popover */}
      {openMenu === 'persona' && personas.length > 0 && (
        <div className="absolute bottom-full mb-3 left-2 w-64 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn rounded-2xl">
          <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 font-bold text-[var(--theme-text)]">
            Персона
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (onSelectPersona) onSelectPersona(p.id);
                  setOpenMenu('none');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  p.id === activePersonaId
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <User size={14} className={p.id === activePersonaId ? 'text-[var(--theme-accent-text)]' : 'text-[var(--theme-text-muted)]'} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Model Selector Popover */}
      {openMenu === 'model' && (
        <div className="absolute bottom-full mb-3 left-24 sm:left-32 w-72 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn rounded-2xl">
          {/* Cloud API Models */}
          <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
            <span className="font-bold text-[var(--theme-text)]">Облачные API</span>
            <span className="opacity-60 text-[9px]">Google AI</span>
          </div>
          <div className="space-y-1 mb-2">
            {modelsData.cloud.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  selectCloudModel(m.id);
                  setOpenMenu('none');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  activeModelId === m.id
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {m.isAudio ? (
                    <Volume2 size={14} className={activeModelId === m.id ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'} />
                  ) : (
                    <Cloud size={14} className={activeModelId === m.id ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'} />
                  )}
                  <span className="truncate">{m.name}</span>
                </div>
                {activeModelId === m.id && <Check size={13} className="text-[var(--theme-accent-text)] shrink-0" />}
              </button>
            ))}
          </div>

          {/* Local Models */}
          <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[var(--theme-text)]">Локальные GGUF</span>
              <span className="text-[9px] font-mono opacity-60">
                ({serverStatus.running ? 'online' : 'offline'})
              </span>
            </div>
            <button
              type="button"
              onClick={toggleServer}
              disabled={isStartingServer}
              className="px-2 py-0.5 rounded-lg bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-semibold text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
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

          <div className="max-h-44 overflow-y-auto space-y-1 scrollbar-thin">
            {modelsData.local.filter((m) => !m.isDraft && !m.isMmproj).length === 0 ? (
              <div className="text-[10px] text-[var(--theme-text-muted)] italic py-1 px-2.5 font-mono">
                нет файлов в ~/.0xagent/models/
              </div>
            ) : (
              modelsData.local
                .filter((m) => !m.isDraft && !m.isMmproj)
                .map((m) => {
                const isActive =
                  activeModelId === m.id || activeModelId === m.fileName || activeModelId === `local:${m.fileName}`;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      selectLocalModel(m);
                      setOpenMenu('none');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <HardDrive size={13} className={isActive ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'} />
                      <span className="truncate font-medium">{m.title || m.fileName}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0 font-bold">{m.sizeGB}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. Permission Preset Popover */}
      {openMenu === 'permission' && (
        <div className="absolute bottom-full mb-3 left-48 sm:left-64 w-76 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn rounded-2xl">
          <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
            <span className="font-bold text-[var(--theme-text)]">Безопасность (DeepSeek Presets)</span>
            <Shield size={12} className="opacity-60" />
          </div>
          <div className="space-y-1">
            {[
              { id: 'readonly', title: 'Только чтение', desc: 'Запрещены любые изменения файлов и запуск команд' },
              { id: 'workspace-write', title: 'Песочница проекта', desc: 'Разрешено менять файлы только внутри проекта' },
              { id: 'prompt', title: 'Подтверждение', desc: 'Запрашивать одобрение на опасные и модифицирующие действия' },
              { id: 'unrestricted', title: 'Полная автономия', desc: 'Автоматическое выполнение всех действий' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id as PermissionPreset)}
                className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  permissionPreset === preset.id
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-xs">{preset.title}</div>
                  <div className={`text-[10px] leading-tight ${permissionPreset === preset.id ? 'opacity-80' : 'text-[var(--theme-text-muted)]'}`}>{preset.desc}</div>
                </div>
                {permissionPreset === preset.id && <Check size={14} className="text-[var(--theme-accent-text)] shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Reasoning Effort Popover */}
      {openMenu === 'reasoning' && (
        <div className="absolute bottom-full mb-3 left-64 sm:left-80 w-80 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn rounded-2xl">
          <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
            <span className="font-bold text-[var(--theme-text)]">Степень рассуждений &lt;think&gt;</span>
            <Sparkles size={12} className="opacity-60 text-sky-400" />
          </div>
          <div className="space-y-1">
            {[
              {
                id: 'auto',
                title: `Авто (Рекомендовано: ${recommendedEffort.toUpperCase()})`,
                desc: supportsReasoning
                  ? `Авто-подбор под модель (${recommendedEffort.toUpperCase()})`
                  : 'Модель без глубокого CoT (прямой ответ)',
              },
              { id: 'off', title: 'Отключено (Off)', desc: 'Прямой быстрый ответ без генерации мыслей <think>' },
              { id: 'low', title: 'Низкая (Low)', desc: 'Лаконичный ход мыслей, экономия токенов и времени' },
              { id: 'medium', title: 'Средняя (Medium)', desc: 'Сбалансированное мышление (Gemma 4 / Gemini standard)' },
              { id: 'high', title: 'Высокая (High)', desc: 'Глубокий анализ задач и алгоритмов (DeepSeek-R1 standard)' },
              { id: 'xhigh', title: 'Максимальная (X-High)', desc: 'Максимальная глубина рассуждений (Qwen 3.8 default)' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectReasoningEffort(item.id as ReasoningEffortLevel)}
                className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  reasoningEffort === item.id
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-xs">{item.title}</div>
                  <div className={`text-[10px] leading-tight ${reasoningEffort === item.id ? 'opacity-80' : 'text-[var(--theme-text-muted)]'}`}>{item.desc}</div>
                </div>
                {reasoningEffort === item.id && <Check size={14} className="text-[var(--theme-accent-text)] shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attached Images Previews */}
      {attachedImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-2">
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-[var(--theme-border)] shadow-md">
              <img src={img} alt="attached preview" className="w-14 h-14 object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(idx)}
                className="absolute top-1 right-1 p-1 rounded-md bg-black/80 text-white hover:bg-rose-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recording / Voice Feedback HUD Banner */}
      {daemonVoiceState === 'recording' && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-2 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono text-xs backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-xl shadow-rose-950/50">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="font-bold tracking-wider text-[11px] text-white">JARVIS :: RECORDING</span>
            <span className="text-[11px] text-rose-300/80">
              {voicePhraseNotification ? `«${voicePhraseNotification}»` : 'Слушаю вас... (Скажите «Стоп» или кликните)'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1 h-3 bg-rose-400 rounded-full animate-pulse" />
            <span className="w-1 h-4 bg-rose-400 rounded-full animate-pulse delay-75" />
            <span className="w-1 h-2 bg-rose-400 rounded-full animate-pulse delay-150" />
            <span className="w-1 h-4 bg-rose-400 rounded-full animate-pulse delay-100" />
            <span className="w-1 h-3 bg-rose-400 rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {daemonVoiceState === 'processing' && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-2 rounded-2xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] font-mono text-xs backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-lg">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin text-[var(--theme-accent)]" />
            <span className="font-bold tracking-wider text-xs text-[var(--theme-text)]">JARVIS :: GROQ WHISPER</span>
            <span className="text-xs text-[var(--theme-text-muted)]">Расшифровка голосовой команды...</span>
          </div>
        </div>
      )}

      {/* 1. Seamless Capsule Input */}
      <form onSubmit={onSubmit}>
        <div className="bento-card rounded-3xl p-2 px-4 bg-[var(--theme-panel)]/95 backdrop-blur-2xl border border-[var(--theme-border)] focus-within:border-[var(--theme-accent)] transition-all flex items-center gap-3 shadow-xl">
          
          {/* Plus Attach File Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer shrink-0 self-center"
            title="Прикрепить изображение"
          >
            <Plus size={19} />
          </button>

          {/* Centered Message Textarea with enlarged 15px font size */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Спросите что угодно или введите / для команд..."
            className="w-full bg-transparent text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] text-[15px] focus:outline-none resize-none min-h-[32px] max-h-[140px] py-1.5 px-1 leading-normal font-sans self-center font-medium"
          />

          {/* Microphone Voice Input (Groq Whisper + Native OS Voice Daemon) */}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={daemonVoiceState === 'processing'}
            className={`w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 self-center relative ${
              daemonVoiceState === 'recording'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 scale-105 animate-pulse'
                : daemonVoiceState === 'processing'
                ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text)] cursor-wait animate-pulse'
                : isListeningForWake
                ? 'text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
            }`}
            title={
              daemonVoiceState === 'recording'
                ? 'Идет запись речи через системный демон... (Скажите "Стоп" или кликните)'
                : daemonVoiceState === 'processing'
                ? 'Расшифровка Groq Whisper...'
                : isListeningForWake
                ? 'Фоновый голосовой демон активен (Скажите "Джарвис" или кликните)'
                : 'Голосовой ввод (Groq Whisper, Gain Boost 3.2x)'
            }
          >
            {daemonVoiceState === 'recording' ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60 pointer-events-none" />
                <Square size={13} fill="currentColor" />
              </>
            ) : daemonVoiceState === 'processing' ? (
              <RefreshCw size={15} className="animate-spin text-[var(--theme-text)]" />
            ) : (
              <>
                {isListeningForWake && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--theme-accent)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--theme-accent)]"></span>
                  </span>
                )}
                <Mic size={17} />
              </>
            )}
          </button>

          {/* Right Action Controls: Circular Send / Stop Button */}
          <div className="flex items-center shrink-0 self-center">
            {isBusy && onCancelAgent ? (
              <button
                type="button"
                onClick={onCancelAgent}
                className="w-9.5 h-9.5 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                title="Остановить выполнение"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all shadow-sm ${
                  canSubmit
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] hover:opacity-90 shadow-md hover:scale-105 active:scale-95 cursor-pointer font-bold'
                    : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] cursor-not-allowed border border-[var(--theme-border)] opacity-40'
                }`}
                title="Отправить сообщение (Enter)"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>

        </div>
      </form>

      {/* 2. Below Input Capsule: Persona, Model on Left, / Commands on Right */}
      <div className="flex items-center justify-between px-3 pt-2 text-xs text-[var(--theme-text-muted)] font-mono">
        
        {/* Left: Persona & Model Selectors */}
        <div className="flex items-center gap-2">
          {/* Persona Selector below input */}
          {personas.length > 0 && (
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'persona' ? 'none' : 'persona')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${
                openMenu === 'persona'
                  ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'
              }`}
              title="Сменить персону"
            >
              <User size={14} />
              <span className="truncate max-w-[100px] text-xs">{currentPersona.name}</span>
            </button>
          )}

          {/* Model Selector below input */}
          <button
            type="button"
            onClick={() => {
              fetchModelsAndStatus();
              setOpenMenu(openMenu === 'model' ? 'none' : 'model');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${
              openMenu === 'model'
                ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'
            }`}
            title="Выбрать модель"
          >
            {isLocalActive ? <Cpu size={14} /> : <Cloud size={14} />}
            <span className="truncate max-w-[140px] text-xs font-semibold">{getDisplayTitle(activeModelId)}</span>
          </button>
        </div>

        {/* Right: Presets & Slash Commands */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Reasoning Effort Level Selector */}
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'reasoning' ? 'none' : 'reasoning')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${
              openMenu === 'reasoning'
                ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'
            }`}
            title={`Глубина рассуждений <think>: ${reasoningEffort.toUpperCase()}`}
          >
            <Sparkles size={14} className="opacity-70" />
            <span className="text-xs uppercase font-bold">{reasoningEffort}</span>
          </button>

          {/* Permission Preset Selector */}
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'permission' ? 'none' : 'permission')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${
              openMenu === 'permission'
                ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'
            }`}
            title={`Режим безопасности: ${permissionPreset}`}
          >
            <Shield size={14} />
            <span className="text-xs hidden sm:inline font-semibold capitalize">
              {permissionPreset === 'workspace-write' ? 'project' : permissionPreset}
            </span>
          </button>

          {/* Slash Commands Dropdown Button */}
          <button
            type="button"
            onClick={() => {
              setSlashFilter('');
              setSelectedSlashIndex(0);
              setOpenMenu(openMenu === 'slash' ? 'none' : 'slash');
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${
              openMenu === 'slash'
                ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'
            }`}
            title="Быстрые команды (/goal, /search, /patch, /clear)"
          >
            <Terminal size={14} />
            <span className="text-xs font-bold">/</span>
          </button>
        </div>

      </div>

    </div>
  );
};


