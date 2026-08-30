import React from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { Toggle } from '../../ui/Toggle';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';

interface LlamaInstallerSectionProps {
  githubReleases: any[];
  selectedTag: string;
  onTagChange: (tag: string) => void;
  selectedAssetUrl: string;
  onAssetUrlChange: (url: string, name: string) => void;
  isLoadingReleases: boolean;
  isInstallingLlama: boolean;
  autoCleanupOld: boolean;
  setAutoCleanupOld: (val: boolean) => void;
  justDownloadedTag: string | null;
  isSelectedVersionInstalled: boolean;
  onInstall: () => void;
}

export const LlamaInstallerSection: React.FC<LlamaInstallerSectionProps> = ({
  githubReleases,
  selectedTag,
  onTagChange,
  selectedAssetUrl,
  onAssetUrlChange,
  isLoadingReleases,
  isInstallingLlama,
  autoCleanupOld,
  setAutoCleanupOld,
  justDownloadedTag,
  isSelectedVersionInstalled,
  onInstall,
}) => {
  const { t } = useI18n();
  const currentRel = githubReleases.find((r) => r.tag === selectedTag);

  return (
    <Card variant="default" className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--theme-border)] pb-2.5">
        <div>
          <div className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-1.5">
            <Download size={14} className="text-[var(--theme-text-muted)]" />
            <span>{t.settings.localServer.installer.githubInstallerTitle}</span>
          </div>
          <div className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
            {t.settings.localServer.installer.githubInstallerDesc}
          </div>
        </div>
        {isLoadingReleases && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--theme-text-muted)]">
            <RefreshCw size={12} className="animate-spin" />
            <span>{t.settings.localServer.installer.loadingReleases}</span>
          </div>
        )}
      </div>

      {/* Release Tag Dropdown & Asset Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Select
          label={t.settings.localServer.installer.releaseTagLabel}
          value={selectedTag}
          onChange={(e) => onTagChange(e.target.value)}
          disabled={githubReleases.length === 0 || isInstallingLlama}
          mono
          options={githubReleases.map((rel) => ({
            value: rel.tag,
            label: rel.name || rel.tag,
            sublabel: rel.tag,
          }))}
        />

        <Select
          label={t.settings.localServer.installer.assetLabel}
          value={selectedAssetUrl}
          onChange={(e) => {
            const url = e.target.value;
            const asset = currentRel?.assets.find((a: any) => a.download_url === url);
            onAssetUrlChange(url, asset ? asset.name : '');
          }}
          disabled={!currentRel || isInstallingLlama}
          mono
          options={
            currentRel?.assets?.map((asset: any) => ({
              value: asset.download_url,
              label: asset.name,
              sublabel: asset.size,
            })) || []
          }
        />
      </div>

      {/* Auto Cleanup Old Versions & Download Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[var(--theme-border)]">
        <Toggle
          checked={autoCleanupOld}
          onChange={(val) => setAutoCleanupOld(val)}
          label={t.settings.localServer.installer.autoCleanupLabel}
          size="sm"
        />

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {justDownloadedTag === selectedTag && (
            <Badge variant="success" size="xs">
              {t.settings.localServer.installer.installedBadge}
            </Badge>
          )}

          <Button
            variant="secondary"
            size="md"
            onClick={onInstall}
            disabled={!selectedAssetUrl || isInstallingLlama}
            loading={isInstallingLlama}
            icon={isInstallingLlama ? <RefreshCw size={13} /> : <Download size={13} />}
          >
            {isInstallingLlama
              ? t.settings.localServer.installer.installingStatus
              : isSelectedVersionInstalled
              ? t.settings.localServer.installer.reinstallBtn
              : t.settings.localServer.installer.downloadInstallBtn}
          </Button>
        </div>
      </div>
    </Card>
  );
};
