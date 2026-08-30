import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const widthStyles: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      {/* Overlay click catcher */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal dialog window */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${widthStyles[maxWidth]} rounded-3xl bento-card bg-[var(--theme-panel-solid)] border border-[var(--theme-border)] shadow-2xl overflow-hidden z-10 flex flex-col font-sans max-h-[90vh]`}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--theme-border)] flex items-center justify-between gap-3 bg-[var(--theme-card-bg)]">
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">{children}</div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-[var(--theme-border)] bg-[var(--theme-card-bg)] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
