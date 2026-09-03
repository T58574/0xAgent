import React from 'react';
import { Copy, Check, ExternalLink, KeyRound, LogOut } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Card } from '../../ui/Card';
import { SettingsSection } from '../common';
import * as api from '../../../services/api';

export interface SecuritySectionProps {
  lanIp: string | null;
  copiedLan: boolean;
  handleCopyLan: () => void;
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  isChangingPassword: boolean;
  passwordStatus: { type: 'success' | 'error'; text: string } | null;
  handleChangePassword: (e: React.FormEvent) => Promise<void>;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  lanIp,
  copiedLan,
  handleCopyLan,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isChangingPassword,
  passwordStatus,
  handleChangePassword,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t.nav.lanTitle}
        description="Безопасный доступ к веб-интерфейсу 0xAgent с мобильных устройств и других ПК в локальной сети"
      >
        <Card variant="default" className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl">
          <div className="space-y-1 min-w-0 pr-3">
            <div className="text-xs font-bold text-[var(--theme-text)]">
              {t.settings.general.lanSharingTitle}
            </div>
            <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
              {t.settings.general.lanSharingDesc}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lanIp ? (
              <>
                <div className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] font-mono text-xs font-bold text-[var(--theme-text)] select-all">
                  https://{lanIp}:3001
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyLan}
                  icon={copiedLan ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                >
                  {copiedLan ? t.settings.general.lanCopied : t.common.copy}
                </Button>
                <a
                  href={`https://${lanIp}:3001`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors"
                >
                  <span>{t.settings.general.lanOpen}</span>
                  <ExternalLink size={12} />
                </a>
              </>
            ) : (
              <span className="text-xs text-[var(--theme-text-muted)] font-mono">127.0.0.1:3001</span>
            )}
          </div>
        </Card>
      </SettingsSection>

      <SettingsSection
        title={t.settings.general.masterPasswordTitle}
        description="Криптографическая защита сессий через PBKDF2 (100 000 итераций SHA-256 с солью)"
      >
        <Card variant="default" className="p-6 space-y-5 rounded-2xl">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Input
                label={t.settings.general.currentPassword}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <Input
                label={t.settings.general.newPassword}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <Input
                label={t.settings.general.confirmPassword}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {passwordStatus && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                  passwordStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                }`}
              >
                {passwordStatus.type === 'success' ? <Check size={14} /> : <KeyRound size={14} />}
                <span>{passwordStatus.text}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={isChangingPassword}
                disabled={isChangingPassword || !currentPassword || !newPassword}
              >
                {t.settings.general.updatePasswordBtn}
              </Button>

              <Button
                variant="danger"
                size="sm"
                type="button"
                onClick={async () => {
                  try {
                    await api.logout();
                    window.location.reload();
                  } catch (e) {
                    console.error('Logout error:', e);
                  }
                }}
                icon={<LogOut size={13} />}
              >
                {t.settings.general.logoutLabel}
              </Button>
            </div>
          </form>
        </Card>
      </SettingsSection>
    </div>
  );
};