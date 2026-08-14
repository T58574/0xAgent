import React, { useState } from 'react';
import { Shield, KeyRound, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as api from '../../services/api';

export const SecurityTab: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!currentPassword) {
      setStatusMsg({ type: 'error', text: 'Укажите текущий пароль' });
      return;
    }
    if (newPassword.trim().length < 4) {
      setStatusMsg({ type: 'error', text: 'Новый пароль должен содержать минимум 4 символа' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'Новые пароли не совпадают' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.change_password(currentPassword, newPassword.trim());
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Мастер-пароль успешно изменён!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Не удалось изменить пароль' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Ошибка: ${err.message || err}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.reload();
  };

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4 font-sans text-[var(--theme-text)]">
      
      {/* Header Banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl bento-card">
        <div className="w-9 h-9 rounded-lg bg-white/5 border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-text-muted)]">
          <Shield size={18} />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[var(--theme-text)]">Защита LAN и авторизация</h3>
          <p className="text-xs text-[var(--theme-text-muted)]">Безопасность доступа к веб-интерфейсу 0xAgent.</p>
        </div>
      </div>

      {/* Security Status Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="p-3 rounded-lg bento-card flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-[var(--theme-text-muted)] shrink-0" />
          <div>
            <div className="text-xs font-medium text-[var(--theme-text)]">PBKDF2 Хеширование</div>
            <div className="text-[11px] text-[var(--theme-text-muted)]">100 000 итераций SHA-256</div>
          </div>
        </div>

        <div className="p-3 rounded-lg bento-card flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-[var(--theme-text-muted)] shrink-0" />
          <div>
            <div className="text-xs font-medium text-[var(--theme-text)]">Защита от брутфорса</div>
            <div className="text-[11px] text-[var(--theme-text-muted)]">Ограничение попыток ввода</div>
          </div>
        </div>

        <div className="p-3 rounded-lg bento-card flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-[var(--theme-text-muted)] shrink-0" />
          <div>
            <div className="text-xs font-medium text-[var(--theme-text)]">Авторизация WebSocket</div>
            <div className="text-[11px] text-[var(--theme-text-muted)]">Канал обмена данными защищён</div>
          </div>
        </div>

        <div className="p-3 rounded-lg bento-card flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-[var(--theme-text-muted)] shrink-0" />
          <div>
            <div className="text-xs font-medium text-[var(--theme-text)]">Изоляция REST API</div>
            <div className="text-[11px] text-[var(--theme-text-muted)]">Bearer токен аутентификация</div>
          </div>
        </div>
      </div>

      {/* Password Change Form */}
      <div className="p-4 rounded-xl bento-card flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-2 text-xs font-medium text-[var(--theme-text)]">
          <KeyRound size={14} className="text-[var(--theme-text-muted)]" />
          <span>Смена мастер-пароля</span>
        </div>

        {statusMsg && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-white/10 border-[var(--theme-border)] text-[var(--theme-text)]'
                : 'bg-white/5 border-rose-500/40 text-rose-300'
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

        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--theme-text-muted)]">Текущий пароль</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--theme-text-muted)]">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--theme-text-muted)]">Повторите новый пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Сохранение...' : 'Обновить пароль'}
            </button>
          </div>
        </form>
      </div>

      {/* Logout Session */}
      <div className="p-4 rounded-xl bento-card flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-[var(--theme-text)]">Завершить сеанс</div>
          <div className="text-[11px] text-[var(--theme-text-muted)]">Сброс токена авторизации в браузере</div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <LogOut size={13} />
          <span>Выйти</span>
        </button>
      </div>

    </div>
  );
};
