import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  ArrowUp,
  Square,
  Terminal,
  User,
  Cloud,
  Cpu,
  RefreshCw,
  Mic,
  Shield,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AppConfig, PersonaMetadata, PermissionPreset, ReasoningEffortLevel } from '../../types';
import { useModelManager } from '../../hooks/useModelManager';
import * as api from '../../services/api';
import {
  PersonaPopover,
  ModelPopover,
  SlashMenuPopover,
  PermissionPopover,
  ReasoningPopover,
  DEFAULT_SLASH_COMMANDS,
  SlashCommandItem,
} from './popovers';

interface FloatingCommandBarProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  onCancelAgent?: () => void;
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

export const FloatingCommandBar: React.FC<FloatingCommandBarProps> = ({
  inputText,
  setInputText,
  onSubmit,
  agentStatus,
  onCancelAgent,
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
  const [openMenu, setOpenMenu] = useState<'none' | 'persona' | 'model' | 'slash' | 'permission' | 'reasoning'>('none');
  const [permissionPreset, setPermissionPreset] = useState<PermissionPreset>((config?.permission_preset as PermissionPreset) || 'prompt');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortLevel>((config?.reasoning_effort as ReasoningEffortLevel) || 'auto');
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [daemonVoiceState, setDaemonVoiceState] = useState<'idle' | 'recording' | 'processing' | 'stopped'>('idle');
  const [voicePhraseNotification, setVoicePhraseNotification] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  useEffect(() => {
    if (config?.permission_preset) setPermissionPreset(config.permission_preset as PermissionPreset);
    if (config?.reasoning_effort) setReasoningEffort(config.reasoning_effort as ReasoningEffortLevel);
  }, [config?.permission_preset, config?.reasoning_effort]);

  const handleSelectPreset = async (preset: PermissionPreset) => {
    setPermissionPreset(preset);
    setOpenMenu('none');
    try {
      if (config) await api.save_config({ ...config, permission_preset: preset });
    } catch {}
  };

  const handleSelectReasoningEffort = async (effort: ReasoningEffortLevel) => {
    setReasoningEffort(effort);
    setOpenMenu('none');
    try {
      if (config) await api.save_config({ ...config, reasoning_effort: effort, reasoning_enabled: effort !== 'off' });
    } catch {}
  };

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

  const activeModelLower = (activeModelId || '').toLowerCase();
  const currentLocalMeta = isLocalActive
    ? modelsData?.local?.find((m) => m.filePath === activeModelId || m.fileName === activeModelId || m.title === activeModelId)
    : null;

  const supportsReasoning = Boolean(
    currentLocalMeta?.supportsReasoning ||
    ['qwen3', 'gemma-4', 'deepseek-r1', 'r1-distill', 'phi-4', 'thinking', 'gemini-3.6'].some((k) => activeModelLower.includes(k))
  );

  const recommendedEffort: ReasoningEffortLevel =
    currentLocalMeta?.recommendedReasoningEffort ||
    (activeModelLower.includes('qwen3') ? 'xhigh' : activeModelLower.includes('deepseek') ? 'high' : activeModelLower.includes('gemma') || activeModelLower.includes('gemini') || activeModelLower.includes('phi') ? 'medium' : 'off');

  const isListeningForWake = Boolean(config?.tts_config?.wake_word_enabled);

  const handleMicClick = async () => {
    try {
      await api.toggle_voice_daemon_recording();
    } catch (err) {
      console.error('Failed to toggle voice recording:', err);
    }
  };

  useEffect(() => {
    const un1 = api.listen<{ text: string }>('jarvis_voice_transcribed', (e) => {
      if (e.payload?.text) {
        const cur = inputTextRef.current;
        setInputText(cur ? `${cur} ${e.payload.text}` : e.payload.text);
        if (textareaRef.current) textareaRef.current.focus();
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

  const currentPersona = personas.find((p) => p.id === activePersonaId) || { id: 'default', name: '0xAgent', icon: 'smart_toy' };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = isExpanded ? '280px' : `${Math.min(220, Math.max(34, textareaRef.current.scrollHeight))}px`;
    }
  }, [inputText, isExpanded]);

  useEffect(() => {
    if (inputText.startsWith('/')) {
      setSlashFilter(inputText.slice(1).toLowerCase());
      setOpenMenu('slash');
      setSelectedSlashIndex(0);
    } else if (openMenu === 'slash') {
      setOpenMenu('none');
    }
  }, [inputText]);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu('none');
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  const filteredSlashCommands = DEFAULT_SLASH_COMMANDS.filter(
    (c) => c.cmd.toLowerCase().includes(slashFilter) || c.label.toLowerCase().includes(slashFilter)
  );

  const handleSelectSlash = (item: SlashCommandItem) => {
    setInputText(`${item.cmd} `);
    setOpenMenu('none');
    onTriggerSlashCommand?.(item.cmd);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (openMenu === 'slash' && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((p) => (p + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((p) => (p - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSlash(filteredSlashCommands[selectedSlashIndex]);
        return;
      }
    }
    if (e.key === 'Escape') {
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
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') onAttachImages([...attachedImages, reader.result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const isBusy = agentStatus === 'thinking' || agentStatus === 'executing_tool';
  const canSubmit = inputText.trim().length > 0 || attachedImages.length > 0;

  return (
    <div className="relative w-full max-w-3xl mx-auto select-none font-sans" ref={menuRef}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />

      {openMenu === 'slash' && <SlashMenuPopover commands={filteredSlashCommands} selectedIndex={selectedSlashIndex} onSelectCommand={handleSelectSlash} />}
      {openMenu === 'persona' && <PersonaPopover personas={personas} activePersonaId={activePersonaId} onSelectPersona={(id) => onSelectPersona?.(id)} onClose={() => setOpenMenu('none')} />}
      {openMenu === 'model' && <ModelPopover modelsData={modelsData} serverStatus={serverStatus} activeModelId={activeModelId} isStartingServer={isStartingServer} onSelectCloudModel={selectCloudModel} onSelectLocalModel={selectLocalModel} onToggleServer={toggleServer} onClose={() => setOpenMenu('none')} />}
      {openMenu === 'permission' && <PermissionPopover permissionPreset={permissionPreset} onSelectPreset={handleSelectPreset} />}
      {openMenu === 'reasoning' && <ReasoningPopover reasoningEffort={reasoningEffort} recommendedEffort={recommendedEffort} supportsReasoning={supportsReasoning} onSelectEffort={handleSelectReasoningEffort} />}

      {attachedImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-2">
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-[var(--theme-border)] shadow-md">
              <img src={img} alt="preview" className="w-14 h-14 object-cover" />
              <button type="button" onClick={() => onRemoveImage(idx)} className="absolute top-1 right-1 p-1 rounded-md bg-black/80 text-white hover:bg-rose-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {daemonVoiceState === 'recording' && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-2 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono text-xs backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-xl shadow-rose-950/50">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="font-bold tracking-wider text-[11px] text-white">JARVIS :: RECORDING</span>
            <span className="text-[11px] text-rose-300/80">{voicePhraseNotification ? `«${voicePhraseNotification}»` : 'Слушаю вас... (Скажите «Стоп» или кликните)'}</span>
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

      <form onSubmit={onSubmit}>
        <div className={`bento-card rounded-3xl p-2 px-4 bg-[var(--theme-panel)]/95 backdrop-blur-2xl border border-[var(--theme-border)] focus-within:border-[var(--theme-accent)] transition-all flex items-end gap-3 shadow-xl ${isExpanded ? 'ring-1 ring-[var(--theme-accent)]/30' : ''}`}>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer shrink-0 self-center mb-0.5" title="Прикрепить изображение">
            <Plus size={19} />
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Спросите что угодно или введите / для команд..."
            className="w-full bg-transparent text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] text-[15px] focus:outline-none resize-none min-h-[34px] max-h-[300px] py-1.5 px-1 leading-normal font-sans font-medium scrollbar-thin"
          />

          {inputText.length > 30 && (
            <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer shrink-0 self-center mb-0.5" title={isExpanded ? 'Свернуть поле ввода' : 'Развернуть поле ввода'}>
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}

          <button
            type="button"
            onClick={handleMicClick}
            disabled={daemonVoiceState === 'processing'}
            className={`w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 self-center mb-0.5 relative ${
              daemonVoiceState === 'recording'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 scale-105 animate-pulse'
                : daemonVoiceState === 'processing'
                ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text)] cursor-wait animate-pulse'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
            }`}
            title={daemonVoiceState === 'recording' ? 'Идет запись речи...' : isListeningForWake ? 'Голосовой демон активен (Скажите "Джарвис" или кликните)' : 'Голосовой ввод'}
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
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--theme-accent)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--theme-accent)]" />
                  </span>
                )}
                <Mic size={17} />
              </>
            )}
          </button>

          <div className="flex items-center shrink-0 self-center">
            {isBusy && onCancelAgent ? (
              <button type="button" onClick={onCancelAgent} className="w-9.5 h-9.5 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95" title="Остановить выполнение">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" disabled={!canSubmit} className={`w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all shadow-sm ${canSubmit ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] hover:opacity-90 shadow-md hover:scale-105 active:scale-95 cursor-pointer font-bold' : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] cursor-not-allowed border border-[var(--theme-border)] opacity-40'}`} title="Отправить сообщение (Enter)">
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between px-3 pt-2 text-xs text-[var(--theme-text-muted)] font-mono">
        <div className="flex items-center gap-2">
          {personas.length > 0 && (
            <button type="button" onClick={() => setOpenMenu(openMenu === 'persona' ? 'none' : 'persona')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${openMenu === 'persona' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'}`} title="Сменить персону">
              <User size={14} />
              <span className="truncate max-w-[100px] text-xs">{currentPersona.name}</span>
            </button>
          )}

          <button type="button" onClick={() => { fetchModelsAndStatus(); setOpenMenu(openMenu === 'model' ? 'none' : 'model'); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${openMenu === 'model' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'}`} title="Выбрать модель">
            {isLocalActive ? <Cpu size={14} /> : <Cloud size={14} />}
            <span className="truncate max-w-[140px] text-xs font-semibold">{getDisplayTitle(activeModelId)}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={() => setOpenMenu(openMenu === 'reasoning' ? 'none' : 'reasoning')} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${openMenu === 'reasoning' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'}`} title={`Глубина рассуждений <think>: ${reasoningEffort.toUpperCase()}`}>
            <Sparkles size={14} className="opacity-70" />
            <span className="text-xs uppercase font-bold">{reasoningEffort}</span>
          </button>

          <button type="button" onClick={() => setOpenMenu(openMenu === 'permission' ? 'none' : 'permission')} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${openMenu === 'permission' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'}`} title={`Режим безопасности: ${permissionPreset}`}>
            <Shield size={14} />
            <span className="text-xs hidden sm:inline font-semibold capitalize">{permissionPreset === 'workspace-write' ? 'project' : permissionPreset}</span>
          </button>

          <button type="button" onClick={() => { setSlashFilter(''); setSelectedSlashIndex(0); setOpenMenu(openMenu === 'slash' ? 'none' : 'slash'); }} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${openMenu === 'slash' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent font-semibold'}`} title="Быстрые команды (/goal, /search, /patch, /clear)">
            <Terminal size={14} />
            <span className="text-xs font-bold">/</span>
          </button>
        </div>
      </div>
    </div>
  );
};
