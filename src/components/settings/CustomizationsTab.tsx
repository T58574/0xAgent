import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Copy, Check, Info, Layers, Wrench, Sparkles, BookOpen, Brain, Terminal, Shield, FileText } from 'lucide-react';
import { ContextBreakdownReport, AppConfig } from '../../types';
import * as api from '../../services/api';

interface CustomizationsTabProps {
  config: AppConfig | null;
  currentSessionId?: string | null;
}

export const CustomizationsTab: React.FC<CustomizationsTabProps> = ({ config, currentSessionId }) => {
  const [report, setReport] = useState<ContextBreakdownReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdowns, setShowBreakdowns] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    skills: true,
    tools: false,
    persona: false,
    workspace_rules: false,
    memory: false,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBreakdown = async () => {
    setLoading(true);
    try {
      const data = await api.get_context_breakdown(currentSessionId);
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch context breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakdown();
  }, [config, currentSessionId]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'skills':
        return <Sparkles size={14} className="text-cyan-400" />;
      case 'tools':
        return <Wrench size={14} className="text-sky-400" />;
      case 'persona':
        return <Layers size={14} className="text-purple-400" />;
      case 'user_profile':
        return <FileText size={14} className="text-pink-400" />;
      case 'environment':
        return <Terminal size={14} className="text-emerald-400" />;
      case 'planning':
        return <Shield size={14} className="text-amber-400" />;
      case 'workspace_rules':
        return <BookOpen size={14} className="text-indigo-400" />;
      case 'memory':
        return <Brain size={14} className="text-lime-400" />;
      default:
        return <Info size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 md:p-6 space-y-6 select-text">
      {/* Top Title & Subtitle */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--theme-border)]">
        <div>
          <h1 className="text-base md:text-lg font-semibold text-[var(--theme-text)]">
            Customizations & Token Usage
          </h1>
          <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
            Configure default behaviors, skills, prompt directives, and analyze context consumption.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchBreakdown}
          disabled={loading}
          className="p-2 rounded-lg bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
          title="Обновить аналитику токенов"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Token Usage Bento Card (Inspired by Screenshot) */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)]">
          Token Usage
        </h2>

        {report ? (
          <div className="p-4 md:p-5 rounded-xl bento-card space-y-4 border border-[var(--theme-border)] bg-[var(--theme-panel)]/40">
            {/* Explanatory text */}
            <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
              The breakdown below shows token usage from customizations like skills, rules, and system prompt. If the budget is exceeded, large customizations will be truncated automatically.
            </p>

            {/* Availability Percentage Pill */}
            <div className="text-xs font-medium text-[var(--theme-text)]">
              <span className="text-sky-400 font-mono font-semibold">{report.availablePercentage}%</span> of the customization budget is available.
              <span className="text-[11px] font-mono text-[var(--theme-text-muted)] ml-2">
                ({report.totalUsed.toLocaleString()} / {report.totalBudget.toLocaleString()} tokens used)
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden flex items-center p-0.5 border border-white/5">
              {report.categories.map((cat) => {
                const widthPercent = Math.max(0.5, (cat.tokens / report.totalBudget) * 100);
                return (
                  <div
                    key={cat.id}
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: cat.color,
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 opacity-90 hover:opacity-100"
                    title={`${cat.name}: ${cat.tokens} tok (${cat.percentage}%)`}
                  />
                );
              })}
            </div>

            {/* Legend & Breakdown Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {report.categories.slice(0, 5).map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1.5 text-xs text-[var(--theme-text)]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium">{cat.category === 'skills' ? 'Skills' : cat.category === 'tools' ? 'Tools' : cat.name.split(':')[0]}</span>
                    <span className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                      ({cat.percentage}%) {cat.tokens.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowBreakdowns(!showBreakdowns)}
                className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
              >
                <span>{showBreakdowns ? 'Hide breakdowns' : `Show ${report.categories.length} breakdowns`}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showBreakdowns ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl bento-card text-center text-xs text-[var(--theme-text-muted)] flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            <span>Калькуляция токенов контекста...</span>
          </div>
        )}
      </div>

      {/* Detailed Accordion Breakdown Sections */}
      {showBreakdowns && report && (
        <div className="space-y-4">
          {report.categories.map((cat) => {
            const isExpanded = !!expandedCategories[cat.id];
            const hasDetails = cat.details && cat.details.length > 0;

            return (
              <div key={cat.id} className="rounded-xl bento-card border border-[var(--theme-border)] overflow-hidden transition-all">
                {/* Accordion Header */}
                <div
                  onClick={() => toggleCategory(cat.id)}
                  className="px-4 py-3 bg-[var(--theme-panel)]/60 flex items-center justify-between cursor-pointer hover:bg-[var(--theme-panel)] transition-colors select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {hasDetails || cat.contentPreview ? (
                      isExpanded ? <ChevronDown size={15} className="text-[var(--theme-text-muted)]" /> : <ChevronRight size={15} className="text-[var(--theme-text-muted)]" />
                    ) : (
                      <div className="w-3.5" />
                    )}
                    {getCategoryIcon(cat.category)}
                    <span className="text-xs font-semibold text-[var(--theme-text)]">
                      {cat.name}
                    </span>
                    {cat.scope && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-[var(--theme-text-muted)] border border-white/10">
                        {cat.scope}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[var(--theme-text-muted)]">
                      {cat.tokens.toLocaleString()} tok <span className="text-[10px] text-sky-400/80">({cat.percentage}% budget)</span>
                    </span>
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 space-y-3 bg-black/20 border-t border-[var(--theme-border)]/60">
                    {cat.description && (
                      <p className="text-[11px] text-[var(--theme-text-muted)]">
                        {cat.description}
                      </p>
                    )}

                    {/* Detailed Items List (e.g. Skills, Tools, Memory) */}
                    {hasDetails && (
                      <div className="space-y-2 pt-1">
                        {cat.details!.map((detail) => (
                          <div
                            key={detail.id}
                            className="p-3 rounded-lg bg-[var(--theme-panel)]/50 border border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-white/20 transition-all"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-[var(--theme-text)] font-mono">
                                  {detail.name}
                                </span>
                                {detail.scope && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                    {detail.scope}
                                  </span>
                                )}
                                {detail.enabled !== undefined && (
                                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${detail.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {detail.enabled ? '[АКТИВЕН]' : '[ВЫКЛ]'}
                                  </span>
                                )}
                              </div>
                              {detail.description && (
                                <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2">
                                  {detail.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-[var(--theme-text)] border border-white/10">
                                {detail.tokens.toLocaleString()} tok
                              </span>
                              {detail.preview && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(detail.id, detail.preview!)}
                                  className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer"
                                  title="Скопировать директиву"
                                >
                                  {copiedId === detail.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Raw Preview for Single Directives (e.g. SOUL, Environment) */}
                    {!hasDetails && cat.contentPreview && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--theme-text-muted)]">
                          <span>ПРЕДПРОСМОТР СОДЕРЖИМОГО</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(cat.id, cat.contentPreview!)}
                            className="flex items-center gap-1 hover:text-[var(--theme-text)] cursor-pointer"
                          >
                            {copiedId === cat.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>Копировать</span>
                          </button>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-black/40 border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-text-muted)] overflow-x-auto max-h-48 whitespace-pre-wrap">
                          {cat.contentPreview}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
