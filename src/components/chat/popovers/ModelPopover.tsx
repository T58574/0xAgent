import React from 'react';
import {
  Cloud,
  HardDrive,
  Check,
  Volume2,
  Play,
  Square,
  RefreshCw,
  X,
} from 'lucide-react';
import { AvailableModelsResponse, LocalModelItem } from '../../../types';
import { ServerStatusData } from '../../../hooks/useModelManager';
import { useI18n } from '../../../i18n';

interface ModelPopoverProps {
  modelsData: AvailableModelsResponse;
  serverStatus: ServerStatusData;
  activeModelId: string;
  isStartingServer: boolean;
  onSelectCloudModel: (modelId: string) => void;
  onSelectLocalModel: (model: LocalModelItem) => void;
  onToggleServer: (e: React.MouseEvent) => void;
  onClose: () => void;
}

export const ModelPopover: React.FC<ModelPopoverProps> = ({
  modelsData,
  serverStatus,
  activeModelId,
  isStartingServer,
  onSelectCloudModel,
  onSelectLocalModel,
  onToggleServer,
  onClose,
}) => {
  const { language } = useI18n();

  return (
    <>
      {/* Mobile Backdrop */}
      {onClose && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:bottom-full sm:mb-3 sm:left-12 sm:w-80 max-w-[calc(100vw-24px)] bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 animate-fadeIn rounded-2xl">
        {/* Cloud API Models */}
        <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
          <span className="font-bold text-[var(--theme-text)]">
            {language === 'ru' ? 'Облачные API (Google AI)' : 'Cloud APIs (Google AI Studio)'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
          >
            <X size={12} />
          </button>
        </div>
        <div className="space-y-1 mb-2">
          {modelsData.cloud.map((m) => {
            const isActive = activeModelId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelectCloudModel(m.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {m.isAudio ? (
                    <Volume2
                      size={14}
                      className={isActive ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'}
                    />
                  ) : (
                    <Cloud
                      size={14}
                      className={isActive ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'}
                    />
                  )}
                  <span className="truncate">{m.name}</span>
                </div>
                {isActive && <Check size={13} className="text-[var(--theme-accent-text)] shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Local Models */}
        <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[var(--theme-text)]">
              {language === 'ru' ? 'Локальные GGUF' : 'Local GGUF Models'}
            </span>
            <span className="text-[9px] font-mono opacity-60">
              ({serverStatus.running ? 'online' : 'offline'})
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleServer}
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
            <span>
              {serverStatus.running
                ? (language === 'ru' ? 'Стоп' : 'Stop')
                : (language === 'ru' ? 'Старт' : 'Start')}
            </span>
          </button>
        </div>

        <div className="max-h-44 overflow-y-auto space-y-1 scrollbar-thin">
          {modelsData.local.filter((m) => !m.isDraft && !m.isMmproj).length === 0 ? (
            <div className="text-[10px] text-[var(--theme-text-muted)] italic py-1 px-2.5 font-mono">
              {language === 'ru' ? 'нет файлов в ~/.0xagent/models/' : 'no models in ~/.0xagent/models/'}
            </div>
          ) : (
            modelsData.local
              .filter((m) => !m.isDraft && !m.isMmproj)
              .map((m) => {
                const isActive =
                  activeModelId === m.id ||
                  activeModelId === m.fileName ||
                  activeModelId === `local:${m.fileName}`;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectLocalModel(m);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <HardDrive
                        size={13}
                        className={isActive ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'}
                      />
                      <span className="truncate font-medium">{m.title || m.fileName}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0 font-bold">{m.sizeGB}</span>
                  </button>
                );
              })
          )}
        </div>
      </div>
    </>
  );
};
