import React, { useState } from 'react';
import { Shield, KeyRound, Lock, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
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
        setStatusMsg({ type: 'success', text: 'Мастер-пароль успешно изменён! Сессия обновлена.' });
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
    <div className="w-full max-w-3xl flex flex-col gap-6 font-sans text-slate-100">
      
      {/* Header Banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl glass-panel border border-white/10">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Shield size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Защита Локальной Сети (LAN) и Сессий</h3>
          <p className="text-xs text-slate-400">Настройки доступа к веб-интерфейсу 0xAgent и рабочей станции PC.</p>
        </div>
      </div>

      {/* Security Status Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-lg glass-panel border border-white/10 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-white">PBKDF2 Хеширование</div>
            <div className="text-[11px] text-slate-400">100 000 итераций SHA-256 с уникальной солью</div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg glass-panel border border-white/10 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-white">Защита от Брутфорса</div>
            <div className="text-[11px] text-slate-400">Максимум 5 попыток, блокировка на 15 минут</div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg glass-panel border border-white/10 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-white">Авторизация WebSocket</div>
            <div className="text-[11px] text-slate-400">Канал обмена сообщениями с ПК защищён токеном</div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg glass-panel border border-white/10 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-white">Изоляция REST API</div>
            <div className="text-[11px] text-slate-400">Все конечные точки требуют Bearer токен</div>
          </div>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMsg && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Change Password Form */}
      <div className="p-5 rounded-xl glass-panel border border-white/10 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <KeyRound size={16} className="text-amber-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Смена Мастер-Пароля</h4>
        </div>

        <form onSubmit={handleChangePassword} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Текущий Мастер-Пароль</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Введите текущий пароль"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Новый Пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Подтвердите Новый Пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="self-start mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <Lock size={14} />
            <span>Сохранить Новый Пароль</span>
          </button>
        </form>
      </div>

      {/* Active Session Logout Box */}
      <div className="p-4 rounded-xl glass-panel border border-white/10 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-white">Выход из активной сессии</div>
          <div className="text-[11px] text-slate-400">Сбросить текущий токен авторизации в этом браузере.</div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <LogOut size={14} />
          <span>Заблокировать и Выйти</span>
        </button>
      </div>

    </div>
  );
};
