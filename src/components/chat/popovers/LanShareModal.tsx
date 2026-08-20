import React, { useState, useEffect } from 'react';
import { Wifi, Copy, Check, X, RefreshCw, Smartphone } from 'lucide-react';
import * as api from '../../../services/api';

interface LanShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanShareModal: React.FC<LanShareModalProps> = ({ isOpen, onClose }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const fetchUrls = async () => {
    setLoading(true);
    try {
      const res = await api.get_local_ips();
      setUrls(res.urls || []);
    } catch {
      setUrls(['https://192.168.4.24:5173', 'https://127.0.0.1:5173']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUrls();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bento-card p-5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl rounded-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--theme-border)] mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
              <Wifi size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--theme-text)]">Локальная сеть (LAN Share)</h3>
              <p className="text-[11px] text-[var(--theme-text-muted)] font-mono">Доступ к веб-IDE с других устройств</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* IP Addresses List */}
        <div className="space-y-2 mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] flex items-center justify-between">
            <span>Доступные адреса сети:</span>
            <button
              type="button"
              onClick={fetchUrls}
              disabled={loading}
              className="hover:text-[var(--theme-text)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              <span>Обновить</span>
            </button>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs font-mono text-[var(--theme-text-muted)] flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin text-[var(--theme-accent)]" />
              <span>Сканирование сетевых интерфейсов...</span>
            </div>
          ) : urls.length === 0 ? (
            <div className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text-muted)] text-center">
              Сетевые интерфейсы не обнаружены
            </div>
          ) : (
            urls.map((url) => (
              <div
                key={url}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/40 transition-all font-mono text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Smartphone size={15} className="text-[var(--theme-text-muted)] shrink-0" />
                  <span className="truncate text-[var(--theme-text)] font-semibold">{url}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(url)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--theme-accent)]/10 hover:bg-[var(--theme-accent)] text-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ml-2 shadow-sm"
                >
                  {copiedUrl === url ? (
                    <>
                      <Check size={12} />
                      <span>[OK]</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Копировать</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Info footer */}
        <div className="p-3 rounded-xl bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] font-mono flex items-start gap-2">
          <span className="text-[var(--theme-accent)] font-bold shrink-0">[LAN]</span>
          <span>Убедитесь, что мобильное устройство подключено к той же Wi-Fi сети. Порт 5173 открыт для входящих подключений.</span>
        </div>
      </div>
    </div>
  );
};
