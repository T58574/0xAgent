import React, { useState, useEffect } from 'react';
import { AsciiCanvasEngine } from './common/AsciiCanvasEngine';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black font-mono text-[var(--theme-text)] select-none px-4">
      <div className="w-full max-w-sm flex flex-col items-center space-y-6">
        
        {/* Interactive 0xAgent ASCII Wave Logo */}
        <div className="flex flex-col items-center justify-center select-none pointer-events-auto">
          <AsciiCanvasEngine
            effect="hero_wave"
            fps={60}
            color="platinum"
            fontSize={10}
            interactive
          />
        </div>

        {/* Security Gateway Badge */}
        <div className="text-[11px] font-mono tracking-widest text-[var(--theme-text-muted)] uppercase text-center">
          :: [SECURITY_GATEWAY]
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="w-full px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-400 text-center">
            [ERR]: {errorMsg}
          </div>
        )}

        {/* Brute-force Lockout Alert */}
        {isLockedOut && (
          <div className="w-full px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-400 text-center">
            [LOCKED]: {lockoutRemainingSec}s
          </div>
        )}

        {/* Minimal Monospace Form */}
        {mode === 'setup' ? (
          <form onSubmit={handleSetup} className="w-full flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новый мастер-пароль"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition-colors"
              autoFocus
              required
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition-colors"
              required
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-[0.99] border border-white/15 text-xs font-mono font-medium tracking-wider text-white transition-all cursor-pointer disabled:opacity-40"
            >
              [Установить пароль]
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Мастер-пароль"
              disabled={isLockedOut}
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition-colors disabled:opacity-40"
              autoFocus
              required
            />

            <button
              type="submit"
              disabled={isSubmitting || isLockedOut}
              className="w-full mt-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-[0.99] border border-white/15 text-xs font-mono font-medium tracking-wider text-white transition-all cursor-pointer disabled:opacity-40"
            >
              [Войти]
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
