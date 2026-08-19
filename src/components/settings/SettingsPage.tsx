import React from 'react';
import { Sliders, Palette, Cpu, Check, RefreshCw, ChevronLeft, User, Sparkles } from 'lucide-react';
import { AppConfig } from '../../types';
import { GeneralTab } from './GeneralTab';
import { PersonasTab } from './PersonasTab';
import { ThemesTab } from './ThemesTab';
import { LocalServerTab } from './LocalServerTab';
import { CustomizationsTab } from './CustomizationsTab';
import { useSettingsState } from './useSettingsState';

interface SettingsPageProps {
  config: AppConfig | null;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
  onCancel: () => void;
  initialSubtab?: 'general' | 'personas' | 'customizations' | 'themes' | 'local_server';
  currentSessionId?: string | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  config,
  onSaveConfig,
  onCancel,
  initialSubtab,
  currentSessionId,
}) => {
  const s = useSettingsState(config, onSaveConfig, initialSubtab);

  return (
    <div className="w-full h-full bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col overflow-hidden font-sans select-text">
      {/* Settings Top Header Bar */}
      <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-panel)] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
            title="Вернуться в чат"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider">Настройки</h2>
        </div>

        {/* Auto-save Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--theme-text-muted)] bento-card px-3 py-1 rounded-lg">
          {s.saveStatus === 'saving' ? (
            <>
              <RefreshCw size={12} className="animate-spin text-[var(--theme-text-muted)]" />
              <span>Сохранение...</span>
            </>
          ) : (
            <>
              <Check size={12} className="text-[var(--theme-text)]" />
              <span>Сохранено</span>
            </>
          )}
        </div>
      </div>

      {/* Main Settings Layout (Sidebar Navigation + Right Content Panel) */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        {/* Left Vertical Navigation Menu */}
        <div className="w-full md:w-60 bg-[var(--theme-panel)] border-r border-[var(--theme-border)] p-3 shrink-0 flex flex-row md:flex-col gap-1.5 select-none overflow-x-auto scrollbar-none">
          {[
            { id: 'general', label: 'Основные', icon: Sliders },
            { id: 'customizations', label: 'Кастомизации & Токены', icon: Sparkles },
            { id: 'personas', label: 'Личности (Personas)', icon: User },
            { id: 'themes', label: 'Темы оформления', icon: Palette },
            { id: 'local_server', label: 'Сервер LLM', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = s.activeSubtab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => s.setActiveSubtab(tab.id as any)}
                className={`w-auto md:w-full shrink-0 whitespace-nowrap px-3.5 py-2 md:py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer text-left border ${
                  isActive
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-sm'
                    : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-[var(--theme-accent-text)]' : 'text-[var(--theme-text-muted)]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Scrollable Content Panel */}
        <div className="flex-1 h-full overflow-y-auto p-4 md:p-8 pb-28 scrollbar-none">
          {s.activeSubtab === 'general' && (
            <GeneralTab
              apiUrl={s.apiUrl}
              setApiUrl={s.setApiUrl}
              groqApiKey={s.groqApiKey}
              setGroqApiKey={s.setGroqApiKey}
              geminiApiKey={s.geminiApiKey}
              setGeminiApiKey={s.setGeminiApiKey}
              reasoningEnabled={s.reasoningEnabled}
              setReasoningEnabled={s.setReasoningEnabled}
              autoSaveHistory={s.autoSaveHistory}
              setAutoSaveHistory={s.setAutoSaveHistory}
              soundNotifications={s.soundNotifications}
              setSoundNotifications={s.setSoundNotifications}
              compactChat={s.compactChat}
              setCompactChat={s.setCompactChat}
              ttsVoiceEnabled={s.ttsVoiceEnabled}
              setTtsVoiceEnabled={s.setTtsVoiceEnabled}
              ttsVoice={s.ttsVoice}
              setTtsVoice={s.setTtsVoice}
              ttsRate={s.ttsRate}
              setTtsRate={s.setTtsRate}
              ttsPlayOnSpeaker={s.ttsPlayOnSpeaker}
              setTtsPlayOnSpeaker={s.setTtsPlayOnSpeaker}
              ttsPlayInBrowser={s.ttsPlayInBrowser}
              setTtsPlayInBrowser={s.setTtsPlayInBrowser}
              wakeWordEnabled={s.wakeWordEnabled}
              setWakeWordEnabled={s.setWakeWordEnabled}
              proactiveCompanionEnabled={s.proactiveCompanionEnabled}
              setProactiveCompanionEnabled={s.setProactiveCompanionEnabled}
            />
          )}

          {s.activeSubtab === 'customizations' && (
            <CustomizationsTab
              config={config}
              currentSessionId={currentSessionId}
            />
          )}

          {s.activeSubtab === 'personas' && (
            <PersonasTab />
          )}

          {s.activeSubtab === 'themes' && (
            <ThemesTab
              activeTheme={s.activeTheme}
              onSelectTheme={s.handleSelectTheme}
            />
          )}

          {s.activeSubtab === 'local_server' && (
            <LocalServerTab
              exePath={s.exePath}
              setExePath={s.setExePath}
              modelPath={s.modelPath}
              setModelPath={s.setModelPath}
              host={s.host}
              setHost={s.setHost}
              port={s.port}
              setPort={s.setPort}
              ctxSize={s.ctxSize}
              setCtxSize={s.setCtxSize}
              threads={s.threads}
              setThreads={s.setThreads}
              gpuLayers={s.gpuLayers}
              setGpuLayers={s.setGpuLayers}
              temp={s.temp}
              setTemp={s.setTemp}
              batchSize={s.batchSize}
              setBatchSize={s.setBatchSize}
              ubatchSize={s.ubatchSize}
              setUbatchSize={s.setUbatchSize}
              minP={s.minP}
              setMinP={s.setMinP}
              topK={s.topK}
              setTopK={s.setTopK}
              topP={s.topP}
              setTopP={s.setTopP}
              predict={s.predict}
              setPredict={s.setPredict}
              repeatPenalty={s.repeatPenalty}
              setRepeatPenalty={s.setRepeatPenalty}
              flashAttn={s.flashAttn}
              setFlashAttn={s.setFlashAttn}
              mmap={s.mmap}
              setMmap={s.setMmap}
              mlock={s.mlock}
              setMlock={s.setMlock}
              embedding={s.embedding}
              setEmbedding={s.setEmbedding}
              contBatching={s.contBatching}
              setContBatching={s.setContBatching}
              promptCache={s.promptCache}
              setPromptCache={s.setPromptCache}
              parallelSlots={s.parallelSlots}
              setParallelSlots={s.setParallelSlots}
              cacheReuse={s.cacheReuse}
              setCacheReuse={s.setCacheReuse}
              slotSavePath={s.slotSavePath}
              setSlotSavePath={s.setSlotSavePath}
              customArgs={s.customArgs}
              setCustomArgs={s.setCustomArgs}
              specDraftModel={s.specDraftModel}
              setSpecDraftModel={s.setSpecDraftModel}
              specType={s.specType}
              setSpecType={s.setSpecType}
              specDraftNgl={s.specDraftNgl}
              setSpecDraftNgl={s.setSpecDraftNgl}
              specDraftNMax={s.specDraftNMax}
              setSpecDraftNMax={s.setSpecDraftNMax}
              specDraftPMin={s.specDraftPMin}
              setSpecDraftPMin={s.setSpecDraftPMin}
              jinja={s.jinja}
              setJinja={s.setJinja}
              reasoningPreserve={s.reasoningPreserve}
              setReasoningPreserve={s.setReasoningPreserve}
              reasoningFormat={s.reasoningFormat}
              setReasoningFormat={s.setReasoningFormat}
              serverStatus={s.serverStatus}
              setServerStatus={s.setServerStatus}
              serverLogs={s.serverLogs}
              setServerLogs={s.setServerLogs}
              serverLogsAutoScroll={s.serverLogsAutoScroll}
              setServerLogsAutoScroll={s.setServerLogsAutoScroll}
              setApiUrl={s.setApiUrl}
            />
          )}
        </div>
      </div>
    </div>
  );
};
