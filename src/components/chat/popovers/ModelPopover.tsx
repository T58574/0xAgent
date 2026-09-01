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
import { AvailableModelsResponse, LocalModelItem, ReasoningEffortLevel } from '../../../types';
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
  onRefreshModels?: () => void;
  reasoningEffort?: ReasoningEffortLevel;
  onSelectReasoningEffort?: (effort: ReasoningEffortLevel) => void;
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
  onRefreshModels,
  reasoningEffort,
  onSelectReasoningEffort,
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

      <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:bottom-full sm:mb-3 sm:left-12 sm:w-84 max-w-[calc(100vw-24px)] bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] z-50 animate-fadeIn rounded-2xl">
        {/* Cloud API Models */}
        <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
          <span className="font-bold text-[var(--theme-text)]">
            {language === 'ru' ? 'Облачные модели (Cloud API)' : 'Cloud API Models'}
          </span>
          <div className="flex items-center gap-1.5">
            {onRefreshModels && (
              <button
                type="button"
                onClick={onRefreshModels}
                className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] cursor-pointer transition-colors"
                title={language === 'ru' ? 'Обновить список моделей' : 'Refresh models list'}
              >
                <RefreshCw size={10} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        </div>
        <div className="space-y-1 mb-2">
          {modelsData.cloud.map((m) => {
            const getBaseModelId = (id: string): string => {
              if (id.startsWith('gemini-3.7-flash')) return 'gemini-3.7-flash';
              if (id.startsWith('gemini-3.6-flash')) return 'gemini-3.6-flash';
              if (id.startsWith('gemini-3.1-pro')) return 'gemini-3.1-pro';
              return id;
            };

            const getModelEffort = (id: string, defEff: string = 'low'): string => {
              if (id.endsWith('-high')) return 'high';
              if (id.endsWith('-medium')) return 'medium';
              if (id.endsWith('-low')) return 'low';
              return defEff;
            };

            const baseActive = getBaseModelId(activeModelId);
            const isActive = baseActive === m.id || activeModelId === m.id;
            const supportedEfforts = m.supportedEfforts || [];
            const currentEffort = getModelEffort(activeModelId, m.defaultEffort || 'low');

            return (
              <div
                key={m.id}
                className={`rounded-xl transition-all border ${
                  isActive
                    ? 'session-item-active text-[var(--theme-text)] font-semibold border-[var(--theme-border)] shadow-xs bg-[var(--theme-card-bg)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (supportedEfforts.length > 0) {
                      onSelectCloudModel(`${m.id}-${currentEffort}`);
                    } else {
                      onSelectCloudModel(m.id);
                      onClose();
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {m.isAudio ? (
                      <Volume2
                        size={14}
                        className={isActive ? 'text-[var(--theme-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'}
                      />
                    ) : (
                      <Cloud
                        size={14}
                        className={isActive ? 'text-[var(--theme-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'}
                      />
                    )}
                    <span className="truncate font-semibold">{m.name}</span>
                  </div>
                  {isActive && <Check size={13} className="text-[var(--theme-text)] shrink-0" />}
                </button>

                {/* Inline Effort Selector for Gemini models when active */}
                {isActive && supportedEfforts.length > 0 && (
                  <div className="px-3 pb-2 pt-1 flex items-center justify-between gap-2 border-t border-[var(--theme-border)]/40">
                    <span className="text-[9px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider">
                      {language === 'ru' ? 'Effort (Рассуждения):' : 'Reasoning Effort:'}
                    </span>
                    <div className="flex items-center gap-1">
                      {supportedEfforts.map((eff) => {
                        const isEffActive = currentEffort === eff;
                        return (
                          <button
                            key={eff}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCloudModel(`${m.id}-${eff}`);
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer border ${
                              isEffActive
                                ? 'bg-[var(--theme-panel)] text-[var(--theme-text)] font-bold border-[var(--theme-border)] shadow-xs'
                                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-transparent hover:bg-[var(--theme-border-subtle)]'
                            }`}
                          >
                            {eff}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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
            className="px-2 py-0.5 rounded-lg bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] font-semibold text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
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
                  activeModelId === `local:${m.fileName}` ||
                  activeModelId === m.filePath;
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl transition-all border ${
                      isActive
                        ? 'session-item-active text-[var(--theme-text)] font-semibold border-[var(--theme-border)] shadow-xs bg-[var(--theme-card-bg)]'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectLocalModel(m);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <HardDrive
                          size={13}
                          className={isActive ? 'text-[var(--theme-text)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'}
                        />
                        <span className="truncate font-semibold">{m.title || m.fileName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono opacity-60 font-bold">{m.sizeGB}</span>
                        {isActive && <Check size={13} className="text-[var(--theme-text)] shrink-0" />}
                      </div>
                    </button>

                    {/* Inline Effort Selector for Local Model when active */}
                    {isActive && onSelectReasoningEffort && (
                      <div className="px-3 pb-2 pt-1 flex items-center justify-between gap-2 border-t border-[var(--theme-border)]/40">
                        <span className="text-[9px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider">
                          {language === 'ru' ? 'Effort (Рассуждения):' : 'Reasoning Effort:'}
                        </span>
                        <div className="flex items-center gap-1">
                          {(['off', 'low', 'medium', 'high'] as const).map((eff) => {
                            const isEffActive = (reasoningEffort || 'off') === eff;
                            return (
                              <button
                                key={eff}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectReasoningEffort(eff);
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer border ${
                                  isEffActive
                                    ? 'bg-[var(--theme-panel)] text-[var(--theme-text)] font-bold border-[var(--theme-border)] shadow-xs'
                                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-transparent hover:bg-[var(--theme-border-subtle)]'
                                }`}
                              >
                                {eff}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </>
  );
};
