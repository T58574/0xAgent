import React, { useState, useEffect } from 'react';
import { MaterialIcon } from './common/MaterialIcon';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl font-sans text-[var(--theme-text)] select-none px-4">
      {/* Centered OLED Glassmorphism Card */}
      <div className="w-full max-w-sm rounded-2xl bg-[var(--theme-panel)]/95 border border-[var(--theme-border)] shadow-2xl p-6 md:p-7 relative z-10 flex flex-col items-center backdrop-blur-2xl">
        
        {/* Top Header Icon */}
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-text)] mb-4 shadow-sm">
          <MaterialIcon name={mode === 'setup' ? 'vpn_key' : 'lock'} size={22} />
        </div>

        {/* Header Title & ASCII Tag */}
        <div className="text-center space-y-1">
          <div className="text-[10px] font-mono tracking-widest text-[var(--theme-text-muted)] uppercase">
            :: [SECURITY_GATEWAY]
          </div>
          <h1 className="text-sm font-mono font-bold text-[var(--theme-text)] tracking-wider uppercase">
            {mode === 'setup' ? 'Мастер-Пароль' : 'Вход в 0xAgent'}
          </h1>
          <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed pt-1">
            {mode === 'setup'
              ? 'Создайте пароль для защиты локального API и WebSocket каналов.'
              : 'Введите мастер-пароль для авторизации рабочей станции.'}
          </p>
        </div>

        {/* Sub-card: LAN & Rate Limit Badge */}
        <div className="w-full my-4 px-3 py-2 rounded-xl bg-black/40 border border-[var(--theme-border)] flex items-center justify-between text-[11px] font-mono text-[var(--theme-text-muted)]">
          <div className="flex items-center gap-1.5">
            <MaterialIcon name="shield" size={13} className="text-emerald-400" />
            <span>LAN_SHIELD</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            [ACTIVE]
          </span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="w-full mb-3.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-center gap-2 animate-in fade-in duration-150">
            <span className="text-[10px] font-bold shrink-0">[ERR]</span>
            <span className="leading-tight flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Brute-force Lockout Alert */}
        {isLockedOut && (
          <div className="w-full mb-3.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300 flex items-center justify-between">
            <span className="text-[10px]">[LOCKOUT]</span>
            <span className="font-bold">{lockoutRemainingSec} сек</span>
          </div>
        )}

        {/* Form Inputs */}
        {mode === 'setup' ? (
          <form onSubmit={handleSetup} className="w-full flex flex-col gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                Новый пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-white/40 focus:outline-none transition-colors"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                Повторите пароль
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-white/40 focus:outline-none transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] border border-[var(--theme-border)] text-xs font-mono font-semibold tracking-wider text-[var(--theme-text)] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <MaterialIcon name="check" size={15} />
              <span>[УСТАНОВИТЬ И ВОЙТИ]</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                Мастер-пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLockedOut}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-white/40 focus:outline-none transition-colors disabled:opacity-50"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLockedOut}
              className="w-full mt-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] border border-[var(--theme-border)] text-xs font-mono font-semibold tracking-wider text-[var(--theme-text)] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>[РАЗБЛОКИРОВАТЬ]</span>
              <MaterialIcon name="arrow_forward" size={15} />
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-[var(--theme-border)]/40 w-full text-center">
          <span className="text-[10px] font-mono text-[var(--theme-text-muted)]/70">
            0xAgent Local Server :: 127.0.0.1
          </span>
        </div>
      </div>
    </div>
  );
};
