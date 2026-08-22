import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    }
  }, [removeToast]);

  // Clean up any remaining timers on unmount
  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Floating Toasts Container */}
      <div
        role="status"
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 font-mono"
      >
        {toasts.map((toast) => {
          let badgeText = '[INFO]';
          let badgeClass = 'text-[var(--theme-text-muted)] bg-white/5 border-[var(--theme-border)]';
          let cardBorder = 'border-[var(--theme-border)]';

          if (toast.type === 'success') {
            badgeText = '[OK]';
            badgeClass = 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/15 border-[var(--theme-accent)]/30 font-bold';
            cardBorder = 'border-[var(--theme-accent)]/40 shadow-[0_0_16px_var(--theme-accent-glow)]';
          } else if (toast.type === 'error') {
            badgeText = '[! ERR]';
            badgeClass = 'text-red-400 bg-red-500/15 border-red-500/30 font-bold';
            cardBorder = 'border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.2)]';
          } else if (toast.type === 'warning') {
            badgeText = '[WARN]';
            badgeClass = 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-bold';
            cardBorder = 'border-amber-500/40';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border ${cardBorder} bg-[var(--theme-panel-solid,#0a0c12)]/95 text-[var(--theme-text)] shadow-2xl backdrop-blur-2xl transition-all duration-300 animate-slideInRight font-mono`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] border shrink-0 ${badgeClass}`}>
                  {badgeText}
                </span>
                <span className="text-xs font-medium leading-tight break-words text-[var(--theme-text)] font-sans">
                  {toast.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] shrink-0 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-[11px] font-bold cursor-pointer"
                title="Закрыть"
              >
                [x]
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
