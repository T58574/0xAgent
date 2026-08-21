import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveTelemetry } from '../../types';
import { extractThoughtSteps, ThoughtStep } from '../../utils/helpers';
import { MaterialIcon } from '../common/MaterialIcon';
import { useI18n } from '../../i18n';

interface ReasoningViewerProps {
  thinking: string;
  isLive?: boolean;
  thinkingSeconds?: number;
  liveTelemetry?: LiveTelemetry | null;
  defaultExpanded?: boolean;
}

const ASCII_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const ReasoningViewer: React.FC<ReasoningViewerProps> = React.memo(({
  thinking,
  isLive = false,
  thinkingSeconds = 0,
  liveTelemetry,
  defaultExpanded = false,
}) => {
  const { language, t } = useI18n();
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ASCII Spinner interval for live thinking HUD only
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % ASCII_SPINNER_FRAMES.length);
    }, 100);
    return () => clearInterval(interval);
  }, [isLive]);

  // Auto-scroll to bottom of live stream if user keeps autoScroll on
  useEffect(() => {
    if (isLive && isOpen && autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking, isLive, isOpen, autoScroll]);

  // Extract dynamic last thought line for live ticker preview while collapsed (memoized)
  const lastThoughtSnippet = useMemo(() => {
    if (!thinking || !thinking.trim()) {
      return isLive ? t.chat.thinking : t.chat.reasoningTitle;
    }
    const lines = thinking.trim().split('\n');
    const lastLine = lines[lines.length - 1] || '';
    const clean = lastLine.replace(/^[-*#\d\.\)\s]+/, '').trim();
    return clean.length > 75 ? `${clean.substring(0, 72)}...` : (clean || t.chat.thinking);
  }, [thinking, isLive, t]);

  // Extract structured steps lazily only when expanded or when short
  const steps: ThoughtStep[] = useMemo(() => {
    if (!isOpen && !isLive) return [];
    if (!thinking.trim()) return [];
    return extractThoughtSteps(thinking);
  }, [thinking, isOpen, isLive]);

  const wordCount = useMemo(() => {
    if (!thinking.trim()) return 0;
    return thinking.trim().split(/\s+/).length;
  }, [thinking]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(thinking);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-2xl bento-card border border-[var(--theme-border)] overflow-hidden transition-all duration-200 shadow-sm font-mono">
      {/* 1. COLLAPSIBLE HEADER BAR */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] flex items-center justify-between gap-2.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer select-none transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* ASCII Live Spinner Generator */}
          <div className="shrink-0 flex items-center justify-center">
            {isLive ? (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 text-[var(--theme-accent)] font-bold text-xs">
                {ASCII_SPINNER_FRAMES[spinnerFrame]}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold">
                ::
              </span>
            )}
          </div>

          {/* Title & Live Thought Snippet Ticker */}
          <div className="flex flex-col text-left min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-[var(--theme-text)]">
                {isLive ? t.chat.thinking : t.chat.reasoningTitle}
              </span>

              {/* Status / Step Badges */}
              {!isLive && steps.length > 1 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] bg-[var(--theme-border-subtle)] text-[var(--theme-text)] border border-[var(--theme-border)] font-semibold">
                  {steps.length} {language === 'ru' ? 'этапа' : 'steps'}
                </span>
              )}

              {!isLive && wordCount > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] hidden sm:inline">
                  {wordCount} {language === 'ru' ? 'слов' : 'words'}
                </span>
              )}
            </div>

            {/* Dynamic Live Thought Snippet (Visible when Collapsed) */}
            {!isOpen && (
              <span className="text-[11px] text-[var(--theme-text-muted)] truncate block pt-0.5">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--theme-text)] font-medium">
                    <span className="text-[10px] font-bold text-sky-500">›</span>
                    {lastThoughtSnippet}
                  </span>
                ) : (
                  lastThoughtSnippet
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right Info: Live Telemetry Metrics, Stopwatch & ASCII Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Speed (t/s) */}
          {liveTelemetry?.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-[10px] text-sky-600 dark:text-sky-300 font-bold">
              <MaterialIcon name="bolt" size={12} />
              <span>{liveTelemetry.tokensPerSec.toFixed(1)} {t.chat.speed}</span>
            </span>
          )}

          {/* Live Token Count */}
          {liveTelemetry?.tokenCount !== undefined && liveTelemetry.tokenCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[10px] text-[var(--theme-text)] font-semibold">
              <MaterialIcon name="memory" size={12} className="text-[var(--theme-text-muted)]" />
              <span>{liveTelemetry.tokenCount} {t.chat.tokens}</span>
            </span>
          )}

          {/* Live Context Window */}
          {liveTelemetry?.contextUsed !== undefined && (
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[10px] text-[var(--theme-text-muted)]">
              <MaterialIcon name="storage" size={12} />
              <span>{liveTelemetry.contextUsed.toLocaleString()}{liveTelemetry.contextMax ? ` / ${liveTelemetry.contextMax.toLocaleString()}` : ''}</span>
            </span>
          )}

          {/* Live Stopwatch Timer */}
          {(isLive || thinkingSeconds > 0) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[10px] text-[var(--theme-text)] font-bold">
              <MaterialIcon name="schedule" size={12} />
              <span>{thinkingSeconds.toFixed(1)}{t.chat.seconds}</span>
            </span>
          )}

          {/* ASCII Expand/Collapse Button */}
          <span className="px-2 py-0.5 rounded-lg bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] group-hover:bg-[var(--theme-accent)] group-hover:text-[var(--theme-accent-text)] text-[11px] font-bold transition-all">
            {isOpen ? '[-]' : '[+]'}
          </span>
        </div>
      </button>

      {/* 2. EXPANDED REASONING CANVAS */}
      {isOpen && (
        <div className="bg-[var(--theme-input-bg)] border-t border-[var(--theme-border)] text-[var(--theme-text)] text-xs select-text transition-all duration-200">
          {/* Toolbar inside expanded view */}
          <div className="px-4 py-2 bg-[var(--theme-card-bg)] border-b border-[var(--theme-border)] flex items-center justify-between text-[11px] text-[var(--theme-text-muted)] select-none">
            <div className="flex items-center gap-2">
              <span className="text-sky-500 font-bold">›</span>
              <span className="font-bold text-[11px] text-[var(--theme-text)]">{t.chat.reasoningTitle}</span>
            </div>

            <div className="flex items-center gap-2">
              {isLive && (
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
                    autoScroll
                      ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-sm'
                      : 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                  title={autoScroll ? '[SCROLL: ON]' : '[SCROLL: OFF]'}
                >
                  <span>{autoScroll ? '[SCROLL: ON]' : '[SCROLL: OFF]'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-all cursor-pointer shadow-sm"
                title={t.chat.copyCode}
              >
                <span>{copied ? `[${t.chat.copied.toUpperCase()}]` : `[${t.common.copy.toUpperCase()}]`}</span>
              </button>
            </div>
          </div>

          {/* Structured Step Flow / Raw Stream Content */}
          <div
            ref={scrollRef}
            className="p-4 space-y-3 max-h-80 overflow-y-auto scrollbar-thin text-[11.5px] leading-relaxed text-[var(--theme-text)]"
          >
            {thinking.trim() ? (
              steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className="p-3.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] space-y-2 shadow-sm"
                >
                  {/* Step Header */}
                  <div className="flex items-center gap-2 text-[var(--theme-text)] font-bold text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] text-[10px] font-bold">
                      [{step.stepNumber < 10 ? `0${step.stepNumber}` : step.stepNumber}]
                    </span>
                    <span>{step.title}</span>
                  </div>

                  {/* Step Body */}
                  {step.content && (
                    <div className="pl-6 text-[11px] text-[var(--theme-text)] whitespace-pre-wrap leading-relaxed select-text font-mono">
                      {step.content}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] italic">
                {isLive ? `[ ${t.chat.thinking} ]` : `[ ${t.chat.reasoning} ]`}
              </div>
            )}

            {/* Live blinking cursor during streaming */}
            {isLive && (
              <div className="flex items-center gap-2 pt-1 text-[var(--theme-text)] text-xs">
                <span className="inline-block w-2 h-3.5 bg-[var(--theme-accent)] animate-pulse" />
                <span className="text-[10px] text-[var(--theme-text-muted)] italic font-semibold">{t.chat.thinking}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
