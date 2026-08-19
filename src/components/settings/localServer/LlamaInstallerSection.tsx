import React from 'react';
import { Download, RefreshCw } from 'lucide-react';

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
  const currentRel = githubReleases.find((r) => r.tag === selectedTag);

  return (
    <div className="p-4 rounded-2xl bento-card space-y-3.5 border border-[var(--theme-border)]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--theme-border)] pb-2.5">
        <div>
          <div className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-1.5">
            <Download size={14} className="text-[var(--theme-text-muted)]" />
            <span>Официальный установщик Llama.cpp с GitHub</span>
          </div>
          <div className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
            Выбирайте версию релиза llama.cpp и сохраняйте её локально на диске
          </div>
        </div>
        {isLoadingReleases && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--theme-text-muted)]">
            <RefreshCw size={12} className="animate-spin" />
            <span>Загрузка релизов...</span>
          </div>
        )}
      </div>

      {/* Release Tag Dropdown & Asset Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">
            Версия релиза (GitHub Tag)
          </label>
          <select
            value={selectedTag}
            onChange={(e) => onTagChange(e.target.value)}
            disabled={githubReleases.length === 0 || isInstallingLlama}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none cursor-pointer transition-colors"
          >
            {githubReleases.map((rel) => (
              <option key={rel.tag} value={rel.tag} className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">
                {rel.name} ({rel.tag})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">
            Бинарный файл релиза (Asset)
          </label>
          <select
            value={selectedAssetUrl}
            onChange={(e) => {
              const url = e.target.value;
              const asset = currentRel?.assets.find((a: any) => a.download_url === url);
              onAssetUrlChange(url, asset ? asset.name : '');
            }}
            disabled={!currentRel || isInstallingLlama}
            className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none cursor-pointer transition-colors"
          >
            {currentRel?.assets.map((asset: any) => (
              <option key={asset.download_url} value={asset.download_url} className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">
                {asset.name} ({asset.size})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Auto Cleanup Old Versions Checkbox & Download Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
        <label className="flex items-center gap-2 text-xs text-[var(--theme-text-muted)] cursor-pointer select-none font-medium">
          <input
            type="checkbox"
            checked={autoCleanupOld}
            onChange={(e) => setAutoCleanupOld(e.target.checked)}
            className="rounded accent-[var(--theme-accent)]"
          />
          <span>Автоматически удалять предыдущую установку при скачивании новой</span>
        </label>

        <div className="flex items-center gap-2 shrink-0">
          {justDownloadedTag === selectedTag && (
            <span className="px-2.5 py-1 rounded-lg bg-[var(--theme-accent)]/10 text-[var(--theme-text)] border border-[var(--theme-border)] text-[10px] font-mono font-semibold">
              Установлено
            </span>
          )}
          <button
            type="button"
            onClick={onInstall}
            disabled={!selectedAssetUrl || isInstallingLlama}
            className="px-4 py-2 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] hover:opacity-90 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all shadow-sm"
          >
            {isInstallingLlama ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Загрузка и распаковка...</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>{isSelectedVersionInstalled ? 'Переустановить' : 'Скачать и установить'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
