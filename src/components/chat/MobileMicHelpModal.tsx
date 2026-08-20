import React, { useState } from 'react';
import { MaterialIcon } from '../common/MaterialIcon';

interface MobileMicHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMicHelpModal: React.FC<MobileMicHelpModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const currentHost = window.location.hostname;
  const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  const httpsUrl = `https://${currentHost}:${currentPort}`;
  const insecureFlagOrigin = `${window.location.protocol}//${window.location.host}`;

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-lg rounded-3xl bg-[var(--theme-panel)]/95 border border-[var(--theme-border)] shadow-2xl p-5 sm:p-6 text-[var(--theme-text)] font-sans overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--theme-border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MaterialIcon name="mic_off" className="text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--theme-text)]">Активация микрофона на телефоне</h3>
              <p className="text-xs text-[var(--theme-text-muted)] font-mono">Безопасность браузера (W3C Secure Context)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
          >
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200">
            <span className="font-bold">Почему браузер не показал запрос?</span>
            <p className="mt-1 text-[11px] opacity-90">
              Мобильные браузеры (Safari на iOS и Chrome на Android) блокируют микрофон на обычных <strong>HTTP</strong>-адресах в Wi-Fi сети (<code>http://192.168.x.x</code>). Для доступа к микрофону требуется защищённый протокол или разрешение в браузере.
            </p>
          </div>

          <div className="space-y-3 font-sans">
            <div className="font-bold text-sm text-[var(--theme-text)]">Выберите удобный способ:</div>

            {/* Method 1: Chrome flags (Android / Yandex) - Most reliable for LAN HTTP */}
            <div className="p-3.5 rounded-2xl bg-[var(--theme-card-bg)] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[13px] text-cyan-400">Способ 1: Для Android (Chrome / Яндекс / Brave)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 font-mono">[Рекомендуется]</span>
              </div>
              <p className="text-[11px] text-[var(--theme-text-muted)]">
                Активирует микрофон по обычному HTTP без SSL-ошибок за 10 секунд:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-[var(--theme-text)]">
                <li>Откройте в новой вкладке телефона: <br /><code className="font-mono text-cyan-300 select-all break-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></li>
                <li>Вставьте в текстовое поле адрес вашего сервера:
                  <div className="flex items-center justify-between gap-2 mt-1 p-2 rounded-xl bg-black/40 border border-[var(--theme-border)] font-mono text-[11px]">
                    <span className="truncate text-amber-300 select-all">{insecureFlagOrigin}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(insecureFlagOrigin)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--theme-border-subtle)] hover:bg-[var(--theme-accent)] hover:text-black font-bold transition-colors shrink-0 cursor-pointer"
                    >
                      {copied ? 'Скопировано!' : 'Скопировать IP'}
                    </button>
                  </div>
                </li>
                <li>Переключите выпадающий список в <strong>Enabled</strong> и нажмите синюю кнопку <strong>Relaunch</strong> внизу.</li>
              </ol>
            </div>

            {/* Method 2: iPhone / Safari */}
            <div className="p-3.5 rounded-2xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[13px] text-emerald-400">Способ 2: Для iPhone / iPad (Safari)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-mono">iOS</span>
              </div>
              <p className="text-[11px] text-[var(--theme-text-muted)]">
                На iPhone Safari откройте 0xAgent через защищённый туннель или запустите сервер с SSL:
                <code>npm run dev:ssl</code> и перейдите на <span className="text-emerald-300 font-mono">{httpsUrl}</span> (приняв сертификат).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-[var(--theme-border)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-[var(--theme-accent)] text-black font-bold hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-[var(--theme-accent)]/20"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
