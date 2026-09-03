import React from 'react';
import { Zap, RefreshCw, Square, Play, Folder } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { LlamaInstallerSection } from './LlamaInstallerSection';
import { InstalledVersionsSection } from './InstalledVersionsSection';
import { GgufMetadata, HardwareInfo, LocalModelItem } from '../../../types';

export interface ServerConfigSectionProps {
  hardwareInfo: HardwareInfo | null;
  serverStatus: 'stopped' | 'running' | 'checking';
  healthStatus: string;
  slotMetrics: { activeSlots: number; totalSlots: number };
  isActionLoading: boolean;
  handleRestartLocalServer: () => void;
  handleStopLocalServer: () => void;
  handleStartLocalServer: () => void;
  modelPath: string;
  setModelPath: (val: string) => void;
  mainLocalModels: LocalModelItem[];
  refreshScannedModels: () => void;
  handleSelectModel: () => void;
  modelMeta: GgufMetadata | null;
  githubReleases: any[];
  selectedTag: string;
  handleTagChange: (tag: string) => void;
  selectedAssetUrl: string;
  setSelectedAssetUrl: (url: string) => void;
  setSelectedAssetName: (name: string) => void;
  isLoadingReleases: boolean;
  isInstallingLlama: boolean;
  autoCleanupOld: boolean;
  setAutoCleanupOld: (val: boolean) => void;
  justDownloadedTag: string | null;
  isSelectedVersionInstalled: boolean;
  handleInstallSelectedLlamaVersion: () => void;
  installedVersions: { tag: string; exePath: string; isCurrent: boolean }[];
  isCleaningOld: boolean;
  deletingTag: string | null;
  handleSelectInstalledVersion: (vExePath: string) => void;
  handleDeleteInstalledVersion: (tag: string, vExePath: string) => void;
  handleCleanupOldVersions: () => void;
  exePath: string;
  setExePath: (val: string) => void;
  handleSelectExe: () => void;
}

export const ServerConfigSection: React.FC<ServerConfigSectionProps> = ({
  hardwareInfo,
  serverStatus,
  healthStatus,
  slotMetrics,
  isActionLoading,
  handleRestartLocalServer,
  handleStopLocalServer,
  handleStartLocalServer,
  modelPath,
  setModelPath,
  mainLocalModels,
  refreshScannedModels,
  handleSelectModel,
  modelMeta,
  githubReleases,
  selectedTag,
  handleTagChange,
  selectedAssetUrl,
  setSelectedAssetUrl,
  setSelectedAssetName,
  isLoadingReleases,
  isInstallingLlama,
  autoCleanupOld,
  setAutoCleanupOld,
  justDownloadedTag,
  isSelectedVersionInstalled,
  handleInstallSelectedLlamaVersion,
  installedVersions,
  isCleaningOld,
  deletingTag,
  handleSelectInstalledVersion,
  handleDeleteInstalledVersion,
  handleCleanupOldVersions,
  exePath,
  setExePath,
  handleSelectExe,
}) => {
  const { t, formatString } = useI18n();

  return (
    <div className="space-y-6">
      {/* Hardware GPU & Server Control Hero Banner */}
      <Card
        variant="default"
        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm rounded-2xl"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-3.5 rounded-2xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-accent)] shrink-0">
            <Zap size={22} />
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
                  className={'w-2 h-2 rounded-full ' + (serverStatus === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400')}
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

      {/* Model Selection & Metadata Card */}
      <Card variant="default" className="p-6 space-y-5 rounded-2xl">
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
              !mainLocalModels.some((m) => m.filePath.toLowerCase() === modelPath.toLowerCase()) && (
                <option value="custom" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">
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
          <Card
            variant="recessed"
            className="p-4 space-y-3 font-mono text-xs rounded-2xl border border-[var(--theme-border)]"
          >
            <div className="flex items-center justify-between text-[var(--theme-text)] font-bold border-b border-[var(--theme-border)] pb-2.5">
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

            <div className="grid grid-cols-2 gap-3 text-[11.5px]">
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
              <div className="flex items-center justify-between text-[11px] border-t border-[var(--theme-border)] pt-2.5 mt-1">
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

      {/* GitHub Releases Llama.cpp Installer Section */}
      <div className="space-y-4">
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

        <Card variant="default" className="p-5 rounded-2xl">
          <Input
            label={t.settings.localServer.exePath}
            value={exePath}
            onChange={(e) => setExePath(e.target.value)}
            placeholder="~/.0xagent/llama/llama-server.exe"
            mono
            actionSlot={
              <Button variant="ghost" size="xs" onClick={handleSelectExe} icon={<Folder size={12} />}>
                {t.settings.localServer.browse}
              </Button>
            }
          />
        </Card>
      </div>
    </div>
  );
};
