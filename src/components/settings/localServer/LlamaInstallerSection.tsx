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
    <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
      <div className="space-y-3 pb-3 border-b border-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Download size={14} className="text-emerald-400" />
              <span>Официальный установщик Llama.cpp с GitHub</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Выбирайте любую версию релиза llama.cpp из GitHub и сохраняйте её локально на диске
            </div>
          </div>
          {isLoadingReleases && (
            <div className="flex items-center gap-1.5 text-xs text-sky-400">
              <RefreshCw size={12} className="animate-spin" />
              <span>Загрузка релизов...</span>
            </div>
          )}
        </div>

        {/* Release Tag Dropdown & Asset Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">
              Версия релиза llama.cpp (GitHub Tag)
            </label>
            <select
              value={selectedTag}
              onChange={(e) => onTagChange(e.target.value)}
              disabled={githubReleases.length === 0 || isInstallingLlama}
              className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none cursor-pointer"
            >
              {githubReleases.map((rel) => (
                <option key={rel.tag} value={rel.tag} className="bg-slate-900 text-slate-100">
                  {rel.name} ({rel.tag})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">
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
              className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none cursor-pointer"
            >
              {currentRel?.assets.map((asset: any) => (
                <option key={asset.download_url} value={asset.download_url} className="bg-slate-900 text-slate-100">
                  {asset.name} ({asset.size})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto Cleanup Old Versions Checkbox & Download Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCleanupOld}
              onChange={(e) => setAutoCleanupOld(e.target.checked)}
              className="rounded bg-slate-950 border-white/20 text-emerald-500 focus:ring-0"
            />
            <span>Автоматически удалять предыдущую установку при скачивании новой</span>
          </label>

          <div className="flex items-center gap-2 shrink-0">
            {justDownloadedTag === selectedTag && (
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold animate-pulse">
                Установлено!
              </span>
            )}
            <button
              type="button"
              onClick={onInstall}
              disabled={!selectedAssetUrl || isInstallingLlama}
              className="flat-btn px-4 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all shadow-md"
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
    </div>
  );
};
