import React from 'react';
import { Sliders, Cpu, Check, RefreshCw, ChevronLeft, Brain, Wrench, Shield } from 'lucide-react';
import { AppConfig } from '../../types';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { GeneralTab } from './GeneralTab';
import { ToolsTab } from './ToolsTab';
import { PersonasTab } from './PersonasTab';
import { LocalServerTab } from './LocalServerTab';
import { ProxiesTab } from './ProxiesTab';
import { useSettingsState } from './useSettingsState';

interface SettingsPageProps {
  config: AppConfig | null;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
  onCancel: () => void;
  initialSubtab?: 'general' | 'tools' | 'personas' | 'customizations' | 'themes' | 'local_server' | 'security';
  currentSessionId?: string | null;
  onOpenMemorySkills?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = React.memo(({
  config,
  onSaveConfig,
  onCancel,
  initialSubtab,
  currentSessionId,
  onOpenMemorySkills,
}) => {
  const s = useSettingsState(config, onSaveConfig, initialSubtab);
  const { t } = useI18n();

  return (
    <div className="w-full h-full bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col overflow-hidden font-sans select-text">
      {/* Settings Top Header Bar */}
      <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-panel)] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="xs"
            onClick={onCancel}
            icon={<ChevronLeft size={15} />}
            title={t.settings.backToChat}
            className="p-1.5"
          />
          <h2 className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider">{t.settings.title}</h2>
        </div>

        {/* Auto-save Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--theme-text-muted)] bg-[var(--theme-card-bg)] border border-[var(--theme-border)] px-3 py-1 rounded-xl shadow-xs">
          {s.saveStatus === 'saving' ? (
            <>
              <RefreshCw size={12} className="animate-spin text-[var(--theme-text-muted)]" />
              <span>{t.settings.saving}</span>
            </>
          ) : (
            <>
              <Check size={12} className="text-emerald-500" />
              <span>{t.settings.saved}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Settings Layout (Sidebar Navigation + Right Content Panel) */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        {/* Left Vertical Navigation Menu (4 Canonical Tabs) */}
        <div className="w-full md:w-60 bg-[var(--theme-panel)] border-r border-[var(--theme-border)] p-3 shrink-0 flex flex-row md:flex-col gap-1.5 select-none overflow-x-auto scrollbar-none">
          {[
            { id: 'general', label: t.settings.tabs.general, icon: Sliders },
            { id: 'local_server', label: t.settings.tabs.localServer, icon: Cpu },
            { id: 'tools', label: t.settings.tabs.tools, icon: Wrench },
            { id: 'personas', label: t.settings.tabs.personas, icon: Brain },
            { id: 'proxies', label: '0xProxy & Шлюзы', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = s.activeSubtab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => s.setActiveSubtab(tab.id as any)}
                className={`w-auto md:w-full shrink-0 whitespace-nowrap px-3.5 py-2 md:py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer text-left border ${
                  isActive
                    ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
                    : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                }`}
              >
                <Icon
                  size={15}
                  className={`shrink-0 ${isActive ? 'text-[var(--theme-text)]' : 'text-[var(--theme-text-muted)]'}`}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Scrollable Content Panel */}
        <div className="flex-1 h-full overflow-y-auto p-4 md:p-8 pb-28 scrollbar-none">
          {s.activeSubtab === 'general' && (
            <GeneralTab
              activeTheme={s.activeTheme}
              onSelectTheme={s.handleSelectTheme}
              onLanguageSelect={(lang) => {
                s.setLanguage(lang);
              }}
              onOpenMemorySkills={onOpenMemorySkills}
              apiUrl={s.apiUrl}
              setApiUrl={s.setApiUrl}
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

          {s.activeSubtab === 'local_server' && (
            <LocalServerTab
              config={s.config}
              onSaveConfig={s.onSaveConfig}
              exePath={s.exePath}
              setModelPath={s.setModelPath}
              modelPath={s.modelPath}
              setExePath={s.setExePath}
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

          {s.activeSubtab === 'tools' && (
            <ToolsTab
              webSearchProvider={s.webSearchProvider}
              setWebSearchProvider={s.setWebSearchProvider}
              firecrawlApiKey={s.firecrawlApiKey}
              setFirecrawlApiKey={s.setFirecrawlApiKey}
              firecrawlApiUrl={s.firecrawlApiUrl}
              setFirecrawlApiUrl={s.setFirecrawlApiUrl}
              searxngUrl={s.searxngUrl}
              setSearxngUrl={s.setSearxngUrl}
            />
          )}

          {s.activeSubtab === 'personas' && (
            <PersonasTab currentSessionId={currentSessionId} />
          )}

          {s.activeSubtab === 'proxies' && (
            <ProxiesTab />
          )}
        </div>
      </div>
    </div>
  );
});

