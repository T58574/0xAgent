import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Layers,
  Wrench,
  Sparkles,
  BookOpen,
  Brain,
  Terminal,
  Shield,
  FileText,
  MessageSquare,
  HardDrive,
} from 'lucide-react';
import { ContextBreakdownReport, AppConfig } from '../../types';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';

interface CustomizationsTabProps {
  config: AppConfig | null;
  currentSessionId?: string | null;
}

export const CustomizationsTab: React.FC<CustomizationsTabProps> = ({ config, currentSessionId }) => {
  const { t, formatString } = useI18n();
  const [report, setReport] = useState<ContextBreakdownReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdowns, setShowBreakdowns] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    skills: true,
    tools: true,
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
        return <Sparkles size={15} className="text-cyan-500 shrink-0" />;
      case 'tools':
        return <Wrench size={15} className="text-sky-500 shrink-0" />;
      case 'persona':
        return <Layers size={15} className="text-purple-500 shrink-0" />;
      case 'user_profile':
        return <FileText size={15} className="text-pink-500 shrink-0" />;
      case 'environment':
        return <Terminal size={15} className="text-emerald-500 shrink-0" />;
      case 'planning':
        return <Shield size={15} className="text-amber-500 shrink-0" />;
      case 'workspace_rules':
        return <BookOpen size={15} className="text-indigo-500 shrink-0" />;
      case 'memory':
        return <Brain size={15} className="text-lime-500 shrink-0" />;
      case 'history':
        return <MessageSquare size={15} className="text-zinc-400 shrink-0" />;
      default:
        return <HardDrive size={15} className="text-[var(--theme-text-muted)] shrink-0" />;
    }
  };

  const translateCategoryName = (name: string, catKey: string) => {
    if (catKey === 'tools' || name.toLowerCase().includes('tools')) return t.settings.customizations.catTools;
    if (catKey === 'persona' || name.toLowerCase().includes('soul')) return t.settings.customizations.catPersona;
    if (catKey === 'user_profile' || name.toLowerCase().includes('user')) return t.settings.customizations.catUser;
    if (catKey === 'environment' || name.toLowerCase().includes('environment') || name.toLowerCase().includes('окружение')) return t.settings.customizations.catEnv;
    if (catKey === 'planning' || name.toLowerCase().includes('planning')) return t.settings.customizations.catPlanning;
    if (catKey === 'workspace_rules' || name.toLowerCase().includes('rules') || name.toLowerCase().includes('правила')) return t.settings.customizations.catRules;
    if (catKey === 'memory' || name.toLowerCase().includes('memory') || name.toLowerCase().includes('память')) return t.settings.customizations.catMemory;
    if (catKey === 'history' || name.toLowerCase().includes('history') || name.toLowerCase().includes('история')) return t.settings.customizations.catHistory;
    if (catKey === 'skills' || name.toLowerCase().includes('skills') || name.toLowerCase().includes('скиллы')) return t.settings.customizations.catSkills;
    return name;
  };

  const translateScope = (scope?: string) => {
    if (!scope) return null;
    const lower = scope.toLowerCase();
    if (lower === 'global') return t.settings.customizations.scopeGlobal;
    if (lower === 'workspace') return t.settings.customizations.scopeWorkspace;
    return scope;
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 md:p-6 space-y-6 select-text font-sans">
      {/* Top Title & Refresh */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--theme-border)]">
        <div>
          <h1 className="text-base md:text-lg font-bold text-[var(--theme-text)]">
            {t.settings.customizations.title}
          </h1>
          <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
            {t.settings.customizations.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchBreakdown}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
          title={t.settings.customizations.refreshBtn}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>{t.settings.customizations.refreshBtn}</span>
        </button>
      </div>

      {/* Main Token Usage Infographic Card */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
          {t.settings.customizations.budgetTitle}
        </h2>

        {report ? (
          <div className="p-5 rounded-2xl bento-card space-y-4 border border-[var(--theme-border)] bg-[var(--theme-card-bg)] shadow-sm">
            <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
              {t.settings.customizations.budgetDesc}
            </p>

            {/* Availability Percentage & Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)]">{t.settings.customizations.available}</span>
                <span className="text-lg font-bold text-[var(--theme-text)] font-mono">
                  {report.availablePercentage}%
                </span>
                <span className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">{t.settings.customizations.limitContext}</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)]">{t.settings.customizations.usedTokens}</span>
                <span className="text-lg font-bold text-[var(--theme-text)] font-mono">
                  {report.totalUsed.toLocaleString()} <span className="text-xs font-normal text-[var(--theme-text-muted)]">/ {report.totalBudget.toLocaleString()}</span>
                </span>
                <span className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">{t.settings.customizations.systemInst}</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)]">{t.settings.customizations.categoriesCount}</span>
                <span className="text-lg font-bold text-[var(--theme-text)] font-mono">
                  {report.categories.length}
                </span>
                <span className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">{t.settings.customizations.activeDirectives}</span>
              </div>
            </div>

            {/* Segmented Color Progress Bar */}
            <div className="w-full h-3 rounded-full bg-[var(--theme-input-bg)] overflow-hidden flex items-center p-0.5 border border-[var(--theme-border)]">
              {report.categories.map((cat) => {
                const widthPercent = Math.max(0.6, (cat.tokens / report.totalBudget) * 100);
                return (
                  <div
                    key={cat.id}
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: cat.color,
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 hover:brightness-125"
                    title={`${translateCategoryName(cat.name, cat.category)}: ${cat.tokens.toLocaleString()} (${cat.percentage}%)`}
                  />
                );
              })}
            </div>

            {/* Legend Chips */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {report.categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--theme-input-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] cursor-pointer transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-semibold">{translateCategoryName(cat.name, cat.category).split(' ')[0]}</span>
                    <span className="text-[10px] font-mono text-[var(--theme-text-muted)] font-bold">
                      {cat.tokens.toLocaleString()} tok
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowBreakdowns(!showBreakdowns)}
                className="text-xs font-bold text-[var(--theme-text)] hover:underline transition-colors cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
              >
                <span>{showBreakdowns ? t.settings.customizations.collapseCategories : formatString(t.settings.customizations.showAllCategories, { count: report.categories.length })}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showBreakdowns ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bento-card text-center text-xs text-[var(--theme-text-muted)] flex items-center justify-center gap-2 border border-[var(--theme-border)]">
            <RefreshCw size={14} className="animate-spin" />
            <span>{t.common.loading}</span>
          </div>
        )}
      </div>

      {/* Detailed Accordion Breakdown Sections */}
      {showBreakdowns && report && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
            {t.settings.customizations.structureTitle}
          </h2>

          <div className="space-y-2.5">
            {report.categories.map((cat) => {
              const isExpanded = !!expandedCategories[cat.id];
              const hasDetails = cat.details && cat.details.length > 0;
              const titleName = translateCategoryName(cat.name, cat.category);
              const scopeName = translateScope(cat.scope);

              return (
                <div key={cat.id} className="rounded-2xl bento-card border border-[var(--theme-border)] overflow-hidden transition-all shadow-sm">
                  {/* Accordion Header */}
                  <div
                    onClick={() => toggleCategory(cat.id)}
                    className="px-4 py-3 bg-[var(--theme-card-bg)] flex items-center justify-between cursor-pointer hover:bg-[var(--theme-border-subtle)] transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      {hasDetails || cat.contentPreview ? (
                        isExpanded ? <ChevronDown size={15} className="text-[var(--theme-text-muted)]" /> : <ChevronRight size={15} className="text-[var(--theme-text-muted)]" />
                      ) : (
                        <div className="w-3.5" />
                      )}
                      {getCategoryIcon(cat.category)}
                      <span className="text-xs font-bold text-[var(--theme-text)]">
                        {titleName}
                      </span>
                      {scopeName && (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] font-bold">
                          {scopeName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--theme-text-muted)] font-semibold">
                        {cat.tokens.toLocaleString()} tok <span className="text-[10px] opacity-70">({cat.percentage}%)</span>
                      </span>
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div className="p-4 space-y-3 bg-[var(--theme-input-bg)] border-t border-[var(--theme-border)]">
                      {cat.description && (
                        <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                          {cat.description}
                        </p>
                      )}

                      {/* Detailed Items List (e.g. Skills, Tools) */}
                      {hasDetails && (
                        <div className="space-y-2 pt-1">
                          {cat.details!.map((detail) => (
                            <div
                              key={detail.id}
                              className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-[var(--theme-text)] font-mono">
                                    {detail.name}
                                  </span>
                                  {detail.scope && (
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] font-bold">
                                      {translateScope(detail.scope)}
                                    </span>
                                  )}
                                  {detail.enabled !== undefined && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-bold ${detail.enabled ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'}`}>
                                      {detail.enabled ? t.settings.customizations.activeBadge : t.settings.customizations.inactiveBadge}
                                    </span>
                                  )}
                                </div>
                                {detail.description && (
                                  <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                                    {detail.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text)] border border-[var(--theme-border)] font-bold">
                                  {detail.tokens.toLocaleString()} tok
                                </span>
                                {detail.preview && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(detail.id, detail.preview!)}
                                    className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer border border-[var(--theme-border)]"
                                    title={t.settings.customizations.copyTooltip}
                                  >
                                    {copiedId === detail.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Raw Preview for Single Directives */}
                      {!hasDetails && cat.contentPreview && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--theme-text-muted)] font-bold">
                            <span>{t.settings.customizations.contentPreview}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(cat.id, cat.contentPreview!)}
                              className="flex items-center gap-1 hover:text-[var(--theme-text)] cursor-pointer"
                            >
                              {copiedId === cat.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              <span>{t.common.copy}</span>
                            </button>
                          </div>
                          <pre className="p-3 rounded-xl bg-[var(--theme-code-bg)] border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-code-text)] overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
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
        </div>
      )}
    </div>
  );
};
