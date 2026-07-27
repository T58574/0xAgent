import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

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

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Floating Toasts Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slideInRight ${
              toast.type === 'success'
                ? 'bg-slate-900/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950/40'
                : toast.type === 'error'
                ? 'bg-slate-900/90 border-rose-500/50 text-rose-200 shadow-rose-950/40'
                : 'bg-slate-900/90 border-sky-500/50 text-sky-200 shadow-sky-950/40'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {toast.type === 'success' && <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />}
              {toast.type === 'error' && <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info size={18} className="text-sky-400 shrink-0 mt-0.5" />}
              <span className="text-xs font-sans font-medium leading-relaxed break-words">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white shrink-0 p-0.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
