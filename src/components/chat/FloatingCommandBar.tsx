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
import { MobileMicHelpModal } from './MobileMicHelpModal';
import { useSlashAutocomplete } from './useSlashAutocomplete';
import { QuickResponseStrip } from './QuickResponseStrip';

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
  const [daemonVoiceState, setDaemonVoiceState] = useState<'idle' | 'recording' | 'processing' | 'stopped'>('idle');
  const [voicePhraseNotification, setVoicePhraseNotification] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showMicHelpModal, setShowMicHelpModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
      let currentCfg = config;
      if (!currentCfg) {
        currentCfg = await api.get_config();
      }
      const updated: AppConfig = { ...currentCfg, permission_preset: preset };
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
      let currentCfg = config;
      if (!currentCfg) {
        currentCfg = await api.get_config();
      }
      const updated: AppConfig = {
        ...currentCfg,
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

  const isListeningForWake = Boolean(config?.tts_config?.wake_word_enabled);

  const isMobileDevice = /iphone|ipad|ipod|android/i.test(navigator.userAgent) || window.innerWidth < 768;

  const handleMicClick = async () => {
    setVoiceError(null);

    // If browser MediaRecorder is currently recording, stop and transcribe
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      return;
    }

    // Helper to start in-browser WebAudio MediaRecorder (Primary for Mobile, Fallback for Desktop)
    const startBrowserRecording = async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Web Audio API недоступен в этом браузере');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      let chosenMime = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          chosenMime = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          chosenMime = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          chosenMime = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          chosenMime = 'audio/ogg;codecs=opus';
        }
      }

      const recorder = new MediaRecorder(stream, chosenMime ? { mimeType: chosenMime } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || chosenMime || 'audio/webm' });
        if (blob.size > 200) {
          setDaemonVoiceState('processing');
          const reader = new FileReader();
          reader.onloadend = async () => {
            const resBase64 = (reader.result as string).split(',')[1];
            const mime = recorder.mimeType || chosenMime || 'audio/webm';
            try {
              // 1. Try unified Jarvis voice input (with macro and companion support)
              const res = await api.send_voice_input(resBase64, mime);
              if (res && res.text) {
                setInputText(inputTextRef.current ? `${inputTextRef.current} ${res.text}` : res.text);
                textareaRef.current?.focus();
              }
            } catch {
              // 2. Fallback to direct Whisper STT transcription
              try {
                const text = await api.transcribe_audio(resBase64, config?.groq_api_key || '', mime);
                if (text && text.trim()) {
                  setInputText(inputTextRef.current ? `${inputTextRef.current} ${text.trim()}` : text.trim());
                  textareaRef.current?.focus();
                }
              } catch (err: any) {
                setVoiceError(err.message || 'Ошибка распознавания речи');
                setTimeout(() => setVoiceError(null), 6000);
              }
            } finally {
              setDaemonVoiceState('idle');
            }
          };
          reader.readAsDataURL(blob);
        } else {
          setDaemonVoiceState('idle');
        }
      };

      recorder.start(250);
      setDaemonVoiceState('recording');
    };

    // Mobile: Always record directly from the mobile device's primary microphone
    if (isMobileDevice) {
      const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const hasMediaApi = Boolean(
        navigator?.mediaDevices?.getUserMedia ||
        (navigator as any)?.getUserMedia ||
        (navigator as any)?.webkitGetUserMedia
      );

      if (!isSecure && !hasMediaApi) {
        setShowMicHelpModal(true);
        setVoiceError('Требуется HTTPS или флаг браузера для микрофона по Wi-Fi');
        setTimeout(() => setVoiceError(null), 8000);
        return;
      }

      try {
        await startBrowserRecording();
        return;
      } catch (err: any) {
        console.warn('[WebAudio] Mobile mic error:', err);
        const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
        if (!isSecure && !isDenied) {
          setShowMicHelpModal(true);
        }
        setVoiceError(isDenied ? 'Доступ к микрофону заблокирован в настройках браузера' : 'Микрофон заблокирован браузером (откройте через HTTPS)');
        setTimeout(() => setVoiceError(null), 8000);
        return;
      }
    }

    // Desktop: Trigger local OS voice daemon (with fallback to browser mic)
    try {
      const res = await api.toggle_voice_daemon_recording();
      if (!res.success) {
        // If desktop daemon has no mic or fails, fallback to browser getUserMedia
        try {
          await startBrowserRecording();
          return;
        } catch {
          setVoiceError('Устройство ввода звука недоступно. Проверьте системный микрофон.');
          setTimeout(() => setVoiceError(null), 6000);
        }
      }
    } catch (err: any) {
      // If server daemon request failed, try browser mic
      try {
        await startBrowserRecording();
      } catch {
        setVoiceError(`Ошибка микрофона: ${err?.message || err}`);
        setTimeout(() => setVoiceError(null), 6000);
      }
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

    const un2 = api.listen<{ state: 'idle' | 'recording' | 'processing' | 'stopped' | 'no_mic'; phrase?: string }>('jarvis_voice_state', (e) => {
      if (e.payload?.state) {
        if (e.payload.state === 'no_mic') {
          setDaemonVoiceState('idle');
          setVoiceError('Системный микрофон ПК занят или не подключен');
          setTimeout(() => setVoiceError(null), 6000);
        } else {
          setDaemonVoiceState(e.payload.state as any);
        }
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

      {daemonVoiceState === 'recording' && (
        <div
          onClick={handleMicClick}
          className="flex items-center justify-between px-4 py-2.5 mb-2 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono text-xs backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-xl shadow-rose-950/50 cursor-pointer"
          title="Нажмите для остановки записи"
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="font-bold tracking-wider text-[11px] text-white shrink-0">
              {isMobileDevice ? 'MOBILE MIC :: RECORDING' : 'JARVIS :: RECORDING'}
            </span>
            <span className="text-[11px] text-rose-300/80 truncate">
              {voicePhraseNotification ? `«${voicePhraseNotification}»` : (isMobileDevice ? 'Говорите в телефон... (Нажмите для завершения)' : 'Слушаю вас... (Скажите «Стоп» или кликните)')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
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

      {voiceError && (
        <div className="flex items-center justify-between px-4 py-2 mb-2 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono text-xs backdrop-blur-2xl animate-in fade-in duration-200 shadow-lg">
          <div className="flex items-center gap-2 truncate">
            <span className="text-rose-400 font-bold">[ERR]:</span>
            <span className="truncate">{voiceError}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setShowMicHelpModal(true)}
              className="px-2.5 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 text-white font-bold text-[10px] transition-colors cursor-pointer"
            >
              Инструкция
            </button>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="p-1 text-rose-400 hover:text-white rounded-md hover:bg-rose-900/50 cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {onSelectQuickResponse && (
        <QuickResponseStrip
          options={quickResponses}
          onSelectOption={onSelectQuickResponse}
          agentStatus={agentStatus}
          isLastMessageAssistant={isLastMessageAssistant}
        />
      )}

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

          <button
            type="button"
            onClick={handleMicClick}
            disabled={daemonVoiceState === 'processing'}
            className={`w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 self-center mb-0.5 relative ${
              daemonVoiceState === 'recording'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 scale-105 animate-pulse'
                : daemonVoiceState === 'processing'
                ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text)] cursor-wait animate-pulse'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
            }`}
            title={daemonVoiceState === 'recording' ? t.chat.voiceListening : t.chat.voiceInput}
            aria-label={daemonVoiceState === 'recording' ? t.chat.voiceListening : t.chat.voiceInput}
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

      <MobileMicHelpModal isOpen={showMicHelpModal} onClose={() => setShowMicHelpModal(false)} />
    </div>
  );
});
