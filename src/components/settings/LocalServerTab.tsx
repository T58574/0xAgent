import React, { useState, useRef } from 'react';
import { Cpu, Activity, Terminal, Box, Sliders } from 'lucide-react';
import { useI18n } from '../../i18n';
import { SettingsHeader } from './common';
import { ServerConfigSection } from './localServer/ServerConfigSection';
import { ServerPerformanceParams } from './localServer/ServerPerformanceParams';
import { ServerLogsConsole } from './localServer/ServerLogsConsole';
import { CrashAdviserCard } from './localServer/CrashAdviserCard';
import { RemoteNodeSection } from './localServer/RemoteNodeSection';
import { useLocalServerProcess } from './localServer/useLocalServerProcess';
import { AppConfig } from '../../types';

interface LocalServerTabProps {
  config?: AppConfig | null;
  onSaveConfig?: (updatedConfig: AppConfig) => Promise<void>;
  exePath: string;
  setExePath: (val: string) => void;
  modelPath: string;
  setModelPath: (val: string) => void;
  host: string;
  setHost: (val: string) => void;
  port: number;
  setPort: (val: number) => void;
  ctxSize: number;
  setCtxSize: (val: number) => void;
  threads: number;
  setThreads: (val: number) => void;
  gpuLayers: number;
  setGpuLayers: (val: number) => void;
  temp: number;
  setTemp: (val: number) => void;
  batchSize: number;
  setBatchSize: (val: number) => void;
  ubatchSize: number;
  setUbatchSize: (val: number) => void;
  minP: number;
  setMinP: (val: number) => void;
  topK: number;
  setTopK: (val: number) => void;
  topP: number;
  setTopP: (val: number) => void;
  predict: number;
  setPredict: (val: number) => void;
  repeatPenalty: number;
  setRepeatPenalty: (val: number) => void;
  flashAttn: boolean;
  setFlashAttn: (val: boolean) => void;
  mmap: boolean;
  setMmap: (val: boolean) => void;
  mlock: boolean;
  setMlock: (val: boolean) => void;
  embedding: boolean;
  setEmbedding: (val: boolean) => void;
  contBatching: boolean;
  setContBatching: (val: boolean) => void;
  promptCache: boolean;
  setPromptCache: (val: boolean) => void;
  parallelSlots: number;
  setParallelSlots: (val: number) => void;
  cacheReuse: number;
  setCacheReuse: (val: number) => void;
  slotSavePath: string;
  setSlotSavePath: (val: string) => void;
  customArgs: string;
  setCustomArgs: (val: string) => void;
  specDraftModel: string;
  setSpecDraftModel: (val: string) => void;
  specType: string;
  setSpecType: (val: string) => void;
  specDraftNgl: number;
  setSpecDraftNgl: (val: number) => void;
  specDraftNMax: number;
  setSpecDraftNMax: (val: number) => void;
  specDraftPMin: number;
  setSpecDraftPMin: (val: number) => void;
  jinja: boolean;
  setJinja: (val: boolean) => void;
  reasoningPreserve: boolean;
  setReasoningPreserve: (val: boolean) => void;
  reasoningFormat: string;
  setReasoningFormat: (val: string) => void;
  serverStatus: 'stopped' | 'running' | 'checking';
  setServerStatus: (val: 'stopped' | 'running' | 'checking') => void;
  serverLogs: string[];
  setServerLogs: React.Dispatch<React.SetStateAction<string[]>>;
  serverLogsAutoScroll: boolean;
  setServerLogsAutoScroll: (val: boolean) => void;
  setApiUrl: (val: string) => void;
}

type LocalServerSubtab = 'config' | 'params' | 'remote_node' | 'logs';

