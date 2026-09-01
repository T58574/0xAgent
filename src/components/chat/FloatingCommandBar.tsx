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
  Shield,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AppConfig, PersonaMetadata, PermissionPreset, ReasoningEffortLevel, QuickResponseOption } from '../../types';
import { useModelManager } from '../../hooks/useModelManager';
import { useI18n } from '../../i18n';
import * as api from '../../services/api';
import {
  PersonaPopover,
  ModelPopover,
  SlashMenuPopover,
  PermissionPopover,
  ReasoningPopover,
} from './popovers';
import { useSlashAutocomplete } from './useSlashAutocomplete';
import { QuickResponseStrip } from './QuickResponseStrip';
import { VeronicaActionStrip } from './VeronicaActionStrip';
import { VeronicaTaskModal } from '../veronica/VeronicaTaskModal';

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
  onConfigChanged?: (newConfig: AppConfig) => void;
  quickResponses?: QuickResponseOption[];
  onSelectQuickResponse?: (actionText: string) => void;
  isLastMessageAssistant?: boolean;
}

export const FloatingCommandBar: React.FC<FloatingCommandBarProps> = React.memo(({
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
  onConfigChanged,
  quickResponses = [],
  onSelectQuickResponse,
  isLastMessageAssistant = false,
}) => {
  const { t, language } = useI18n();
  const [openMenu, setOpenMenu] = useState<'none' | 'persona' | 'model' | 'slash' | 'permission' | 'reasoning'>('none');
  const [permissionPreset, setPermissionPreset] = useState<PermissionPreset>((config?.permission_preset as PermissionPreset) || 'prompt');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortLevel>((config?.reasoning_effort as ReasoningEffortLevel) || 'auto');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  const canSubmit = inputText.trim().length > 0 || attachedImages.length > 0;

  const {
    filteredSlashCommands,
    selectedSlashIndex,
    handleSelectSlash,
    handleKeyDown,
    handleFormSubmit,
  } = useSlashAutocomplete({
    inputText,
    setInputText,
    onTriggerSlashCommand,
    textareaRef,
    openMenu,
    setOpenMenu,
    onSubmit,
    canSubmit,
    setIsExpanded,
  });
  inputTextRef.current = inputText;

  useEffect(() => {
    if (config?.permission_preset !== undefined && config?.permission_preset !== null) {
      setPermissionPreset(config.permission_preset as PermissionPreset);
    }
    if (config?.reasoning_effort !== undefined && config?.reasoning_effort !== null) {
      setReasoningEffort(config.reasoning_effort as ReasoningEffortLevel);
    }
  }, [config?.permission_preset, config?.reasoning_effort]);

  const handleSelectPreset = async (preset: PermissionPreset) => {
    setPermissionPreset(preset);
    setOpenMenu('none');
    try {
      const baseCfg = (config || (await api.get_config())) as AppConfig;
      const updated: AppConfig = { ...baseCfg, permission_preset: preset };
      if (onConfigChanged) onConfigChanged(updated);
      await api.save_config(updated);
    } catch (err) {
      console.error('Failed to save permission preset:', err);
    }
  };

  const handleSelectReasoningEffort = async (effort: ReasoningEffortLevel) => {
    setReasoningEffort(effort);
    setOpenMenu('none');
    try {
      const baseCfg = (config || (await api.get_config())) as AppConfig;
      const updated: AppConfig = {
        ...baseCfg,
        reasoning_effort: effort,
        reasoning_enabled: effort !== 'off',
      };
      if (onConfigChanged) onConfigChanged(updated);
      await api.save_config(updated);
    } catch (err) {
      console.error('Failed to save reasoning effort:', err);
    }
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
  } = useModelManager(config, onModelChanged, onConfigChanged);

  const activeModelLower = (activeModelId || '').toLowerCase();
  const currentLocalMeta = isLocalActive
    ? modelsData?.local?.find((m) => m.filePath === activeModelId || m.fileName === activeModelId || m.title === activeModelId)
    : null;

  const supportsReasoning = Boolean(
    currentLocalMeta?.supportsReasoning ||
    ['qwen3', 'gemma-4', 'deepseek-r1', 'r1-distill', 'phi-4', 'thinking'].some((k) => activeModelLower.includes(k))
  );

  const recommendedEffort: ReasoningEffortLevel =
    currentLocalMeta?.recommendedReasoningEffort ||
    (activeModelLower.includes('qwen3') ? 'xhigh' : activeModelLower.includes('deepseek') ? 'high' : activeModelLower.includes('gemma') || activeModelLower.includes('phi') ? 'medium' : 'off');

  const currentPersona = personas.find((p) => p.id === activePersonaId) || { id: 'default', name: '0xAgent', icon: 'smart_toy' };

  useEffect(() => {
    if (textareaRef.current) {
      if (isExpanded) {
        textareaRef.current.style.height = '280px';
      } else {
        // Reset height first so scrollHeight accurately measures real content
        textareaRef.current.style.height = '34px';
        if (inputText && inputText.trim().length > 0) {
          const scrollH = textareaRef.current.scrollHeight;
          const newHeight = Math.min(220, Math.max(34, scrollH));
          textareaRef.current.style.height = `${newHeight}px`;
        }
      }
    }
  }, [inputText, isExpanded]);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu('none');
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

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

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const isVeronica =
    activePersonaId === 'veronica' ||
    currentPersona.id === 'veronica' ||
    (currentPersona.name && currentPersona.name.toLowerCase().includes('верон')) ||
    (currentPersona.name && currentPersona.name.toLowerCase().includes('veronica'));

  return (
    <div className="relative w-full max-w-3xl mx-auto select-none font-sans" ref={menuRef}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />

      {openMenu === 'slash' && <SlashMenuPopover commands={filteredSlashCommands} selectedIndex={selectedSlashIndex} onSelectCommand={handleSelectSlash} onClose={() => setOpenMenu('none')} />}
      {openMenu === 'persona' && <PersonaPopover personas={personas} activePersonaId={activePersonaId} onSelectPersona={(id) => onSelectPersona?.(id)} onClose={() => setOpenMenu('none')} />}
      {openMenu === 'model' && <ModelPopover modelsData={modelsData} serverStatus={serverStatus} activeModelId={activeModelId} isStartingServer={isStartingServer} onSelectCloudModel={selectCloudModel} onSelectLocalModel={selectLocalModel} onToggleServer={toggleServer} onClose={() => setOpenMenu('none')} />}
      {openMenu === 'permission' && <PermissionPopover permissionPreset={permissionPreset} onSelectPreset={handleSelectPreset} onClose={() => setOpenMenu('none')} />}
      {openMenu === 'reasoning' && <ReasoningPopover reasoningEffort={reasoningEffort} recommendedEffort={recommendedEffort} supportsReasoning={supportsReasoning} onSelectEffort={handleSelectReasoningEffort} onClose={() => setOpenMenu('none')} />}

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

      {/* Veronica Orchestrator Action Strip */}
      {isVeronica ? (
        <VeronicaActionStrip
          onSelectAction={(actionText) => onSelectQuickResponse?.(actionText)}
          onOpenTaskModal={() => setIsTaskModalOpen(true)}
          agentStatus={agentStatus}
        />
      ) : (
        onSelectQuickResponse && (
          <QuickResponseStrip
            options={quickResponses}
            onSelectOption={onSelectQuickResponse}
            agentStatus={agentStatus}
            isLastMessageAssistant={isLastMessageAssistant}
          />
        )
      )}

      <VeronicaTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskSpawned={() => onSelectQuickResponse?.('/tasks')}
      />

      <form onSubmit={handleFormSubmit}>
        <div className={`bento-card rounded-3xl p-1.5 sm:p-2 px-3 sm:px-4 bg-[var(--theme-panel)]/95 backdrop-blur-2xl border border-[var(--theme-border)] focus-within:border-[var(--theme-accent)] transition-all duration-200 ease-out flex items-end gap-2 sm:gap-3 shadow-xl ${isExpanded ? 'ring-1 ring-[var(--theme-accent)]/30' : ''}`}>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer shrink-0 self-center mb-0.5" title={t.chat.attachFile} aria-label={t.chat.attachFile}>
            <Plus size={18} className="sm:w-[19px] sm:h-[19px]" />
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t.chat.inputPlaceholder}
            className="w-full bg-transparent text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] text-[16px] sm:text-[15px] focus:outline-none resize-none min-h-[34px] max-h-[300px] py-1.5 px-1 leading-normal font-sans font-medium scrollbar-thin transition-[height] duration-200 ease-out"
          />

          {inputText.length > 30 && (
            <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer shrink-0 self-center mb-0.5" title={isExpanded ? '[-]' : '[+]'} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}

          <div className="flex items-center shrink-0 self-center">
            {isBusy && onCancelAgent ? (
              <button type="button" onClick={onCancelAgent} className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95" title={t.chat.stopTooltip} aria-label={t.chat.stopTooltip}>
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" disabled={!canSubmit} className={`w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center transition-all shadow-sm ${canSubmit ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] hover:opacity-90 shadow-md hover:scale-105 active:scale-95 cursor-pointer font-bold' : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] cursor-not-allowed border border-[var(--theme-border)] opacity-40'}`} title={t.chat.sendTooltip} aria-label={t.chat.sendTooltip}>
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Responsive Horizontal Chips Bar */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none px-1 sm:px-2 pt-2 text-xs text-[var(--theme-text-muted)] font-mono touch-pan-x w-full">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {personas.length > 0 && (
            <button type="button" onClick={() => setOpenMenu(openMenu === 'persona' ? 'none' : 'persona')} className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl min-h-[30px] sm:min-h-[28px] transition-all cursor-pointer border shrink-0 ${openMenu === 'persona' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] font-semibold bg-[var(--theme-card-bg)]'}`} title={t.chat.persona} aria-label={t.chat.persona}>
              <User size={13} />
              <span className="truncate max-w-[90px] text-xs">{currentPersona.name}</span>
            </button>
          )}

          <button type="button" onClick={() => { fetchModelsAndStatus(); setOpenMenu(openMenu === 'model' ? 'none' : 'model'); }} className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl min-h-[30px] sm:min-h-[28px] transition-all cursor-pointer border shrink-0 ${openMenu === 'model' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] font-semibold bg-[var(--theme-card-bg)]'}`} title={t.chat.model} aria-label={t.chat.model}>
            {isLocalActive ? <Cpu size={13} /> : <Cloud size={13} />}
            <span className="truncate max-w-[120px] text-xs font-semibold">{getDisplayTitle(activeModelId)}</span>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button type="button" onClick={() => setOpenMenu(openMenu === 'reasoning' ? 'none' : 'reasoning')} className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl min-h-[30px] sm:min-h-[28px] transition-all cursor-pointer border shrink-0 ${openMenu === 'reasoning' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] font-semibold bg-[var(--theme-card-bg)]'}`} title={`${t.chat.reasoning}: ${reasoningEffort.toUpperCase()}`} aria-label={`${t.chat.reasoning}: ${reasoningEffort.toUpperCase()}`}>
            <span className="text-[11px] uppercase font-mono tracking-wider font-bold">{reasoningEffort.toUpperCase()}</span>
          </button>

          <button type="button" onClick={() => setOpenMenu(openMenu === 'permission' ? 'none' : 'permission')} className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl min-h-[30px] sm:min-h-[28px] transition-all cursor-pointer border shrink-0 ${openMenu === 'permission' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] font-semibold bg-[var(--theme-card-bg)]'}`} title={`${t.chat.permission}: ${permissionPreset === 'unrestricted' ? (language === 'ru' ? 'Полная автоматизация' : 'Full Automation') : (language === 'ru' ? 'Частичная автоматизация' : 'Partial Automation')}`} aria-label={`${t.chat.permission}: ${permissionPreset}`}>
            <Shield size={13} />
            <span className="text-[11px] hidden sm:inline font-semibold">{permissionPreset === 'unrestricted' ? (language === 'ru' ? 'Полная' : 'Full') : (language === 'ru' ? 'Частичная' : 'Partial')}</span>
          </button>

          <button type="button" onClick={() => setOpenMenu(openMenu === 'slash' ? 'none' : 'slash')} className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl min-h-[30px] sm:min-h-[28px] transition-all cursor-pointer border shrink-0 ${openMenu === 'slash' ? 'text-[var(--theme-accent-text)] bg-[var(--theme-accent)] border-[var(--theme-accent)] shadow-sm font-bold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] font-semibold bg-[var(--theme-card-bg)]'}`} title={t.chat.slashCommands} aria-label={t.chat.slashCommands}>
            <Terminal size={13} />
            <span className="text-xs font-bold">/</span>
          </button>
        </div>
      </div>
    </div>
  );
});
