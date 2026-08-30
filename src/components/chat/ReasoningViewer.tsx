import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Brain, X, Copy, Check, ChevronRight } from 'lucide-react';
import { LiveTelemetry } from '../../types';
import { extractThoughtSteps, ThoughtStep } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface ReasoningViewerProps {
  thinking: string;
  isLive?: boolean;
  thinkingSeconds?: number;
  liveTelemetry?: LiveTelemetry | null;
  tokenCount?: number;
  defaultExpanded?: boolean;
}

const ASCII_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const ReasoningViewer: React.FC<ReasoningViewerProps> = React.memo(({
  thinking,
  isLive = false,
  thinkingSeconds = 0,
  liveTelemetry,
  tokenCount,
  defaultExpanded = false,
}) => {
  const { language, t } = useI18n();
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Live stopwatch and spinner interval
  useEffect(() => {
    if (!isLive) {
      setLiveSeconds(0);
      return;
    }
    const spinnerInterval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % ASCII_SPINNER_FRAMES.length);
    }, 100);
    const startTime = Date.now();
    const secInterval = setInterval(() => {
      setLiveSeconds((Date.now() - startTime) / 1000);
    }, 100);
    return () => {
      clearInterval(spinnerInterval);
      clearInterval(secInterval);
    };
  }, [isLive]);

  const displaySeconds = isLive ? liveSeconds : thinkingSeconds;

  // Auto-scroll when live thoughts stream
  useEffect(() => {
    if (isLive && isOpen && autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking, isLive, isOpen, autoScroll]);

  // Close when clicking outside panel
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const wordCount = useMemo(() => {
    if (!thinking.trim()) return 0;
    return thinking.trim().split(/\s+/).filter(Boolean).length;
  }, [thinking]);

  const estimatedTokens = useMemo(() => {
    if (tokenCount !== undefined && tokenCount > 0) return tokenCount;
    if (liveTelemetry?.tokenCount !== undefined && liveTelemetry.tokenCount > 0) return liveTelemetry.tokenCount;
    return wordCount > 0 ? Math.round(wordCount * 1.35) : 0;
  }, [tokenCount, liveTelemetry, wordCount]);

  const steps: ThoughtStep[] = useMemo(() => {
    if (!isOpen && !isLive) return [];
    if (!thinking.trim()) return [];
    return extractThoughtSteps(thinking);
  }, [thinking, isOpen, isLive]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(thinking);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative inline-block font-sans text-xs select-none">
      {/* 1. BACKGROUND-LESS COMPACT BUTTON AT BOTTOM-LEFT */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer border ${
          isOpen
            ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs'
            : 'bg-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border-transparent'
        }`}
        title={t.chat.reasoningTitle}
      >
        <Brain size={12} className={isLive ? 'text-[var(--theme-accent)] animate-pulse' : 'text-[var(--theme-text-muted)]'} />
        
        {isLive ? (
          <span className="flex items-center gap-1 text-[var(--theme-text)] font-semibold">
            <span>{ASCII_SPINNER_FRAMES[spinnerFrame]}</span>
            <span>{t.chat.reasoning}</span>
            <span className="opacity-70 font-mono">({displaySeconds.toFixed(1)}s)</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="font-semibold text-[var(--theme-text)]">{t.chat.reasoning}</span>
            <span className="text-[10px] text-[var(--theme-text-muted)] opacity-80">
              · {estimatedTokens > 0 ? `${estimatedTokens} tok · ` : ''}{wordCount} {language === 'ru' ? 'слов' : 'words'}{displaySeconds > 0 ? ` · ${displaySeconds.toFixed(1)}s` : ''}
            </span>
          </span>
        )}

        <ChevronRight size={11} className={`transition-transform duration-150 opacity-60 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* 2. INDEPENDENT SIDE FLYOUT PANEL */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed left-4 right-4 sm:left-auto sm:right-auto sm:absolute sm:bottom-full sm:left-0 mb-2 z-50 w-auto sm:w-[420px] max-w-[94vw] bg-[var(--theme-panel)] border border-[var(--theme-border)] rounded-2xl shadow-2xl overflow-hidden animate-fadeIn select-text font-mono"
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-[var(--theme-card-bg)] border-b border-[var(--theme-border)] flex items-center justify-between select-none">
            <div className="flex items-center gap-2 min-w-0">
              <Brain size={13} className="text-[var(--theme-text)] shrink-0" />
              <span className="font-bold text-xs text-[var(--theme-text)] truncate">
                {t.chat.reasoningTitle}
              </span>
              <span className="text-[10px] text-[var(--theme-text-muted)] font-mono shrink-0">
                ({wordCount} {language === 'ru' ? 'слов' : 'words'}{displaySeconds > 0 ? ` · ${displaySeconds.toFixed(1)}s` : ''})
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isLive && (
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                    autoScroll
                      ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)]'
                      : 'bg-transparent text-[var(--theme-text-muted)] border-[var(--theme-border)]'
                  }`}
                  title="Автопрокрутка"
                >
                  AUTO
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                title={t.chat.copyCode}
              >
                {copied ? <Check size={13} className="text-[var(--theme-text)]" /> : <Copy size={13} />}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                title={t.common.close}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Independent Scrollable Body */}
          <div
            ref={scrollRef}
            className="p-3.5 space-y-2.5 max-h-80 sm:max-h-96 overflow-y-auto scrollbar-thin text-xs text-[var(--theme-text)] leading-relaxed"
          >
            {isLive ? (
              thinking.trim() ? (
                <div className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] whitespace-pre-wrap leading-relaxed">
                  {thinking}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] italic flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)] animate-ping inline-block shrink-0" />
                  <span>[ {t.chat.promptPrefilling} ]</span>
                </div>
              )
            ) : thinking.trim() ? (
              steps.length > 1 ? (
                steps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-center gap-2 font-bold text-[11px] text-[var(--theme-text)]">
                      <span className="px-1.5 py-0.2 rounded bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[9px]">
                        {step.stepNumber < 10 ? `0${step.stepNumber}` : step.stepNumber}
                      </span>
                      <span>{step.title}</span>
                    </div>
                    {step.content && (
                      <div className="pl-4 text-[11px] text-[var(--theme-text)] whitespace-pre-wrap leading-relaxed opacity-90">
                        {step.content}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] whitespace-pre-wrap leading-relaxed text-[11.5px]">
                  {thinking}
                </div>
              )
            ) : (
              <div className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] italic">
                [ {t.chat.reasoning} ]
              </div>
            )}

            {isLive && (
              <div className="flex items-center gap-2 pt-1 text-[var(--theme-text)] text-xs">
                <span className="inline-block w-2 h-3.5 bg-[var(--theme-accent)] animate-pulse" />
                <span className="text-[10px] text-[var(--theme-text-muted)] italic font-semibold">
                  {thinking.trim() ? t.chat.thinking : t.chat.promptPrefilling}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

ReasoningViewer.displayName = 'ReasoningViewer';
