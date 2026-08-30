import React, { useRef } from 'react';
import { Cpu, Folder, Zap, Activity, RefreshCw, Play, Square } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { SettingsHeader } from './common';
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
  const draftLocalModels = scannedLocalModels.filter(
    (m) => m.isDraft || /fastmtp|mtp|draft/i.test(m.fileName)
  );

  return (
    <div className="w-full space-y-6 font-sans text-[var(--theme-text)]">
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

      {/* 2. Crash Advisory Alert Box */}
      <CrashAdviserCard crashAdvice={crashAdvice} />

      {/* 3. MAIN 2-COLUMN GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Server Settings & Controls */}
        <div className="lg:col-span-7 space-y-4">
          {/* Hardware GPU & Server Control Hero Banner */}
          <Card
            variant="default"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 rounded-2xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-accent)] shrink-0">
                <Zap size={20} />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 font-bold text-xs text-[var(--theme-text)] flex-wrap">
                  <span>GPU:</span>
                  <span className="font-mono text-[var(--theme-text)] truncate">
                    {hardwareInfo?.gpuName || t.settings.localServer.gpuNameAuto}
                  </span>
                  <Badge variant="neutral" size="xs">
                    {t.settings.localServer.fullGpuOffload}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--theme-text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        serverStatus === 'running'
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-zinc-400'
                      }`}
                    />
                    {serverStatus === 'running'
                      ? healthStatus === 'loading'
                        ? t.settings.localServer.loadingToGpu
                        : healthStatus === 'ok'
                        ? formatString(t.settings.localServer.onlineSlots, {
                            active: slotMetrics.activeSlots,
                            total: slotMetrics.totalSlots || 1,
                          })
                        : t.settings.localServer.initializing
                      : t.settings.localServer.serverStopped}
                  </span>
                </div>
              </div>
            </div>

            {/* Server Action Controls */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {serverStatus === 'running' ? (
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={isActionLoading}
                    loading={isActionLoading}
                    onClick={handleRestartLocalServer}
                    icon={<RefreshCw size={14} />}
                  >
                    {t.settings.localServer.restartBtn}
                  </Button>

                  <Button
                    variant="danger"
                    size="md"
                    disabled={isActionLoading}
                    onClick={handleStopLocalServer}
                    icon={<Square size={13} className="fill-current" />}
                  >
                    {t.settings.localServer.stopBtn}
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  disabled={isActionLoading || !modelPath}
                  loading={isActionLoading}
                  onClick={handleStartLocalServer}
                  icon={<Play size={14} className="fill-current" />}
                  title={modelPath ? t.settings.localServer.startBtn : t.settings.localServer.selectGgufToStart}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-sm"
                >
                  {isActionLoading ? t.settings.localServer.startingBtn : t.settings.localServer.startBtn}
                </Button>
              )}
            </div>
          </Card>

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
          <Card variant="default" className="space-y-4">
            <Input
              label={t.settings.localServer.exePath}
              value={exePath}
              onChange={(e) => setExePath(e.target.value)}
              placeholder="~/.0xagent/llama/llama-server.exe"
              mono
              actionSlot={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleSelectExe}
                  icon={<Folder size={12} />}
                >
                  {t.settings.localServer.browse}
                </Button>
              }
            />

            <div className="space-y-2">
              <Select
                label={t.settings.localServer.modelPath}
                value={
                  mainLocalModels.find(
                    (m) =>
                      m.filePath.toLowerCase() === modelPath.toLowerCase() ||
                      m.fileName.toLowerCase() === modelPath.toLowerCase()
                  )?.filePath || (modelPath ? 'custom' : '')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val !== 'custom') {
                    setModelPath(val);
                  }
                }}
                mono
                actionSlot={
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={refreshScannedModels}
                      icon={<RefreshCw size={11} />}
                      title="Rescan models"
                    >
                      {t.settings.localServer.rescanModels}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleSelectModel}
                      icon={<Folder size={12} />}
                      title="Select model file"
                    >
                      {t.settings.localServer.browse}
                    </Button>
                  </div>
                }
              >
                <option value="" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">
                  {t.settings.localServer.selectModelPlaceholder}
                </option>
                {mainLocalModels.map((m) => (
                  <option
                    key={m.id || m.filePath}
                    value={m.filePath}
                    className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]"
                  >
                    {m.title || m.fileName} ({m.quantization} • {m.sizeGB})
                  </option>
                ))}
                {modelPath &&
                  !mainLocalModels.some(
                    (m) => m.filePath.toLowerCase() === modelPath.toLowerCase()
                  ) && (
                    <option
                      value="custom"
                      className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]"
                    >
                      {formatString(t.settings.localServer.customPath, { path: modelPath })}
                    </option>
                  )}
              </Select>

              {/* Full Absolute Path Details Input */}
              <Input
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                placeholder="~/.0xagent/models/model.gguf"
                mono
              />
            </div>

            {/* GGUF Model Metadata Card with Reasoning Specs */}
            {modelMeta && (
              <Card variant="recessed" className="space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between text-[var(--theme-text)] font-bold border-b border-[var(--theme-border)] pb-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">
                      {modelMeta.cleanTitle || modelMeta.modelName || modelMeta.architecture}
                    </span>
                    <Badge variant="neutral" size="xs">
                      {modelMeta.quantization}
                    </Badge>
                  </div>
                  <Badge variant="neutral" size="xs">
                    {modelMeta.fileSizeFormatted}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>{t.settings.localServer.modelMeta.family}</span>
                    <span className="text-[var(--theme-text)] font-bold uppercase">
                      {modelMeta.family || 'GGUF'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>{t.settings.localServer.modelMeta.trainContext}</span>
                    <span className="text-[var(--theme-text)] font-bold">
                      {modelMeta.contextLength.toLocaleString()} tok
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>{t.settings.localServer.modelMeta.reasoningSpec}</span>
                    <span
                      className={
                        modelMeta.supportsReasoning
                          ? 'text-sky-500 font-bold'
                          : 'text-[var(--theme-text-muted)]'
                      }
                    >
                      {modelMeta.supportsReasoning
                        ? t.settings.localServer.modelMeta.supported
                        : t.settings.localServer.modelMeta.instructDirect}
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
                    <span className="text-sky-500 font-semibold">
                      {t.settings.localServer.modelMeta.fastMtpSupport}
                    </span>
                    <Badge variant="info" size="xs">
                      {t.settings.localServer.modelMeta.fastMtpBadge}
                    </Badge>
                  </div>
                )}
              </Card>
            )}
          </Card>

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
