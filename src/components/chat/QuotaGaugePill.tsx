import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Gauge, Clock, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { QuotaStatus, AgyQuotaLimit } from '../../types';
import { useI18n } from '../../i18n';
import { get_quota_limits } from '../../services/api';

interface QuotaGaugePillProps {
  quotaStatus?: QuotaStatus | null;
}

export const QuotaGaugePill: React.FC<QuotaGaugePillProps> = React.memo(({ quotaStatus }) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedLimits, setFetchedLimits] = useState<AgyQuotaLimit[] | null>(null);
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

  // Combine limits from prop (QuotaStatus) or lazily fetched limits
  const limits: AgyQuotaLimit[] = useMemo(() => {
    if (fetchedLimits && fetchedLimits.length > 0) return fetchedLimits;
    if (quotaStatus?.limits && quotaStatus.limits.length > 0) return quotaStatus.limits;
    return [];
  }, [fetchedLimits, quotaStatus?.limits]);

  // Initial fetch if limits are missing from status
  useEffect(() => {
    if (limits.length === 0) {
      get_quota_limits()
        .then((res) => {
          if (res?.limits && res.limits.length > 0) {
            setFetchedLimits(res.limits);
          }
        })
        .catch(() => {});
    }
  }, [limits.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await get_quota_limits(true);
      if (res?.limits) {
        setFetchedLimits(res.limits);
      }
    } catch {}
    finally {
      setRefreshing(false);
    }
  };

  // Primary limit to display on the pill: prioritize 5-Hour limit (most volatile), fallback to Weekly or first
  const primaryLimit = useMemo(() => {
    if (limits.length === 0) return null;
    const fiveHour = limits.find((l) => /five\s*hour|5\s*h/i.test(l.limitType));
    if (fiveHour) return fiveHour;
    const weekly = limits.find((l) => /weekly/i.test(l.limitType));
    if (weekly) return weekly;
    return limits[0];
  }, [limits]);

  const remainingPct = primaryLimit ? primaryLimit.remainingPercentage : quotaStatus?.exhausted ? 0 : 100;

  const getBarColor = (pct: number) => {
    if (pct <= 20) return 'bg-rose-500 shadow-glow-rose';
    if (pct <= 50) return 'bg-amber-400 shadow-glow-amber';
    return 'bg-emerald-400 shadow-glow-emerald';
  };

  const getTextColor = (pct: number) => {
    if (pct <= 20) return 'text-rose-400';
    if (pct <= 50) return 'text-amber-400';
    return 'text-emerald-400';
  };

  // Helper for human-readable countdown / reset time
  const formatResetTime = (utcStr: string): string => {
    try {
      const resetTime = new Date(utcStr).getTime();
      const diffMs = resetTime - Date.now();
      if (diffMs <= 0) return 'Ready';
      const totalSec = Math.ceil(diffMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      return h > 0 ? `${h}h ${pad(m)}m` : `${m}m ${pad(s)}s`;
    } catch {
      return utcStr;
    }
  };

  return (
    <div className="relative inline-flex items-center select-none" ref={popoverRef}>
      {/* Quota Gauge Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] transition-all text-xs font-mono cursor-pointer shadow-sm"
        title="Квота Antigravity CLI (5h / Weekly). Нажмите для подробностей."
      >
        <Gauge className="w-3.5 h-3.5 text-[var(--theme-text-muted)] shrink-0" />
        
        {/* Label and Percentage */}
        <span className="text-[var(--theme-text)] text-[11px] font-semibold whitespace-nowrap">
          Quota:
        </span>

        {/* 10-Segment Progress Bar */}
        <div className="w-10 h-1.5 rounded-full bg-[var(--theme-panel)] overflow-hidden border border-[var(--theme-border)] hidden sm:block shrink-0">
          <div
            className={`h-full transition-all duration-300 ${getBarColor(remainingPct)}`}
            style={{ width: `${Math.max(4, remainingPct)}%` }}
          />
        </div>

        {/* Percentage or text */}
        <span
          className={`text-[10px] tracking-tight font-mono whitespace-nowrap font-bold ${getTextColor(remainingPct)}`}
        >
          {remainingPct}%
        </span>

        {/* 429 exhaustion dot */}
        {quotaStatus?.exhausted && (
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" title="Квота 429 исчерпана" />
        )}
      </button>

      {/* Dropdown Popover with Details & Reset Timers */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-32px)] p-3.5 rounded-2xl bg-[var(--theme-panel)]/95 backdrop-blur-2xl border border-[var(--theme-border)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-xs font-mono space-y-2.5 text-[var(--theme-text)]"
          onMouseLeave={() => setIsOpen(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
            <span className="font-bold text-[var(--theme-text)] tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              {t.chat.quotaLimitsTitle || 'Antigravity Quota Limits'}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 hover:bg-[var(--theme-border)] rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer disabled:opacity-50"
              title="Обновить квоты из CLI (agy -p /usage)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* 429 alert banner if exhausted */}
          {quotaStatus?.exhausted && (
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[10px] uppercase tracking-wider">Квота исчерпана (429)</div>
                {quotaStatus.resetText && (
                  <div className="text-[10px] text-rose-200">Сброс через: {quotaStatus.resetText}</div>
                )}
              </div>
            </div>
          )}

          {/* Limits list */}
          {limits.length > 0 ? (
            <div className="space-y-2.5 text-[11px]">
              {limits.map((lim, idx) => {
                const filled = Math.max(0, Math.min(10, Math.round(lim.remainingPercentage / 10)));
                const empty = 10 - filled;
                const bar = `[${'●'.repeat(filled)}${'○'.repeat(empty)}]`;
                const resetCountdown = formatResetTime(lim.resetAtUtc);

                return (
                  <div key={idx} className="p-2 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--theme-text)] truncate max-w-[170px]">
                        {lim.modelGroup}
                      </span>
                      <span className={`font-mono font-bold text-[11px] ${getTextColor(lim.remainingPercentage)}`}>
                        {lim.remainingPercentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--theme-text-muted)] font-mono">
                      <span>{lim.limitType}</span>
                      <span className="text-[var(--theme-text)] font-semibold">{bar}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-[var(--theme-border)]/50">
                      <span className="flex items-center gap-1 text-[var(--theme-text-muted)]">
                        <Clock className="w-3 h-3" />
                        <span>Сброс:</span>
                      </span>
                      <span className="font-mono text-amber-300 font-semibold">
                        {resetCountdown}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-3 text-center text-[var(--theme-text-muted)] text-[11px]">
              {refreshing ? 'Запрос квоты из agy CLI...' : t.chat.quotaNoLimits || 'Нет данных о квотах'}
            </div>
          )}

          {/* Footer note */}
          <div className="pt-1 text-[10px] text-[var(--theme-text-muted)] flex items-center justify-between border-t border-[var(--theme-border)]">
            <span>Источник:</span>
            <span className="font-mono text-[var(--theme-accent)]">agy -p /usage</span>
          </div>
        </div>
      )}
    </div>
  );
});

QuotaGaugePill.displayName = 'QuotaGaugePill';