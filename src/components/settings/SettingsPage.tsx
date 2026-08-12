import React from 'react';
import { Sliders, Palette, Cpu, Check, RefreshCw, ChevronLeft, Shield, User } from 'lucide-react';
import { AppConfig } from '../../types';
import { GeneralTab } from './GeneralTab';
import { PersonasTab } from './PersonasTab';
import { ThemesTab } from './ThemesTab';
import { LocalServerTab } from './LocalServerTab';
import { SecurityTab } from './SecurityTab';
import { useSettingsState } from './useSettingsState';

interface SettingsPageProps {
  config: AppConfig | null;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
  onCancel: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  config,
  onSaveConfig,
  onCancel,
}) => {
  const s = useSettingsState(config, onSaveConfig);

  return (
    <div className="w-full h-full bg-scifi-grid text-slate-100 flex flex-col overflow-hidden font-sans select-text">
      {/* Settings Top Header Bar */}
      <div className="px-4 py-3 border-b border-white/10 glass-panel flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flat-btn p-1.5 rounded-md text-slate-400 hover:text-white cursor-pointer"
            title="Вернуться в чат"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-semibold text-slate-100">Настройки приложения</h2>
        </div>

        {/* Auto-save Indicator */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-900/60 px-3 py-1 rounded-md border border-white/10">
          {s.saveStatus === 'saving' ? (
            <>
              <RefreshCw size={12} className="animate-spin text-sky-400" />
              <span>Сохранение...</span>
            </>
          ) : (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-slate-300">Сохранено</span>
            </>
          )}
        </div>
      </div>

      {/* Main Settings Layout (Sidebar Navigation + Right Content Panel) */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        {/* Left Vertical Navigation Menu */}
        <div className="w-full md:w-56 glass-panel border-r border-white/10 p-3 shrink-0 flex flex-row md:flex-col gap-1 select-none overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => s.setActiveSubtab('general')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              s.activeSubtab === 'general'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Sliders size={14} className={s.activeSubtab === 'general' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Основные</span>
          </button>

          <button
            type="button"
            onClick={() => s.setActiveSubtab('personas')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              s.activeSubtab === 'personas'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <User size={14} className={s.activeSubtab === 'personas' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Личности (Personas)</span>
          </button>

          <button
            type="button"
            onClick={() => s.setActiveSubtab('themes')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              s.activeSubtab === 'themes'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Palette size={14} className={s.activeSubtab === 'themes' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Темы оформления</span>
          </button>

          <button
            type="button"
            onClick={() => s.setActiveSubtab('local_server')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              s.activeSubtab === 'local_server'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Cpu size={14} className={s.activeSubtab === 'local_server' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Сервер LLM</span>
          </button>

          <button
            type="button"
            onClick={() => s.setActiveSubtab('security')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer text-left ${
              s.activeSubtab === 'security'
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-sm'
                : 'text-theme-muted hover:text-theme-text hover:bg-white/[0.03]'
            }`}
          >
            <Shield size={14} className={s.activeSubtab === 'security' ? 'text-[var(--theme-accent)]' : 'text-slate-500'} />
            <span>Безопасность</span>
          </button>
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
              embedding={s.embedding}
              setEmbedding={s.setEmbedding}
              contBatching={s.contBatching}
              setContBatching={s.setContBatching}
              promptCache={s.promptCache}
              setPromptCache={s.setPromptCache}
              mlock={s.mlock}
              setMlock={s.setMlock}
              mmap={s.mmap}
              setMmap={s.setMmap}
              parallelSlots={s.parallelSlots}
              setParallelSlots={s.setParallelSlots}
              cacheReuse={s.cacheReuse}
              setCacheReuse={s.setCacheReuse}
              slotSavePath={s.slotSavePath}
              setSlotSavePath={s.setSlotSavePath}
              customArgs={s.customArgs}
              setCustomArgs={s.setCustomArgs}
              serverStatus={s.serverStatus}
              setServerStatus={s.setServerStatus}
              serverLogs={s.serverLogs}
              setServerLogs={s.setServerLogs}
              serverLogsAutoScroll={s.serverLogsAutoScroll}
              setServerLogsAutoScroll={s.setServerLogsAutoScroll}
              setApiUrl={s.setApiUrl}
            />
          )}

          {s.activeSubtab === 'security' && (
            <SecurityTab />
          )}
        </div>
      </div>
    </div>
  );
};
