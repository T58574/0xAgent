import React, { useState, useEffect } from 'react';
import { Shield, Lock, KeyRound, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import * as api from '../services/api';

interface LockScreenProps {
  isPasswordSet: boolean;
  onAuthenticated: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ isPasswordSet, onAuthenticated }) => {
  const [mode, setMode] = useState<'setup' | 'login'>(isPasswordSet ? 'login' : 'setup');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Brute-force lockout state
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState(0);

  useEffect(() => {
    setMode(isPasswordSet ? 'login' : 'setup');
  }, [isPasswordSet]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLockedOut || lockoutRemainingSec <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemainingSec((prev) => {
        if (prev <= 1) {
          setIsLockedOut(false);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLockedOut, lockoutRemainingSec]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length < 4) {
      setErrorMsg('Пароль должен содержать не менее 4 символов');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Пароли не совпадают');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.setup_password(password.trim());
      if (res.success) {
        onAuthenticated();
      } else {
        setErrorMsg(res.error || 'Не удалось установить пароль');
      }
    } catch (err: any) {
      setErrorMsg(`Ошибка сети: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Введите мастер-пароль');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.login_password(password);
      if (res.success) {
        onAuthenticated();
      } else {
        if (res.locked && res.remainingSec) {
          setIsLockedOut(true);
          setLockoutRemainingSec(res.remainingSec);
        }
        setErrorMsg(res.error || 'Неверный мастер-пароль');
      }
    } catch (err: any) {
      setErrorMsg(`Ошибка сервера: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl font-sans text-slate-100 select-none px-4">
      {/* Sci-fi Glow Background Elements */}
      <div className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20 animate-pulse" />
      <div className="absolute w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20 animate-pulse" />

      {/* Main Lock Card */}
      <div className="w-full max-w-md glass-panel rounded-xl border border-white/15 p-6 md:p-8 shadow-2xl relative z-10 flex flex-col items-center">
        
        {/* Top Header Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
          {mode === 'setup' ? <KeyRound size={28} /> : <Lock size={28} />}
        </div>

        <h1 className="text-xl font-bold text-white tracking-wide text-center flex items-center gap-2">
          {mode === 'setup' ? 'Установка Мастер-Пароля' : '0xAgent Защищён'}
        </h1>

        <p className="text-xs text-slate-400 text-center mt-1.5 leading-relaxed max-w-sm">
          {mode === 'setup'
            ? 'Создайте мастер-пароль для защиты веб-интерфейса и WebSocket-каналов от сторонних устройств в локальной сети.'
            : 'Веб-интерфейс и API рабочей станции защищены. Введите мастер-пароль для продолжения.'}
        </p>

        {/* LAN Security Banner */}
        <div className="w-full my-4 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 flex items-center gap-2.5 text-xs text-slate-300">
          <Shield size={14} className="text-emerald-400 shrink-0" />
          <span>Защита локальной сети (LAN) и брутфорс-фильтр активны</span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="w-full mb-4 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2 animate-shake">
            <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* Brute-force Lockout Active Alert */}
        {isLockedOut && (
          <div className="w-full mb-4 px-3.5 py-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-amber-400" />
              <span>Заблокировано (брутфорс):</span>
            </div>
            <span className="font-mono font-bold text-amber-200">{lockoutRemainingSec} сек</span>
          </div>
        )}

        {/* Form Input Section */}
        {mode === 'setup' ? (
          <form onSubmit={handleSetup} className="w-full flex flex-col gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Новый Мастер-Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900/80 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Подтвердите Мастер-Пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900/80 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>Установить Пароль и Войти</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Мастер-Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль..."
                disabled={isLockedOut}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/80 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLockedOut}
              className="w-full mt-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              <span>Разблокировать Доступ</span>
              <ArrowRight size={15} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
