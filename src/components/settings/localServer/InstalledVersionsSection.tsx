import React from 'react';
import { HardDrive, RefreshCw, Trash2 } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';

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
      <div className="flex items-center justify-between text-xs text-[var(--theme-text)] font-bold px-0.5 select-none">
        <div className="flex items-center gap-1.5">
          <HardDrive size={13} className="text-[var(--theme-text-muted)]" />
          <span>
            {formatString(t.settings.localServer.versions.installedTitle, {
              count: installedVersions.length,
            })}
          </span>
        </div>
        {installedVersions.length > 1 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onCleanupOld}
            disabled={isCleaningOld}
            loading={isCleaningOld}
            icon={isCleaningOld ? <RefreshCw size={11} /> : <Trash2 size={11} />}
          >
            {t.settings.localServer.versions.cleanupOldBtn}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {installedVersions.map((ver) => (
          <Card
            key={ver.exePath}
            variant={ver.isCurrent ? 'interactive' : 'default'}
            selected={ver.isCurrent}
            padded={false}
            className="p-3 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 font-mono truncate min-w-0">
              <span className="font-bold text-[var(--theme-text)] shrink-0">{ver.tag}</span>
              {ver.isCurrent && (
                <Badge variant="accent" size="xs">
                  {t.settings.localServer.versions.activeBadge}
                </Badge>
              )}
              <span
                className="text-[10px] text-[var(--theme-text-muted)] truncate max-w-[220px]"
                title={ver.exePath}
              >
                {ver.exePath}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!ver.isCurrent && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => onSelectVersion(ver.exePath)}
                >
                  {t.settings.localServer.versions.selectBtn}
                </Button>
              )}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onDeleteVersion(ver.tag, ver.exePath)}
                disabled={deletingTag === ver.tag}
                icon={<Trash2 size={12} className="text-rose-500 hover:text-rose-400" />}
                title={t.settings.localServer.versions.deleteTooltip}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
