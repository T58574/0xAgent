import React, { useState } from 'react';
import { useInstallPrompt, Platform } from '../hooks/useInstallPrompt';
import { Download, Share2, X, Smartphone, CheckCircle2, MoreVertical, PlusSquare, Monitor } from 'lucide-react';

/**
 * Universal "Add to Home Screen" & PWA banner.
 * - Triggers native browser prompt if available (HTTPS / localhost).
 * - Opens an interactive platform-tailored installation guide (iOS Safari, Android Chrome/Edge/Samsung, Desktop).
 * - Self-hides when already installed (standalone mode) or dismissed by user.
 */
export function InstallAppBanner() {
  const install = useInstallPrompt();
  const [guideOpen, setGuideOpen] = useState(false);

  // Hide if running in standalone PWA mode or user dismissed banner
  if (install.isStandalone || install.hasUserDismissed) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const handled = await install.install();
    if (!handled) {
      // Native prompt not supported or unavailable (e.g. iOS or LAN HTTP) -> Open visual guide
      setGuideOpen(true);
    }
  };

  const isIos = install.platform === 'ios';

  return (
    <>
      <div className="install-app-banner animate-fadeIn">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img
            src="/0xAgent-icon.jpg"
            alt="0xAgent App"
            className="shrink-0 w-10 h-10 rounded-xl object-cover border border-[var(--theme-border)] shadow-md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-[var(--theme-text)] leading-tight mb-0.5 truncate">
              0xAgent на экран «Домой»
            </p>
            <p className="text-[11px] sm:text-xs text-[var(--theme-text-muted)] leading-snug truncate">
              {isIos
                ? 'Быстрый запуск в 1 тап и полноэкранный режим'
                : 'Установите как приложение на рабочий стол'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 sm:px-4 h-9 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-xs font-semibold hover:bg-[var(--theme-accent-hover)] active:scale-95 transition-all cursor-pointer shadow-accent-glow"
          >
            <Download size={14} className="shrink-0" />
            <span>Установить</span>
          </button>

          <button
            type="button"
            onClick={install.dismiss}
            aria-label="Скрыть"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {guideOpen && (
        <InstallGuideOverlay
          platform={install.platform}
          onClose={() => setGuideOpen(false)}
          onDismissForever={() => {
            setGuideOpen(false);
            install.dismiss();
          }}
        />
      )}
    </>
  );
}

interface InstallGuideOverlayProps {
  platform: Platform;
  onClose: () => void;
  onDismissForever: () => void;
}

function InstallGuideOverlay({ platform, onClose, onDismissForever }: InstallGuideOverlayProps) {
  const isIos = platform === 'ios';
  const isAndroid = platform === 'android';

  const steps = isIos
    ? [
        {
          n: 1,
          title: 'Нажмите «Поделиться»',
          desc: 'Иконка со стрелкой вверх в нижней панели Safari',
          icon: <Share2 size={18} className="text-[var(--theme-text)]" />,
        },
        {
          n: 2,
          title: 'Выберите «На экран „Домой“»',
          desc: 'Прокрутите меню вниз и нажмите на пункт с плюсиком',
          icon: <PlusSquare size={18} className="text-[var(--theme-text)]" />,
        },
        {
          n: 3,
          title: 'Нажмите «Добавить»',
          desc: 'В правом верхнем углу для подтверждения установки',
          icon: <CheckCircle2 size={18} className="text-[var(--theme-text)]" />,
        },
      ]
    : isAndroid
    ? [
        {
          n: 1,
          title: 'Откройте меню браузера ⋮',
          desc: 'Нажмите на три точки в правом верхнем углу Chrome / Edge',
          icon: <MoreVertical size={18} className="text-[var(--theme-text)]" />,
        },
        {
          n: 2,
          title: '«Добавить на главный экран»',
          desc: 'Или пункт «Установить приложение 0xAgent»',
          icon: <Smartphone size={18} className="text-[var(--theme-text)]" />,
        },
        {
          n: 3,
          title: 'Подтвердите установку',
          desc: 'Иконка 0xAgent появится на рабочем столе смартфона',
          icon: <CheckCircle2 size={18} className="text-[var(--theme-text)]" />,
        },
      ]
    : [
        {
          n: 1,
          title: 'Иконка установки в строке URL',
          desc: 'Нажмите иконку ⊕ или «Установить» в правой части адресной строки',
          icon: <Monitor size={18} className="text-[var(--theme-text)]" />,
        },
        {
          n: 2,
          title: 'Подтвердите установку',
          desc: 'Приложение откроется в отдельном окне без рамок браузера',
          icon: <CheckCircle2 size={18} className="text-[var(--theme-text)]" />,
        },
      ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-panel-solid)] shadow-2xl overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 h-14 border-b border-[var(--theme-border-subtle)] bg-[var(--theme-card-bg)]">
          <div className="flex items-center gap-2.5">
            <img
              src="/0xAgent-icon.jpg"
              alt="0xAgent Logo"
              className="w-6 h-6 rounded-lg object-cover border border-[var(--theme-border)]"
            />
            <span className="text-sm font-bold text-[var(--theme-text)] tracking-wide">
              Установка 0xAgent
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body / Steps */}
        <div className="p-4 sm:p-5 space-y-3.5">
          <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
            {isIos
              ? 'Для добавления 0xAgent на домашний экран iOS выполните 3 простых шага в Safari:'
              : isAndroid
              ? 'Для запуска 0xAgent в полноэкранном режиме добавьте веб-приложение на рабочий стол:'
              : 'Для быстрой работы установите 0xAgent на рабочий стол вашего устройства:'}
          </p>

          <div className="space-y-2.5">
            {steps.map((step) => (
              <div
                key={step.n}
                className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)]"
              >
                <div className="shrink-0 w-8 h-8 rounded-xl bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 flex items-center justify-center text-[var(--theme-accent)] mt-0.5">
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[var(--theme-text)] leading-tight flex items-center gap-1.5">
                    <span className="text-[var(--theme-text-muted)] font-mono">0{step.n}.</span>
                    <span>{step.title}</span>
                  </div>
                  <div className="text-[11px] text-[var(--theme-text-muted)] leading-snug mt-0.5">
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center gap-2.5 p-4 sm:p-5 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] hover:bg-white/5 active:scale-98 transition-all cursor-pointer"
          >
            Понятно
          </button>
          <button
            type="button"
            onClick={onDismissForever}
            className="flex-1 h-10 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-xs font-bold hover:bg-[var(--theme-accent-hover)] active:scale-98 transition-all cursor-pointer shadow-accent-glow"
          >
            Больше не показывать
          </button>
        </div>
      </div>
    </div>
  );
}
