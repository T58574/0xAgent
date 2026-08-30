import React, { useState } from 'react';
import { Shield, KeyRound, LogOut, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { SettingsHeader, SettingsSection } from './common';

export const SecurityTab: React.FC = () => {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!currentPassword) {
      setStatusMsg({ type: 'error', text: t.settings.general.enterCurrentPassword });
      return;
    }
    if (newPassword.trim().length < 4) {
      setStatusMsg({ type: 'error', text: t.settings.general.passwordMinLength });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: t.settings.general.passwordMismatch });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.change_password(currentPassword, newPassword.trim());
      if (res.success) {
        setStatusMsg({ type: 'success', text: t.settings.general.passwordSuccess });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatusMsg({ type: 'error', text: res.error || t.settings.general.passwordError });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `${t.common.error}: ${err.message || err}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.reload();
  };

  return (
    <div className="w-full space-y-6 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header */}
      <SettingsHeader
        title={t.settings.security.title}
        subtitle={t.settings.security.subtitle}
        icon={<Shield size={18} />}
      />

      {/* 2. Security Status Badges */}
      <SettingsSection
        title="Статус безопасности"
        badge="Zero-Trust Architecture"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              title: t.settings.security.pbkdf2Title,
              desc: t.settings.security.pbkdf2Desc,
              badge: 'PBKDF2-SHA512',
            },
            {
              title: t.settings.security.bruteForceTitle,
              desc: t.settings.security.bruteForceDesc,
              badge: 'Active Guard',
            },
            {
              title: t.settings.security.wsTitle,
              desc: t.settings.security.wsDesc,
              badge: 'WSS / Bearer',
            },
            {
              title: t.settings.security.apiTitle,
              desc: t.settings.security.apiDesc,
              badge: 'Local Session',
            },
          ].map((item, idx) => (
            <Card
              key={idx}
              variant="default"
              padded={false}
              className="p-4 flex items-start gap-3"
            >
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 size={15} />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-xs font-bold text-[var(--theme-text)]">{item.title}</span>
                  <Badge variant="success" size="xs">
                    {item.badge}
                  </Badge>
                </div>
                <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </SettingsSection>

      {/* 3. Password Change Form */}
      <SettingsSection
        title={t.settings.security.changePasswordTitle}
        badge="Access Credentials"
      >
        <Card variant="default" className="space-y-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 size={14} className="shrink-0" />
              ) : (
                <AlertTriangle size={14} className="shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label={t.settings.security.currentPasswordLabel}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              prefixIcon={<Lock size={13} />}
              required
              mono
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Input
                label={t.settings.security.newPasswordLabel}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                prefixIcon={<KeyRound size={13} />}
                required
                mono
              />

              <Input
                label={t.settings.security.confirmPasswordLabel}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                prefixIcon={<KeyRound size={13} />}
                required
                mono
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="secondary"
                size="md"
                disabled={isSubmitting}
                loading={isSubmitting}
                icon={<KeyRound size={13} />}
              >
                {isSubmitting ? t.settings.saving : t.settings.security.updatePasswordBtn}
              </Button>
            </div>
          </form>
        </Card>
      </SettingsSection>

      {/* 4. Active Session & Logout */}
      <SettingsSection title={t.settings.security.logoutTitle}>
        <Card variant="default" className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[var(--theme-text)]">
              {t.settings.security.logoutTitle}
            </div>
            <p className="text-xs text-[var(--theme-text-muted)]">
              {t.settings.security.logoutDesc}
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={handleLogout}
            icon={<LogOut size={13} />}
          >
            {t.settings.security.logoutBtn}
          </Button>
        </Card>
      </SettingsSection>
    </div>
  );
};
