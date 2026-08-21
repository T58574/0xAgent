import React from 'react';
import { HardDrive, RefreshCw, Trash, Trash2 } from 'lucide-react';
import { useI18n } from '../../../i18n';

interface InstalledVersionsSectionProps {
  installedVersions: { tag: string; exePath: string; isCurrent: boolean }[];
  isCleaningOld: boolean;
  deletingTag: string | null;
  onSelectVersion: (vExePath: string) => void;
  onDeleteVersion: (tag: string, vExePath: string) => void;
  onCleanupOld: () => void;
}

export const InstalledVersionsSection: React.FC<InstalledVersionsSectionProps> = ({
  installedVersions,
  isCleaningOld,
  deletingTag,
  onSelectVersion,
  onDeleteVersion,
  onCleanupOld,
}) => {
  const { t, formatString } = useI18n();

  if (installedVersions.length === 0) return null;

  return (
    <div className="space-y-2 pt-1 font-sans">
      <div className="flex items-center justify-between text-xs text-[var(--theme-text)] font-bold px-0.5">
        <div className="flex items-center gap-1.5">
          <HardDrive size={13} className="text-[var(--theme-text-muted)]" />
          <span>{formatString(t.settings.localServer.versions.installedTitle, { count: installedVersions.length })}</span>
        </div>
        {installedVersions.length > 1 && (
          <button
            type="button"
            onClick={onCleanupOld}
            disabled={isCleaningOld}
            className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer transition-colors font-medium"
          >
            {isCleaningOld ? <RefreshCw size={11} className="animate-spin" /> : <Trash size={11} />}
            <span>{t.settings.localServer.versions.cleanupOldBtn}</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        {installedVersions.map((ver) => (
          <div
            key={ver.exePath}
            className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
              ver.isCurrent
                ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/40 text-[var(--theme-text)] shadow-sm'
                : 'bento-card text-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center gap-2.5 font-mono truncate">
              <span className="font-bold text-[var(--theme-text)]">{ver.tag}</span>
              {ver.isCurrent && (
                <span className="px-2 py-0.5 rounded-md bg-[var(--theme-accent)]/15 text-[var(--theme-text)] border border-[var(--theme-border)] text-[10px] font-mono font-bold">
                  {t.settings.localServer.versions.activeBadge}
                </span>
              )}
              <span className="text-[10px] text-[var(--theme-text-muted)] truncate max-w-[200px]" title={ver.exePath}>
                {ver.exePath}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!ver.isCurrent && (
                <button
                  type="button"
                  onClick={() => onSelectVersion(ver.exePath)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-[11px] font-semibold cursor-pointer transition-all shadow-sm hover:opacity-90"
                >
                  {t.settings.localServer.versions.selectBtn}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDeleteVersion(ver.tag, ver.exePath)}
                disabled={deletingTag === ver.tag}
                className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title={t.settings.localServer.versions.deleteTooltip}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
