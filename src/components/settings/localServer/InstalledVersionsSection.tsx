import React from 'react';
import { HardDrive, RefreshCw, Trash, Trash2 } from 'lucide-react';

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
  if (installedVersions.length === 0) return null;

  return (
    <div className="space-y-2 pt-1 font-sans">
      <div className="flex items-center justify-between text-xs text-[var(--theme-text)] font-semibold px-0.5">
        <div className="flex items-center gap-1.5">
          <HardDrive size={13} className="text-[var(--theme-text-muted)]" />
          <span>Установленные версии ({installedVersions.length})</span>
        </div>
        {installedVersions.length > 1 && (
          <button
            type="button"
            onClick={onCleanupOld}
            disabled={isCleaningOld}
            className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer transition-colors"
          >
            {isCleaningOld ? <RefreshCw size={11} className="animate-spin" /> : <Trash size={11} />}
            <span>Очистить старые</span>
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {installedVersions.map((ver) => (
          <div
            key={ver.exePath}
            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
              ver.isCurrent
                ? 'bg-white/10 border-[var(--theme-border)] text-[var(--theme-text)]'
                : 'bento-card text-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center gap-2 font-mono truncate">
              <span className="font-semibold text-[var(--theme-text)]">{ver.tag}</span>
              {ver.isCurrent && (
                <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)] text-[10px] font-mono">
                  Активная
                </span>
              )}
              <span className="text-[10px] text-[var(--theme-text-muted)] truncate max-w-[200px]" title={ver.exePath}>
                {ver.exePath}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!ver.isCurrent && (
                <button
                  type="button"
                  onClick={() => onSelectVersion(ver.exePath)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-[11px] text-[var(--theme-text)] font-medium cursor-pointer transition-colors"
                >
                  Выбрать
                </button>
              )}
              <button
                type="button"
                onClick={() => onDeleteVersion(ver.tag, ver.exePath)}
                disabled={deletingTag === ver.tag}
                className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 transition-colors cursor-pointer"
                title="Удалить версию"
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
