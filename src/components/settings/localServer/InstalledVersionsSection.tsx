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
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
        <div className="flex items-center gap-1.5">
          <HardDrive size={13} className="text-sky-400" />
          <span>Установленные версии ({installedVersions.length})</span>
        </div>
        {installedVersions.length > 1 && (
          <button
            type="button"
            onClick={onCleanupOld}
            disabled={isCleaningOld}
            className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
          >
            {isCleaningOld ? <RefreshCw size={11} className="animate-spin" /> : <Trash size={11} />}
            <span>Очистить старые версии</span>
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {installedVersions.map((ver) => (
          <div
            key={ver.exePath}
            className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
              ver.isCurrent
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-900/60 border-white/10 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-mono truncate">
              <span className="font-bold text-slate-100">{ver.tag}</span>
              {ver.isCurrent && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 text-[10px] font-sans font-semibold">
                  Активная
                </span>
              )}
              <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={ver.exePath}>
                {ver.exePath}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!ver.isCurrent && (
                <button
                  type="button"
                  onClick={() => onSelectVersion(ver.exePath)}
                  className="flat-btn px-2 py-1 rounded text-[11px] bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30"
                >
                  Выбрать
                </button>
              )}
              <button
                type="button"
                onClick={() => onDeleteVersion(ver.tag, ver.exePath)}
                disabled={deletingTag === ver.tag}
                className="p-1 rounded text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
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