export const LocalServerTab: React.FC<LocalServerTabProps> = React.memo((props) => {
  const {
    config,
    onSaveConfig,
    exePath,
    setExePath,
    modelPath,
    setModelPath,
    host,
    setHost,
    port,
    setPort,
    ctxSize,
    setCtxSize,
    threads,
    setThreads,
    gpuLayers,
    setGpuLayers,
    temp,
    setTemp,
    batchSize,
    setBatchSize,
    ubatchSize,
    setUbatchSize,
    minP,
    setMinP,
    topK,
    setTopK,
    topP,
    setTopP,
    predict,
    setPredict,
    repeatPenalty,
    setRepeatPenalty,
    flashAttn,
    setFlashAttn,
    mmap,
    setMmap,
    mlock,
    setMlock,
    embedding,
    setEmbedding,
    contBatching,
    setContBatching,
    promptCache,
    setPromptCache,
    parallelSlots,
    setParallelSlots,
    cacheReuse,
    setCacheReuse,
    slotSavePath,
    setSlotSavePath,
    customArgs,
    setCustomArgs,
    specDraftModel,
    setSpecDraftModel,
    specType,
    setSpecType,
    specDraftNgl,
    setSpecDraftNgl,
    specDraftNMax,
    setSpecDraftNMax,
    specDraftPMin,
    setSpecDraftPMin,
    jinja,
    setJinja,
    reasoningPreserve,
    setReasoningPreserve,
    reasoningFormat,
    setReasoningFormat,
    serverStatus,
    serverLogs,
    serverLogsAutoScroll,
    setServerLogsAutoScroll,
  } = props;

  const { t, formatString } = useI18n();

  // Active Subtab
  const [activeSubtab, setActiveSubtab] = useState<LocalServerSubtab>('config');

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const {
    hardwareInfo,
    scannedLocalModels,
    modelMeta,
    healthStatus,
    slotMetrics,
    isActionLoading,
    crashAdvice,
    logFilePath,
    isCopiedLogs,
    githubReleases,
    selectedTag,
    selectedAssetUrl,
    setSelectedAssetUrl,
    setSelectedAssetName,
    installedVersions,
    isLoadingReleases,
    isInstallingLlama,
    autoCleanupOld,
    setAutoCleanupOld,
    isCleaningOld,
    deletingTag,
    justDownloadedTag,
    refreshScannedModels,
    handleSelectModel,
    handleSelectDraftModel,
    handleSelectExe,
    handleSelectSlotSavePath,
    handleTagChange,
    handleInstallSelectedLlamaVersion,
    handleSelectInstalledVersion,
    handleDeleteInstalledVersion,
    handleCleanupOldVersions,
    handleClearLogs,
    handleDownloadLogs,
    handleCopyLogs,
    handleApplyFastPreset,
    handleApplyFastMtpPreset,
    handleStartLocalServer,
    handleStopLocalServer,
    handleRestartLocalServer,
  } = useLocalServerProcess(props);

  const isSelectedVersionInstalled = installedVersions.some(
    (v) => v.tag.toLowerCase() === selectedTag.toLowerCase()
  );

  const mainLocalModels = scannedLocalModels.filter((m) => !m.isDraft && !m.isMmproj);
  const draftLocalModels = scannedLocalModels.filter(
    (m) => m.isDraft || /fastmtp|mtp|draft/i.test(m.fileName)
  );

  return (
    <div className="w-full space-y-6 pb-10 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header + Live Health Telemetry */}
      <SettingsHeader
        title={t.settings.localServer.title}
        subtitle={t.settings.localServer.subtitle}
        icon={<Cpu size={18} />}
        actionSlot={
          serverStatus === 'running' ? (
            <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] shadow-xs select-none">
              <Activity size={13} className="text-emerald-500 animate-pulse" />
              <span className="text-[var(--theme-text)] font-semibold">
                {healthStatus === 'loading'
                  ? t.settings.localServer.loadingToGpu
                  : healthStatus === 'ok'
                  ? formatString(t.settings.localServer.onlineSlots, {
                      active: slotMetrics.activeSlots,
                      total: slotMetrics.totalSlots || 1,
                    })
                  : t.settings.localServer.initializing}
              </span>
            </div>
          ) : undefined
        }
      />

      {/* 2. Sub-Navigation Tabs Bar (Segmented Pills) */}
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubtab('config')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'config'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Box size={14} className={activeSubtab === 'config' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.localServer.subtabConfig}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
            {serverStatus === 'running' ? 'Active' : 'Offline'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('params')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'params'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Sliders size={14} className={activeSubtab === 'params' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.localServer.subtabParams}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
            {ctxSize.toLocaleString()} tok
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('remote_node')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'remote_node'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Cpu size={14} className={activeSubtab === 'remote_node' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>Compute Node (LAN)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
            {config?.remote_node?.enabled ? 'Online' : 'LAN'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'logs'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Terminal size={14} className={activeSubtab === 'logs' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.localServer.subtabLogs}</span>
          {serverLogs.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
              {serverLogs.length}
            </span>
          )}
        </button>
      </div>

      {/* Crash Advisory Alert Box */}
      <CrashAdviserCard crashAdvice={crashAdvice} />

      {/* ===================================================================== */}
      {/* SUBTAB 1: MODEL & SERVER CONFIGURATION                                */}
      {/* ===================================================================== */}
      {activeSubtab === 'config' && (
        <ServerConfigSection
          hardwareInfo={hardwareInfo}
          serverStatus={serverStatus}
          healthStatus={healthStatus}
          slotMetrics={slotMetrics}
          isActionLoading={isActionLoading}
          handleRestartLocalServer={handleRestartLocalServer}
          handleStopLocalServer={handleStopLocalServer}
          handleStartLocalServer={handleStartLocalServer}
          modelPath={modelPath}
          setModelPath={setModelPath}
          mainLocalModels={mainLocalModels}
          refreshScannedModels={refreshScannedModels}
          handleSelectModel={handleSelectModel}
          modelMeta={modelMeta}
          githubReleases={githubReleases}
          selectedTag={selectedTag}
          handleTagChange={handleTagChange}
          selectedAssetUrl={selectedAssetUrl}
          setSelectedAssetUrl={setSelectedAssetUrl}
          setSelectedAssetName={setSelectedAssetName}
          isLoadingReleases={isLoadingReleases}
          isInstallingLlama={isInstallingLlama}
          autoCleanupOld={autoCleanupOld}
          setAutoCleanupOld={setAutoCleanupOld}
          justDownloadedTag={justDownloadedTag}
          isSelectedVersionInstalled={isSelectedVersionInstalled}
          handleInstallSelectedLlamaVersion={handleInstallSelectedLlamaVersion}
          installedVersions={installedVersions}
          isCleaningOld={isCleaningOld}
          deletingTag={deletingTag}
          handleSelectInstalledVersion={handleSelectInstalledVersion}
          handleDeleteInstalledVersion={handleDeleteInstalledVersion}
          handleCleanupOldVersions={handleCleanupOldVersions}
          exePath={exePath}
          setExePath={setExePath}
          handleSelectExe={handleSelectExe}
        />
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: LLAMA.CPP PARAMETERS & TUNING                               */}
      {/* ===================================================================== */}
      {activeSubtab === 'params' && (
        <div className="space-y-6">
          <ServerPerformanceParams
            host={host}
            setHost={setHost}
            port={port}
            setPort={setPort}
            ctxSize={ctxSize}
            setCtxSize={setCtxSize}
            threads={threads}
            setThreads={setThreads}
            gpuLayers={gpuLayers}
            setGpuLayers={setGpuLayers}
            temp={temp}
            setTemp={setTemp}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            ubatchSize={ubatchSize}
            setUbatchSize={setUbatchSize}
            minP={minP}
            setMinP={setMinP}
            topK={topK}
            setTopK={setTopK}
            topP={topP}
            setTopP={setTopP}
            predict={predict}
            setPredict={setPredict}
            repeatPenalty={repeatPenalty}
            setRepeatPenalty={setRepeatPenalty}
            flashAttn={flashAttn}
            setFlashAttn={setFlashAttn}
            mmap={mmap}
            setMmap={setMmap}
            mlock={mlock}
            setMlock={setMlock}
            embedding={embedding}
            setEmbedding={setEmbedding}
            contBatching={contBatching}
            setContBatching={setContBatching}
            promptCache={promptCache}
            setPromptCache={setPromptCache}
            parallelSlots={parallelSlots}
            setParallelSlots={setParallelSlots}
            cacheReuse={cacheReuse}
            setCacheReuse={setCacheReuse}
            slotSavePath={slotSavePath}
            setSlotSavePath={setSlotSavePath}
            customArgs={customArgs}
            setCustomArgs={setCustomArgs}
            specDraftModel={specDraftModel}
            setSpecDraftModel={setSpecDraftModel}
            specType={specType}
            setSpecType={setSpecType}
            specDraftNgl={specDraftNgl}
            setSpecDraftNgl={setSpecDraftNgl}
            specDraftNMax={specDraftNMax}
            setSpecDraftNMax={setSpecDraftNMax}
            specDraftPMin={specDraftPMin}
            setSpecDraftPMin={setSpecDraftPMin}
            jinja={jinja}
            setJinja={setJinja}
            reasoningPreserve={reasoningPreserve}
            setReasoningPreserve={setReasoningPreserve}
            reasoningFormat={reasoningFormat}
            setReasoningFormat={setReasoningFormat}
            scannedDraftModels={draftLocalModels}
            onSelectDraftModelFile={handleSelectDraftModel}
            onSelectSlotSavePath={handleSelectSlotSavePath}
            onApplyFastPreset={handleApplyFastPreset}
            onApplyFastMtpPreset={handleApplyFastMtpPreset}
            modelMeta={modelMeta}
            serverStatus={serverStatus}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 3: REMOTE COMPUTE NODE (LAN)                                   */}
      {/* ===================================================================== */}
      {activeSubtab === 'remote_node' && (
        <RemoteNodeSection
          config={config || null}
          onSaveConfig={onSaveConfig || (async () => {})}
        />
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 4: LOGS & CONSOLE TERMINAL                                     */}
      {/* ===================================================================== */}
      {activeSubtab === 'logs' && (
        <div className="space-y-6">
          <ServerLogsConsole
            serverLogs={serverLogs}
            logFilePath={logFilePath}
            serverLogsAutoScroll={serverLogsAutoScroll}
            setServerLogsAutoScroll={setServerLogsAutoScroll}
            isCopiedLogs={isCopiedLogs}
            onCopyLogs={handleCopyLogs}
            onDownloadLogs={handleDownloadLogs}
            onClearLogs={handleClearLogs}
            logsContainerRef={logsContainerRef}
            logsEndRef={logsEndRef}
          />
        </div>
      )}
    </div>
  );
});
