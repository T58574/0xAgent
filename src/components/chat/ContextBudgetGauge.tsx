import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Layers, Database, MessageSquare, ShieldCheck, Cpu, AlertTriangle } from 'lucide-react';
import { LiveTelemetry, MessageMetrics, AppConfig, ChatSession, QuotaStatus } from '../../types';
import { useI18n } from '../../i18n';

interface ContextBudgetGaugeProps {
  liveTelemetry?: LiveTelemetry | null;
  lastMessageMetrics?: MessageMetrics | null;
  currentSession?: ChatSession | null;
  config?: AppConfig | null;
  quotaStatus?: QuotaStatus | null;
}

export const ContextBudgetGauge: React.FC<ContextBudgetGaugeProps> = React.memo(({
  liveTelemetry,
  lastMessageMetrics,
  currentSession,
  config,
  quotaStatus,
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

  const messages = currentSession?.messages || [];

  // Find last assistant message with saved metrics in session history
  const lastAssistantMsgWithMetrics = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].metrics) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const activeModelName =
    liveTelemetry?.modelName ||
    lastMessageMetrics?.modelName ||
    lastAssistantMsgWithMetrics?.metrics?.modelName ||
    config?.model_name ||
    '';

  const isGemini = activeModelName.toLowerCase().includes('gemini');
  const isClaude = activeModelName.toLowerCase().includes('claude');
  const isGpt = /gpt|o1|o3/i.test(activeModelName);

  const resolvedModelMax = isGemini ? 1048576 : isClaude ? 200000 : isGpt ? 128000 : null;

  const maxTokens =
    liveTelemetry?.contextMax ||
    lastMessageMetrics?.contextMax ||
    resolvedModelMax ||
    config?.local_server?.ctx_size ||
    config?.max_tokens ||
    32768;

  // Calculate genuine estimated tokens from conversation messages
  const dialogueTokens = useMemo(() => {
    if (messages.length === 0) return 0;
    let totalChars = 0;
    messages.forEach((m) => {
      totalChars += (m.content || '').length;
      if (m.tool_calls) {
        m.tool_calls.forEach((tc) => {
          totalChars += typeof tc.arguments === 'string' ? tc.arguments.length : JSON.stringify(tc.arguments || {}).length;
          totalChars += (tc.output || tc.result || '').length;
        });
      }
    });
    return Math.max(1, Math.round(totalChars / 3.5));
  }, [messages]);

  const sessionMetrics = lastMessageMetrics || lastAssistantMsgWithMetrics?.metrics;

  const usedTokens = useMemo(() => {
    if (liveTelemetry && typeof liveTelemetry.contextUsed === 'number' && liveTelemetry.contextUsed > 0) {
      return liveTelemetry.contextUsed;
    }
    if (sessionMetrics && typeof sessionMetrics.contextUsed === 'number' && sessionMetrics.contextUsed > 0) {
      return sessionMetrics.contextUsed;
    }
    if (sessionMetrics && typeof sessionMetrics.totalTokens === 'number' && sessionMetrics.totalTokens > 0) {
      return sessionMetrics.totalTokens;
    }
    return dialogueTokens;
  }, [liveTelemetry?.contextUsed, sessionMetrics, dialogueTokens]);

  const pct = maxTokens > 0 ? Math.min(100, Math.max(0, Math.round((usedTokens / maxTokens) * 100))) : 0;

  // Genuine token breakdown from backend metadata (zero hardcoded dummy values)
  const breakdown = liveTelemetry?.contextBreakdown || sessionMetrics?.contextBreakdown;
  const systemTokens = breakdown?.systemTokens ?? 0;
  const memoryTokens = breakdown?.memoryTokens ?? 0;
  const historyTokens = breakdown?.historyTokens ?? dialogueTokens;
  const freeTokens = Math.max(0, maxTokens - usedTokens);
  const compactionTier = breakdown?.compactionTier ?? (pct > 85 ? 2 : pct > 70 ? 1 : 0);

  const activeQuota = liveTelemetry?.quotaStatus || quotaStatus;

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
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return String(tokens);
  };

  return (
    <div className="relative inline-flex items-center select-none" ref={popoverRef}>
      {/* Gauge Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] transition-all text-xs font-mono cursor-pointer shadow-sm"
        title={t.chat.contextBudget}
      >
        <Layers className="w-3.5 h-3.5 text-[var(--theme-text-muted)] shrink-0" />
        <span className="text-[var(--theme-text)] text-[11px] font-semibold whitespace-nowrap">
          {formatK(usedTokens)} / {formatK(maxTokens)}
        </span>
        <div className="w-10 h-1.5 rounded-full bg-[var(--theme-panel)] overflow-hidden border border-[var(--theme-border)] hidden sm:block shrink-0">
          <div
            className={`h-full transition-all duration-300 ${getBarColor(pct)}`}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>

        <span
          className={`text-[10px] tracking-tight font-mono whitespace-nowrap font-bold ${
            pct > 85 ? 'text-rose-400' : pct > 65 ? 'text-amber-400' : 'text-[var(--theme-text-muted)]'
          }`}
          title={`Context Usage: ${pct}%`}
        >
          {pct}%
        </span>

        {/* Quota Exhaustion Alert dot */}
        {activeQuota?.exhausted && (
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" title="Квота исчерпана (429)" />
        )}
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

          {/* Quota Exhaustion Alert Row */}
          {activeQuota?.exhausted && (
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[10px] uppercase tracking-wider">Квота исчерпана (429)</div>
                {activeQuota.resetText && (
                  <div className="text-[10px] text-rose-200">Сброс через: {activeQuota.resetText}</div>
                )}
              </div>
            </div>
          )}

          {/* Breakdown Items */}
          <div className="space-y-1.5 text-[11px]">
            {systemTokens > 0 && (
              <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  {t.chat.contextSystem}
                </span>
                <span className="text-[var(--theme-text)] font-semibold">{systemTokens} tok</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-emerald-400" />
                {t.chat.contextHistory}
              </span>
              <span className="text-[var(--theme-text)] font-semibold">{historyTokens} tok</span>
            </div>

            {memoryTokens > 0 && (
              <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-violet-400" />
                  {t.chat.contextMemory}
                </span>
                <span className="text-[var(--theme-text)] font-semibold">{memoryTokens} tok</span>
              </div>
            )}

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
