import React, { useState, useEffect, useRef } from 'react';
import { LiveTelemetry } from '../../types';
import { extractThoughtSteps, ThoughtStep } from '../../utils/helpers';
import { MaterialIcon } from '../common/MaterialIcon';

interface ReasoningViewerProps {
  thinking: string;
  isLive?: boolean;
  thinkingSeconds?: number;
  liveTelemetry?: LiveTelemetry | null;
  defaultExpanded?: boolean;
}

const ASCII_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const ReasoningViewer: React.FC<ReasoningViewerProps> = ({
  thinking,
  isLive = false,
  thinkingSeconds = 0,
  liveTelemetry,
  defaultExpanded = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ASCII Spinner interval for live thinking HUD
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % ASCII_SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isLive]);

  // Auto-scroll to bottom of live stream if user keeps autoScroll on
  useEffect(() => {
    if (isLive && isOpen && autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking, isLive, isOpen, autoScroll]);

  // Extract structured steps or raw stream
  const steps: ThoughtStep[] = extractThoughtSteps(thinking);
  const wordCount = thinking.trim() ? thinking.trim().split(/\s+/).length : 0;

  // Extract dynamic last thought line for live ticker preview while collapsed
  const getLastThoughtSnippet = (raw: string): string => {
    if (!raw.trim()) {
      return isLive ? 'Инициализация контекста и генерация рассуждений...' : 'Ход мыслей модели';
    }
    const lines = raw.trim().split('\n').filter((l) => l.trim().length > 0);
    const lastLine = lines[lines.length - 1] || '';
    const clean = lastLine.replace(/^[-*#\d\.\)\s]+/, '').trim();
    return clean.length > 75 ? `${clean.substring(0, 72)}...` : clean;
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(thinking);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-2xl bento-card border border-[var(--theme-border)] overflow-hidden transition-all duration-200 shadow-md font-mono">
      {/* 1. COLLAPSIBLE HEADER BAR */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 bg-black/40 hover:bg-black/60 flex items-center justify-between gap-2.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer select-none transition-colors group"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* ASCII Live Spinner Generator */}
          <div className="shrink-0 flex items-center justify-center">
            {isLive ? (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 text-[var(--theme-accent)] font-bold text-xs">
                {ASCII_SPINNER_FRAMES[spinnerFrame]}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)] text-xs">
                ::
              </span>
            )}
          </div>

          {/* Title & Live Thought Snippet Ticker */}
          <div className="flex flex-col text-left min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-[var(--theme-text)]">
                {isLive ? 'ИИ-Агент рассуждает...' : 'Ход мыслей модели'}
              </span>

              {/* Status / Step Badges */}
              {!isLive && steps.length > 1 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/5 text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
                  {steps.length} этапа
                </span>
              )}

              {!isLive && wordCount > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/5 text-[var(--theme-text-muted)] border border-[var(--theme-border)] hidden sm:inline">
                  {wordCount} слов
                </span>
              )}
            </div>

            {/* Dynamic Live Thought Snippet (Visible when Collapsed) */}
            {!isOpen && (
              <span className="text-[11px] text-[var(--theme-text-muted)] opacity-85 truncate block pt-0.5">
                {isLive ? (
                  <span className="inline-flex items-center gap-1 text-[var(--theme-accent)]">
                    <span className="text-[10px] font-bold">›</span>
                    {getLastThoughtSnippet(thinking)}
                  </span>
                ) : (
                  getLastThoughtSnippet(thinking)
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right Info: Live Telemetry Metrics, Stopwatch & ASCII Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Speed (t/s) */}
          {liveTelemetry?.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 text-[10px] text-[var(--theme-accent)] font-semibold">
              <MaterialIcon name="bolt" size={11} />
              <span>{liveTelemetry.tokensPerSec.toFixed(1)} t/s</span>
            </span>
          )}

          {/* Live Token Count */}
          {liveTelemetry?.tokenCount !== undefined && liveTelemetry.tokenCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-[var(--theme-border)] text-[10px] text-[var(--theme-text)]">
              <MaterialIcon name="memory" size={11} className="text-[var(--theme-text-muted)]" />
              <span>{liveTelemetry.tokenCount} tok</span>
            </span>
          )}

          {/* Live Context Window */}
          {liveTelemetry?.contextUsed !== undefined && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-[var(--theme-border)] text-[10px] text-[var(--theme-text-muted)]">
              <MaterialIcon name="storage" size={11} />
              <span>{liveTelemetry.contextUsed.toLocaleString()}{liveTelemetry.contextMax ? ` / ${liveTelemetry.contextMax.toLocaleString()}` : ''}</span>
            </span>
          )}

          {/* Live Stopwatch Timer */}
          {(isLive || thinkingSeconds > 0) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 border border-[var(--theme-border)] text-[10px] text-[var(--theme-text-muted)]">
              <MaterialIcon name="schedule" size={11} />
              <span>{thinkingSeconds.toFixed(1)}s</span>
            </span>
          )}

          {/* ASCII Expand/Collapse Button */}
          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] text-[11px] font-bold transition-all">
            {isOpen ? '[-]' : '[+]'}
          </span>
        </div>
      </button>

      {/* 2. EXPANDED REASONING CANVAS */}
      {isOpen && (
        <div className="bg-black/30 border-t border-[var(--theme-border)] text-[var(--theme-text)] text-xs select-text transition-all duration-200">
          {/* Toolbar inside expanded view */}
          <div className="px-3.5 py-1.5 bg-black/20 border-b border-[var(--theme-border)]/50 flex items-center justify-between text-[11px] text-[var(--theme-text-muted)] select-none">
            <div className="flex items-center gap-2">
              <span className="text-[var(--theme-accent)] font-bold">›</span>
              <span className="font-medium text-[10.5px]">Chain-of-Thought Stream</span>
            </div>

            <div className="flex items-center gap-2">
              {isLive && (
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                    autoScroll
                      ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)]/40 text-[var(--theme-accent)]'
                      : 'bg-white/5 border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                  title="Автопрокрутка к новым рассуждениям"
                >
                  <span>{autoScroll ? '[SCROLL: ON]' : '[SCROLL: OFF]'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 transition-all cursor-pointer"
                title="Скопировать текст рассуждений"
              >
                <span>{copied ? '[COPIED!]' : '[COPY]'}</span>
              </button>
            </div>
          </div>

          {/* Structured Step Flow / Raw Stream Content */}
          <div
            ref={scrollRef}
            className="p-3.5 space-y-3 max-h-80 overflow-y-auto scrollbar-thin text-[11.5px] leading-relaxed text-[var(--theme-text-muted)]"
          >
            {thinking.trim() ? (
              steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className="p-2.5 rounded-xl bg-black/40 border border-[var(--theme-border)] space-y-1.5"
                >
                  {/* Step Header */}
                  <div className="flex items-center gap-2 text-[var(--theme-text)] font-semibold text-[11px]">
                    <span className="px-1.5 py-0.2 rounded bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 text-[var(--theme-accent)] text-[10px] font-bold">
                      [{step.stepNumber < 10 ? `0${step.stepNumber}` : step.stepNumber}]
                    </span>
                    <span>{step.title}</span>
                  </div>

                  {/* Step Body */}
                  {step.content && (
                    <div className="pl-6 text-[11px] text-[var(--theme-text-muted)] whitespace-pre-wrap leading-relaxed select-text">
                      {step.content}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 rounded-xl bg-black/40 border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] italic">
                {isLive ? '[ Ожидание входящего потока рассуждений... ]' : '[ Рассуждения отсутствуют ]'}
              </div>
            )}

            {/* Live blinking cursor during streaming */}
            {isLive && (
              <div className="flex items-center gap-2 pt-1 text-[var(--theme-accent)] text-xs">
                <span className="inline-block w-2 h-3.5 bg-[var(--theme-accent)] animate-pulse" />
                <span className="text-[10px] text-[var(--theme-text-muted)] italic">Генерация мыслей...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
