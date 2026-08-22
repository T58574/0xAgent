import React, { useRef } from 'react';
import { Cpu, Folder, Zap, Activity, RefreshCw, HardDrive, Play, Square } from 'lucide-react';
import { useI18n } from '../../i18n';
import { LlamaInstallerSection } from './localServer/LlamaInstallerSection';
import { InstalledVersionsSection } from './localServer/InstalledVersionsSection';
import { ServerPerformanceParams } from './localServer/ServerPerformanceParams';
import { ServerLogsConsole } from './localServer/ServerLogsConsole';
import { CrashAdviserCard } from './localServer/CrashAdviserCard';
import { useLocalServerProcess } from './localServer/useLocalServerProcess';

interface LocalServerTabProps {
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

export const LocalServerTab: React.FC<LocalServerTabProps> = React.memo((props) => {
  const {
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
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const {
    logFilePath,
    isCopiedLogs,
    isInstallingLlama,
    githubReleases,
    selectedTag,
    selectedAssetUrl,
    setSelectedAssetUrl,
    setSelectedAssetName,
    installedVersions,
    isLoadingReleases,
    autoCleanupOld,
    setAutoCleanupOld,
    justDownloadedTag,
    isCleaningOld,
    deletingTag,
    modelMeta,
    hardwareInfo,
    healthStatus,
    slotMetrics,
    crashAdvice,
    scannedLocalModels,
    isActionLoading,
    refreshScannedModels,
    handleTagChange,
    handleSelectExe,
    handleSelectModel,
    handleSelectDraftModel,
    handleSelectSlotSavePath,
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
  const draftLocalModels = scannedLocalModels.filter((m) => m.isDraft || /fastmtp|mtp|draft/i.test(m.fileName));

  return (
    <div className="space-y-4 font-sans text-[var(--theme-text)] max-w-full">
      {/* Top Header & Live Health Metric */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--theme-border)] pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
            <Cpu size={16} className="text-[var(--theme-accent)]" />
            <span>{t.settings.localServer.title}</span>
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
            {t.settings.localServer.subtitle}
          </p>
        </div>

        {/* Live Health Metrics Badge */}
        {serverStatus === 'running' && (
          <div className="flex items-center gap-2 text-xs font-mono bento-card px-3 py-1.5 rounded-lg select-none">
            <Activity size={13} className="text-emerald-500 animate-pulse" />
            <span className="text-[var(--theme-text)] font-medium">
              {healthStatus === 'loading'
                ? t.settings.localServer.loadingToGpu
                : healthStatus === 'ok'
                ? formatString(t.settings.localServer.onlineSlots, { active: slotMetrics.activeSlots, total: slotMetrics.totalSlots || 1 })
                : t.settings.localServer.initializing}
            </span>
          </div>
        )}
      </div>

      {/* Crash Advisory Alert Box */}
      <CrashAdviserCard crashAdvice={crashAdvice} />

      {/* MAIN 2-COLUMN GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: Server Settings & Controls */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Hardware GPU & Server Control Hero Banner */}
          <div className="p-4.5 rounded-3xl bento-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[var(--theme-border)] bg-[var(--theme-panel)]/80 shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-accent)]">
                <Zap size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-[var(--theme-text)]">
                  <span>GPU:</span>
                  <span className="font-mono text-[var(--theme-text)]">
                    {hardwareInfo?.gpuName || t.settings.localServer.gpuNameAuto}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--theme-accent)]/10 text-[var(--theme-text)] border border-[var(--theme-border)] font-mono text-[10px] font-semibold">
                    {t.settings.localServer.fullGpuOffload}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--theme-text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${serverStatus === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                    {serverStatus === 'running'
                      ? healthStatus === 'loading'
                        ? t.settings.localServer.loadingToGpu
                        : healthStatus === 'ok'
                        ? formatString(t.settings.localServer.onlineSlots, { active: slotMetrics.activeSlots, total: slotMetrics.totalSlots || 1 })
                        : t.settings.localServer.initializing
                      : t.settings.localServer.serverStopped}
                  </span>
                </div>
              </div>
            </div>

            {/* Prominent Large Server Control Button */}
            <div className="flex items-center gap-2.5 shrink-0">
              {serverStatus === 'running' ? (
                <>
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleRestartLocalServer}
                    className="px-4 py-2.5 rounded-2xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-bold text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                    title={t.settings.localServer.restartBtn}
                  >
                    <RefreshCw size={15} className={isActionLoading ? 'animate-spin' : ''} />
                    <span>{t.settings.localServer.restartBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleStopLocalServer}
                    className="px-4.5 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                    title={t.settings.localServer.stopBtn}
                  >
                    <Square size={15} className="fill-current" />
                    <span>{t.settings.localServer.stopBtn}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isActionLoading || !modelPath}
                  onClick={handleStartLocalServer}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  title={modelPath ? t.settings.localServer.startBtn : t.settings.localServer.selectGgufToStart}
                >
                  <Play size={16} className={isActionLoading ? 'animate-spin fill-current' : 'fill-current'} />
                  <span>{isActionLoading ? t.settings.localServer.startingBtn : t.settings.localServer.startBtn}</span>
                </button>
              )}
            </div>
          </div>

          {/* GitHub Releases Llama.cpp Installer Section */}
          <div className="space-y-3">
            <LlamaInstallerSection
              githubReleases={githubReleases}
              selectedTag={selectedTag}
              onTagChange={handleTagChange}
              selectedAssetUrl={selectedAssetUrl}
              onAssetUrlChange={(url, name) => {
                setSelectedAssetUrl(url);
                if (name) setSelectedAssetName(name);
              }}
              isLoadingReleases={isLoadingReleases}
              isInstallingLlama={isInstallingLlama}
              autoCleanupOld={autoCleanupOld}
              setAutoCleanupOld={setAutoCleanupOld}
              justDownloadedTag={justDownloadedTag}
              isSelectedVersionInstalled={isSelectedVersionInstalled}
              onInstall={handleInstallSelectedLlamaVersion}
            />

            <InstalledVersionsSection
              installedVersions={installedVersions}
              isCleaningOld={isCleaningOld}
              deletingTag={deletingTag}
              onSelectVersion={handleSelectInstalledVersion}
              onDeleteVersion={handleDeleteInstalledVersion}
              onCleanupOld={handleCleanupOldVersions}
            />
          </div>

          {/* Executable Path & Model Selector Card */}
          <div className="p-4 rounded-2xl bento-card space-y-3.5 border border-[var(--theme-border)]">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--theme-text)] flex items-center justify-between">
                <span>{t.settings.localServer.exePath}</span>
                <button
                  type="button"
                  onClick={handleSelectExe}
                  className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Folder size={12} />
                  <span>{t.settings.localServer.browse}</span>
                </button>
              </label>
              <input
                type="text"
                value={exePath}
                onChange={(e) => setExePath(e.target.value)}
                placeholder="~/.0xagent/llama/llama-server.exe"
                className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                  <HardDrive size={14} className="text-[var(--theme-text-muted)]" />
                  <span>{t.settings.localServer.modelPath}</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshScannedModels}
                    className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-medium"
                    title="Rescan models"
                  >
                    <RefreshCw size={11} />
                    <span>{t.settings.localServer.rescanModels}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectModel}
                    className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-medium"
                    title="Select model file"
                  >
                    <Folder size={12} />
                    <span>{t.settings.localServer.browse}</span>
                  </button>
                </div>
              </div>

              {/* Local GGUF Scanned Dropdown */}
              <select
                value={
                  mainLocalModels.find(
                    (m) => m.filePath.toLowerCase() === modelPath.toLowerCase() || m.fileName.toLowerCase() === modelPath.toLowerCase()
                  )?.filePath || (modelPath ? 'custom' : '')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val !== 'custom') {
                    setModelPath(val);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none cursor-pointer transition-colors"
              >
                <option value="" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">{t.settings.localServer.selectModelPlaceholder}</option>
                {mainLocalModels.map((m) => (
                  <option key={m.id || m.filePath} value={m.filePath} className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">
                    {m.title || m.fileName} ({m.quantization} • {m.sizeGB})
                  </option>
                ))}
                {modelPath && !mainLocalModels.some((m) => m.filePath.toLowerCase() === modelPath.toLowerCase()) && (
                  <option value="custom" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">{formatString(t.settings.localServer.customPath, { path: modelPath })}</option>
                )}
              </select>

              {/* Full Absolute Path Details Input */}
              <input
                type="text"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                placeholder="~/.0xagent/models/model.gguf"
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-text-muted)] focus:text-[var(--theme-text)] focus:outline-none transition-colors"
              />
            </div>

            {/* GGUF Model Metadata Card with Reasoning Specs */}
            {modelMeta && (
              <div className="p-4 rounded-2xl bento-card border border-[var(--theme-border)] text-xs space-y-2.5 font-mono shadow-sm">
                <div className="flex items-center justify-between text-[var(--theme-text)] font-bold border-b border-[var(--theme-border)] pb-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{modelMeta.cleanTitle || modelMeta.modelName || modelMeta.architecture}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[10px] text-[var(--theme-text)] font-semibold">
                      {modelMeta.quantization}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] text-[10px] shrink-0 font-medium">
                    {modelMeta.fileSizeFormatted}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>{t.settings.localServer.modelMeta.family}</span>
                    <span className="text-[var(--theme-text)] font-bold uppercase">{modelMeta.family || 'GGUF'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>{t.settings.localServer.modelMeta.trainContext}</span>
                    <span className="text-[var(--theme-text)] font-bold">{modelMeta.contextLength.toLocaleString()} tok</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>{t.settings.localServer.modelMeta.reasoningSpec}</span>
                    <span className={modelMeta.supportsReasoning ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-[var(--theme-text-muted)]'}>
                      {modelMeta.supportsReasoning ? t.settings.localServer.modelMeta.supported : t.settings.localServer.modelMeta.instructDirect}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>{t.settings.localServer.modelMeta.recomMode}</span>
                    <span className="text-[var(--theme-text)] font-bold uppercase">
                      {modelMeta.recommendedReasoningEffort || 'AUTO'}
                    </span>
                  </div>
                </div>

                {modelMeta.supportsFastMtp && (
                  <div className="flex items-center justify-between text-[11px] border-t border-[var(--theme-border)] pt-2 mt-1">
                    <span className="text-sky-600 dark:text-sky-300 font-semibold">{t.settings.localServer.modelMeta.fastMtpSupport}</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                      {t.settings.localServer.modelMeta.fastMtpBadge}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Performance Parameters Component */}
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

        {/* RIGHT COLUMN: Terminal Logs Console */}
        <div className="lg:col-span-5">
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

      </div>
    </div>
  );
});
