import React, { useState, useMemo } from 'react';
import { Activity, Zap, Database, CheckCircle2, RefreshCw, Layers, Search, Terminal } from 'lucide-react';
import { MaterialIcon } from '../common/MaterialIcon';
import { ChatSession, ChatMessage } from '../../types';
import { useI18n } from '../../i18n';

interface AnalyticsPageProps {
  sessions: ChatSession[];
  serverLogs: string[];
  onRefresh?: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ sessions, serverLogs, onRefresh }) => {
  const { t, formatString } = useI18n();
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'high_speed' | 'high_context' | 'errors'>('all');

  const allAssistantMessages = useMemo(() => {
    const msgs: Array<{ sessionTitle: string; sessionId: string; msg: ChatMessage }> = [];
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === 'assistant') {
          msgs.push({ sessionTitle: session.title, sessionId: session.id, msg });
        }
      }
    }
    return msgs.sort((a, b) => b.msg.timestamp - a.msg.timestamp);
  }, [sessions]);

  // Aggregate metrics
  const stats = useMemo(() => {
    let totalEvalTokens = 0;
    let totalPromptTokens = 0;
    let totalEvalTimeMs = 0;
    let maxContextPercent = 0;
    let speedSum = 0;
    let speedCount = 0;
    let errorCount = 0;
    let totalCount = allAssistantMessages.length;

    for (const item of allAssistantMessages) {
      const m = item.msg.metrics;
      if (m) {
        if (m.completionTokens) totalEvalTokens += m.completionTokens;
        if (m.promptTokens) totalPromptTokens += m.promptTokens;
        if (m.evalDurationMs) totalEvalTimeMs += m.evalDurationMs;
        if (m.tokensPerSec && m.tokensPerSec > 0) {
          speedSum += m.tokensPerSec;
          speedCount++;
        }
        if (m.contextUsed && m.contextMax && m.contextMax > 0) {
          const pct = (m.contextUsed / m.contextMax) * 100;
          if (pct > maxContextPercent) maxContextPercent = pct;
        }
      }
      if (item.msg.content.includes('Ошибка') || item.msg.content.includes('Error')) {
        errorCount++;
      }
    }

    const avgSpeed = speedCount > 0 ? (speedSum / speedCount).toFixed(1) : '0.0';
    const totalTokens = totalEvalTokens + totalPromptTokens;
    const successRate = totalCount > 0 ? (((totalCount - errorCount) / totalCount) * 100).toFixed(1) : '100.0';

    return {
      avgSpeed,
      totalTokens,
      totalEvalTokens,
      totalPromptTokens,
      maxContextPercent: maxContextPercent.toFixed(1),
      successRate,
      errorCount,
      totalCount,
    };
  }, [allAssistantMessages]);

  // Filter messages for table
  const filteredMessages = useMemo(() => {
    return allAssistantMessages.filter((item) => {
      const m = item.msg.metrics;
      const textMatches =
        !searchFilter ||
        item.msg.content.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.sessionTitle.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (m?.modelName && m.modelName.toLowerCase().includes(searchFilter.toLowerCase()));

      if (!textMatches) return false;

      if (selectedCategory === 'high_speed') return (m?.tokensPerSec || 0) >= 30;
      if (selectedCategory === 'high_context') return ((m?.contextUsed || 0) / (m?.contextMax || 8192)) >= 0.4;
      if (selectedCategory === 'errors') return item.msg.content.includes('Ошибка') || item.msg.content.includes('Error');

      return true;
    });
  }, [allAssistantMessages, searchFilter, selectedCategory]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--theme-bg)] overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin font-sans text-[var(--theme-text)] select-text">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--theme-border)] pb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--theme-text)] flex items-center gap-2.5">
            <Activity size={22} className="text-[var(--theme-accent)]" />
            <span>{t.analytics.title}</span>
          </h1>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1 font-mono">
            {t.analytics.subtitle}
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-xs font-bold text-[var(--theme-text)] flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
          >
            <RefreshCw size={13} />
            <span>{t.analytics.refreshBtn}</span>
          </button>
        )}
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Speed */}
        <div className="p-4.5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-card-bg)] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-[var(--theme-text-muted)] mb-2 text-xs font-bold uppercase tracking-wider">
            <span>{t.analytics.avgSpeed}</span>
            <Zap size={16} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-accent)] transition-colors" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--theme-text)] tracking-tight">
            {stats.avgSpeed} <span className="text-xs font-sans text-[var(--theme-text-muted)] font-normal">{t.analytics.speedUnit}</span>
          </div>
          <div className="text-xs text-[var(--theme-text-muted)] mt-2 flex items-center gap-1 font-mono">
            {t.analytics.liveCalc}
          </div>
        </div>

        {/* KPI 2: Tokens */}
        <div className="p-4.5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-card-bg)] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-[var(--theme-text-muted)] mb-2 text-xs font-bold uppercase tracking-wider">
            <span>{t.analytics.tokensProcessed}</span>
            <Database size={16} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-accent)] transition-colors" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--theme-text)] tracking-tight">
            {stats.totalTokens.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--theme-text-muted)] mt-2 flex items-center justify-between font-mono">
            <span>{t.analytics.promptTokens}: {stats.totalPromptTokens.toLocaleString()}</span>
            <span>{t.analytics.evalTokens}: {stats.totalEvalTokens.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 3: Context Peak */}
        <div className="p-4.5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-card-bg)] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-[var(--theme-text-muted)] mb-2 text-xs font-bold uppercase tracking-wider">
            <span>{t.analytics.contextPeak}</span>
            <MaterialIcon name="psychology" size={18} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-accent)] transition-colors" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--theme-text)] tracking-tight">
            {stats.maxContextPercent}%
          </div>
          <div className="w-full bg-[var(--theme-input-bg)] h-2 rounded-full overflow-hidden mt-3.5 border border-[var(--theme-border)]">
            <div
              className="bg-[var(--theme-accent)] h-full transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, Number(stats.maxContextPercent))}%` }}
            />
          </div>
        </div>

        {/* KPI 4: Reliability */}
        <div className="p-4.5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-card-bg)] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-[var(--theme-text-muted)] mb-2 text-xs font-bold uppercase tracking-wider">
            <span>{t.analytics.reliability}</span>
            <CheckCircle2 size={16} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-accent)] transition-colors" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--theme-text)] tracking-tight">
            {stats.successRate}%
          </div>
          <div className="text-xs text-[var(--theme-text-muted)] mt-2 flex items-center justify-between font-mono">
            <span>{t.analytics.totalResponses}: {stats.totalCount}</span>
            <span className={stats.errorCount > 0 ? 'text-rose-500 font-bold' : ''}>{t.analytics.errorsCount}: {stats.errorCount}</span>
          </div>
        </div>

      </div>

      {/* TELEMETRY TABLE & FILTERS */}
      <div className="p-5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-card-bg)] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="text-[var(--theme-accent)]" size={18} />
            <h2 className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider">
              {t.analytics.logsTitle}
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[11px] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] font-mono border border-[var(--theme-border)] font-bold">
              {formatString(t.analytics.recordsCount, { count: filteredMessages.length })}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--theme-text-muted)]" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={t.analytics.searchPlaceholder}
                className="pl-8.5 pr-3 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] focus:outline-none w-48 sm:w-56 font-medium"
              />
            </div>
            
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${
                selectedCategory === 'all'
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-sm'
                  : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
              }`}
            >
              {t.analytics.filterAll}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('high_speed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${
                selectedCategory === 'high_speed'
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-sm'
                  : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
              }`}
            >
              {t.analytics.filterSpeed}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('errors')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${
                selectedCategory === 'errors'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
              }`}
            >
              {formatString(t.analytics.filterErrors, { count: stats.errorCount })}
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)]">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead className="bg-[var(--theme-border-subtle)] text-[var(--theme-text)] font-bold border-b border-[var(--theme-border)] uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="p-3.5">{t.analytics.thTime}</th>
                <th className="p-3.5">{t.analytics.thModel}</th>
                <th className="p-3.5">{t.analytics.thSpeed}</th>
                <th className="p-3.5">{t.analytics.thTokens}</th>
                <th className="p-3.5">{t.analytics.thContext}</th>
                <th className="p-3.5">{t.analytics.thDuration}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)] bg-[var(--theme-card-bg)] font-mono text-[var(--theme-text)]">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--theme-text-muted)] font-sans">
                    {t.analytics.noRecords}
                  </td>
                </tr>
              ) : (
                filteredMessages.map((item) => {
                  const m = item.msg.metrics;
                  const ctxPercent = m?.contextUsed && m?.contextMax ? ((m.contextUsed / m.contextMax) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={item.msg.id} className="hover:bg-[var(--theme-border-subtle)] transition-colors">
                      <td className="p-3.5 font-sans">
                        <div className="font-bold text-[var(--theme-text)] truncate max-w-xs">{item.sessionTitle}</div>
                        <div className="text-[11px] text-[var(--theme-text-muted)] font-mono mt-0.5">
                          {new Date(item.msg.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--theme-input-bg)] text-[var(--theme-text)] border border-[var(--theme-border)] text-xs font-semibold">
                          {m?.modelName || 'qwen2.5-coder:7b'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {m?.tokensPerSec ? (
                          <span className="font-bold text-[var(--theme-text)] text-xs">
                            {m.tokensPerSec} t/s
                          </span>
                        ) : (
                          <span className="text-[var(--theme-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-[var(--theme-text)]">
                        {m?.promptTokens !== undefined ? (
                          <span>
                            <span className="text-[var(--theme-text-muted)]">{m.promptTokens}</span> +{' '}
                            <span className="font-semibold">{m.completionTokens}</span> ={' '}
                            <span className="font-bold">{m.totalTokens}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--theme-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-18 bg-[var(--theme-input-bg)] h-2 rounded-full overflow-hidden border border-[var(--theme-border)]">
                            <div
                              className="bg-[var(--theme-accent)] h-full rounded-full"
                              style={{ width: `${Math.min(100, Number(ctxPercent))}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--theme-text-muted)] font-semibold">{ctxPercent}%</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-[var(--theme-text-muted)]">
                        {m?.evalDurationMs ? `${m.evalDurationMs} ms` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIAGNOSTIC SERVER LOGS */}
      <div className="p-5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-card-bg)] space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Terminal className="text-[var(--theme-text-muted)]" size={18} />
          <h2 className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider">
            {t.analytics.serverLogsTitle}
          </h2>
        </div>
        <div className="bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] p-3.5 rounded-xl border border-[var(--theme-border)] font-mono text-xs max-h-52 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {serverLogs.length === 0 ? (
            <span className="text-[var(--theme-text-muted)]">{t.analytics.noServerLogs}</span>
          ) : (
            serverLogs.slice(-50).map((log, idx) => (
              <div key={idx} className={log.includes('[ERROR]') || log.includes('Ошибка') ? 'text-rose-500 font-bold' : ''}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
