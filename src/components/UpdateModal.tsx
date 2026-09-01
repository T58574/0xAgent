import React, { useState } from 'react';
import { RefreshCw, ArrowUpRight, Sparkles, CheckCircle2, AlertCircle, ShieldCheck, DownloadCloud } from 'lucide-react';
import { Modal, Button, Badge, Card } from './ui';
import { useI18n } from '../i18n';
import { UpdateCheckResult, UpdateApplyResult } from '../types';
import { check_for_updates, apply_system_update } from '../services/api';

export interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateData: UpdateCheckResult | null;
  onUpdateApplied?: (result: UpdateApplyResult) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateData,
  onUpdateApplied,
}) => {
  const { t } = useI18n();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [currentUpdateData, setCurrentUpdateData] = useState<UpdateCheckResult | null>(updateData);
  const [updateResult, setUpdateResult] = useState<UpdateApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (updateData) {
      setCurrentUpdateData(updateData);
    }
  }, [updateData]);

  const handleCheckAgain = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const res = await check_for_updates(true);
      setCurrentUpdateData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to check updates');
    } finally {
      setIsChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      const res = await apply_system_update();
      setUpdateResult(res);
      if (res.success && onUpdateApplied) {
        onUpdateApplied(res);
      }
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const hasUpdate = currentUpdateData?.hasUpdate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isUpdating ? () => {} : onClose}
      title={t.systemUpdate.modalTitle}
      subtitle={hasUpdate ? t.systemUpdate.updateAvailableTitle : t.systemUpdate.upToDateTitle}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckAgain}
            disabled={isChecking || isUpdating}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
            <span>{t.systemUpdate.checkAgain}</span>
          </Button>

          <div className="flex items-center gap-2">
            {!updateResult?.success && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={isUpdating}
              >
                {t.systemUpdate.remindLater}
              </Button>
            )}

            {hasUpdate && !updateResult?.success && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="flex items-center gap-1.5 font-bold"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{t.systemUpdate.updating}</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud size={14} />
                    <span>{t.systemUpdate.updateNow}</span>
                  </>
                )}
              </Button>
            )}

            {updateResult?.success && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.location.reload()}
                className="font-bold flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                <span>{t.systemUpdate.reloadApp}</span>
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs font-sans">
        {/* Version Comparison Banner */}
        <div className="p-4 rounded-2xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[var(--theme-text-muted)] text-[11px] font-medium">
              {t.systemUpdate.currentVersion}
            </span>
            <span className="text-sm font-bold text-[var(--theme-text)]">
              v{currentUpdateData?.currentVersion || '0.1.0'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasUpdate ? (
              <Badge variant="accent" size="md" className="font-bold animate-pulse flex items-center gap-1">
                <ArrowUpRight size={13} />
                <span>v{currentUpdateData?.latestVersion}</span>
              </Badge>
            ) : (
              <Badge variant="success" size="md" className="flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>{t.systemUpdate.upToDateTitle}</span>
              </Badge>
            )}

          </div>
        </div>

        {/* Success Alert */}
        {updateResult?.success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-xs">{t.systemUpdate.updateSuccess}</p>
              <p className="text-[11px] text-emerald-400/80">{t.systemUpdate.restartPrompt}</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs">{t.systemUpdate.updateFailed}</p>
              <p className="text-[11px] text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Backup Notice */}
        {hasUpdate && !updateResult && (
          <div className="px-3.5 py-2.5 rounded-xl bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] flex items-center gap-2 text-[11px]">
            <ShieldCheck size={14} className="text-[var(--theme-accent)] shrink-0" />
            <span>{t.systemUpdate.backupNotice}</span>
          </div>
        )}

        {/* Release Notes / Changelog */}
        {currentUpdateData?.releaseNotes && (
          <Card className="p-3.5 space-y-2 border border-[var(--theme-border)] bg-[var(--theme-card-bg)]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[var(--theme-accent)]" />
                {t.systemUpdate.releaseNotes}
              </span>
              {currentUpdateData.releaseUrl && (
                <a
                  href={currentUpdateData.releaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[var(--theme-accent)] hover:underline flex items-center gap-0.5"
                >
                  <span>GitHub</span>
                  <ArrowUpRight size={11} />
                </a>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto pr-1 text-[11px] text-[var(--theme-text-muted)] leading-relaxed whitespace-pre-wrap font-mono select-text bg-[var(--theme-panel-solid)] p-3 rounded-lg border border-[var(--theme-border)]">
              {currentUpdateData.releaseNotes}
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
};
