import React, { useState, useRef, useEffect } from 'react';
import { Layers, Database, MessageSquare, ShieldCheck, Cpu } from 'lucide-react';
import { LiveTelemetry, MessageMetrics, AppConfig } from '../../types';
import { useI18n } from '../../i18n';

interface ContextBudgetGaugeProps {
  liveTelemetry?: LiveTelemetry | null;
  lastMessageMetrics?: MessageMetrics | null;
  config?: AppConfig | null;
}

export const ContextBudgetGauge: React.FC<ContextBudgetGaugeProps> = React.memo(({
  liveTelemetry,
  lastMessageMetrics,
  config,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const maxTokens =
    liveTelemetry?.contextMax ||
    lastMessageMetrics?.contextMax ||
    config?.local_server?.ctx_size ||
    32768;

  const usedTokens =
    liveTelemetry?.contextUsed ||
    lastMessageMetrics?.contextUsed ||
    lastMessageMetrics?.totalTokens ||
    0;

  const pct = Math.min(100, Math.max(0, Math.round((usedTokens / maxTokens) * 100)));

  // Estimate breakdown categories if not explicitly supplied
  const breakdown = liveTelemetry?.contextBreakdown || lastMessageMetrics?.contextBreakdown;
  const systemTokens = breakdown?.systemTokens ?? Math.min(usedTokens, 750);
  const memoryTokens = breakdown?.memoryTokens ?? Math.min(Math.max(0, usedTokens - systemTokens), 450);
  const historyTokens = breakdown?.historyTokens ?? Math.max(0, usedTokens - systemTokens - memoryTokens);
  const freeTokens = Math.max(0, maxTokens - usedTokens);
  const compactionTier = breakdown?.compactionTier ?? (pct > 85 ? 2 : pct > 70 ? 1 : 0);

  const getTierLabel = (tier: number) => {
    switch (tier) {
      case 1:
        return 'L1 (Pruned Tools)';
      case 2:
        return 'L2 (Summarized CoT)';
      case 3:
        return 'L3 (Emergency Compaction)';
      default:
        return 'L0 (Raw / High Fidelity)';
    }
  };

  const getBarColor = (percentage: number) => {
    if (percentage > 85) return 'bg-rose-500 shadow-glow-rose';
    if (percentage > 65) return 'bg-amber-400 shadow-glow-amber';
    return 'bg-emerald-400 shadow-glow-emerald';
  };

  const formatK = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return String(tokens);
  };

  return (
    <div className="relative inline-flex items-center" ref={popoverRef}>
      {/* Gauge Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] transition-all text-xs font-mono select-none cursor-pointer shadow-sm"
        title={t.chat.contextBudget}
      >
        <Layers className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
        <span className="text-[var(--theme-text)] text-[11px] font-semibold">
          {formatK(usedTokens)} / {formatK(maxTokens)}
        </span>
        <div className="w-12 h-1.5 rounded-full bg-[var(--theme-panel)] overflow-hidden border border-[var(--theme-border)]">
          <div
            className={`h-full transition-all duration-300 ${getBarColor(pct)}`}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
        <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
          {pct}%
        </span>
      </button>

      {/* Breakdown Hover / Click Popover */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-72 max-w-[calc(100vw-32px)] p-3.5 rounded-2xl bg-[var(--theme-panel)]/95 backdrop-blur-2xl border border-[var(--theme-border)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-xs font-mono space-y-2.5 text-[var(--theme-text)]"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
            <span className="font-bold text-[var(--theme-text)] tracking-wide flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              {t.chat.contextBreakdownTitle}
            </span>
            <span className="text-[10px] text-[var(--theme-text-muted)]">
              {pct}% used
            </span>
          </div>

          {/* Breakdown Items */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-cyan-400" />
                {t.chat.contextSystem}
              </span>
              <span className="text-[var(--theme-text)] font-semibold">{systemTokens} tok</span>
            </div>

            <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-emerald-400" />
                {t.chat.contextHistory}
              </span>
              <span className="text-[var(--theme-text)] font-semibold">{historyTokens} tok</span>
            </div>

            <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-violet-400" />
                {t.chat.contextMemory}
              </span>
              <span className="text-[var(--theme-text)] font-semibold">{memoryTokens} tok</span>
            </div>

            <div className="flex items-center justify-between text-[var(--theme-text-muted)] border-t border-[var(--theme-border)] pt-1.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-[var(--theme-text-muted)]" />
                {t.chat.contextFree}
              </span>
              <span className="text-[var(--theme-text)] font-semibold">{freeTokens} tok</span>
            </div>
          </div>

          {/* Compaction Tier Footer */}
          <div className="pt-2 border-t border-[var(--theme-border)] flex items-center justify-between text-[10px]">
            <span className="text-[var(--theme-text-muted)]">{t.chat.contextCompaction}:</span>
            <span className="text-[var(--theme-accent)] font-semibold bg-[var(--theme-card-bg)] px-2 py-0.5 rounded-md border border-[var(--theme-border)]">
              {getTierLabel(compactionTier)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

ContextBudgetGauge.displayName = 'ContextBudgetGauge';
