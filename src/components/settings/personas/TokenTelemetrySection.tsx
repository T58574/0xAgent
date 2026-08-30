import React, { useState } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Sparkles,
  Wrench,
  Layers,
  FileText,
  Terminal,
  Shield,
  BookOpen,
  Brain,
  MessageSquare,
  HardDrive,
  Check,
} from 'lucide-react';
import { ContextBreakdownReport } from '../../../types';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { SettingsSection, SettingStatCard } from '../common';

interface TokenTelemetrySectionProps {
  tokenReport: ContextBreakdownReport;
  isLoading: boolean;
  onRefresh: () => void;
}

export const TokenTelemetrySection: React.FC<TokenTelemetrySectionProps> = ({
  tokenReport,
  isLoading,
  onRefresh,
}) => {
  const { t, formatString } = useI18n();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [copiedCatId, setCopiedCatId] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const hasAnyExpanded = Object.values(expandedCategories).some(Boolean);

  const toggleAll = () => {
    if (hasAnyExpanded) {
      setExpandedCategories({});
    } else {
      const all: Record<string, boolean> = {};
      tokenReport.categories.forEach((c) => {
        all[c.id] = true;
      });
      setExpandedCategories(all);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCatId(id);
    setTimeout(() => setCopiedCatId(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'skills':
        return <Sparkles size={14} className="text-cyan-500 shrink-0" />;
      case 'tools':
        return <Wrench size={14} className="text-sky-500 shrink-0" />;
      case 'persona':
        return <Layers size={14} className="text-purple-500 shrink-0" />;
      case 'user_profile':
        return <FileText size={14} className="text-pink-500 shrink-0" />;
      case 'environment':
        return <Terminal size={14} className="text-emerald-500 shrink-0" />;
      case 'planning':
        return <Shield size={14} className="text-amber-500 shrink-0" />;
      case 'workspace_rules':
        return <BookOpen size={14} className="text-indigo-500 shrink-0" />;
      case 'memory':
        return <Brain size={14} className="text-lime-500 shrink-0" />;
      case 'chat_history':
        return <MessageSquare size={14} className="text-zinc-400 shrink-0" />;
      default:
        return <HardDrive size={14} className="text-[var(--theme-text-muted)] shrink-0" />;
    }
  };

  return (
    <SettingsSection
      title={t.settings.personas.contextBreakdownTitle}
      description={t.settings.personas.contextBreakdownDesc}
      badge="Token Telemetry"
      actionSlot={
        <Button
          variant="secondary"
          size="xs"
          onClick={onRefresh}
          loading={isLoading}
          icon={<RefreshCw size={12} />}
        >
          {t.common.refresh}
        </Button>
      }
    >
      <Card variant="default" className="p-6 space-y-6 rounded-2xl">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SettingStatCard
            label={t.settings.customizations.available}
            value={`${tokenReport.availablePercentage}%`}
            sublabel={t.settings.customizations.limitContext}
          />

          <SettingStatCard
            label={t.settings.customizations.usedTokens}
            value={
              <>
                {tokenReport.totalUsed.toLocaleString()}{' '}
                <span className="text-xs font-normal text-[var(--theme-text-muted)]">
                  / {tokenReport.totalBudget.toLocaleString()}
                </span>
              </>
            }
            sublabel={t.settings.customizations.systemInst}
          />

          <SettingStatCard
            label={t.settings.customizations.categoriesCount}
            value={tokenReport.categories.length}
            sublabel={t.settings.customizations.activeDirectives}
          />
        </div>

        {/* Segmented Color Progress Bar */}
        <div className="w-full h-3 rounded-full bg-[var(--theme-input-bg)] overflow-hidden flex items-center p-0.5 border border-[var(--theme-border)]">
          {tokenReport.categories.map((cat) => {
            const widthPercent = Math.max(0.6, (cat.tokens / tokenReport.totalBudget) * 100);
            return (
              <div
                key={cat.id}
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: cat.color,
                }}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 cursor-pointer hover:brightness-125"
                onClick={() => toggleCategory(cat.id)}
                title={`${cat.name}: ${cat.tokens.toLocaleString()} tok (${cat.percentage}%)`}
              />
            );
          })}
        </div>

        {/* Category Badges Grid + Toggle All Button */}
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {tokenReport.categories.map((cat) => {
                const isExpanded = Boolean(expandedCategories[cat.id]);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                      isExpanded
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] font-bold'
                        : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)]'
                    }`}
                    title="Click to view directive breakdown"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.name}</span>
                    <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                      {cat.tokens.toLocaleString()} tok
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={11} className="text-[var(--theme-accent)] ml-0.5" />
                    ) : (
                      <ChevronRight size={11} className="text-[var(--theme-text-muted)] ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-[var(--theme-accent)] hover:underline flex items-center gap-1 cursor-pointer select-none ml-auto shrink-0"
            >
              <span>
                {hasAnyExpanded
                  ? t.settings.customizations.collapseCategories
                  : formatString(t.settings.customizations.showAllCategories, {
                      count: tokenReport.categories.length,
                    })}
              </span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${hasAnyExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Detailed Breakdown Accordion Items */}
          {tokenReport.categories.some((c) => expandedCategories[c.id]) && (
            <div className="space-y-3 pt-3 border-t border-[var(--theme-border)]">
              {tokenReport.categories
                .filter((c) => expandedCategories[c.id])
                .map((cat) => {
                  const hasDetails = cat.details && cat.details.length > 0;
                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)] p-4 space-y-3 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {getCategoryIcon(cat.category)}
                          <span className="text-xs font-bold text-[var(--theme-text)] truncate">
                            {cat.name}
                          </span>
                          {cat.scope && (
                            <Badge variant="neutral" size="xs">
                              {cat.scope}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-semibold text-[var(--theme-text)]">
                            {cat.tokens.toLocaleString()} tok
                          </span>
                          <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                            ({cat.percentage}%)
                          </span>
                        </div>
                      </div>

                      {cat.description && (
                        <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                          {cat.description}
                        </p>
                      )}

                      {/* Detail Items List */}
                      {hasDetails && (
                        <div className="space-y-2 pt-1">
                          {cat.details!.map((detail) => (
                            <div
                              key={detail.id}
                              className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-0.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold font-mono text-[var(--theme-text)]">
                                    {detail.name}
                                  </span>
                                  {detail.scope && (
                                    <Badge variant="neutral" size="xs">
                                      {detail.scope}
                                    </Badge>
                                  )}
                                  {detail.enabled !== undefined && (
                                    <Badge
                                      variant={detail.enabled ? 'success' : 'neutral'}
                                      size="xs"
                                    >
                                      {detail.enabled ? 'Active' : 'Off'}
                                    </Badge>
                                  )}
                                </div>
                                {detail.description && (
                                  <p className="text-[10px] text-[var(--theme-text-muted)] line-clamp-1 font-mono">
                                    {detail.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                                  {detail.tokens.toLocaleString()} tok
                                </span>
                                {detail.preview && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(detail.id, detail.preview!)}
                                    className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                                    title={t.common.copy}
                                  >
                                    {copiedCatId === detail.id ? (
                                      <Check size={12} className="text-emerald-500" />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Raw Content Preview */}
                      {!hasDetails && cat.contentPreview && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text-muted)]">
                              {t.settings.customizations.contentPreview}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(cat.id, cat.contentPreview!)}
                              className="text-[10px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer"
                            >
                              {copiedCatId === cat.id ? (
                                <>
                                  <Check size={11} className="text-emerald-500" />
                                  <span className="text-emerald-500">{t.common.copied}</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>{t.common.copy}</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-3.5 rounded-xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-[var(--theme-border)] select-text leading-relaxed">
                            {cat.contentPreview}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </Card>
    </SettingsSection>
  );
};
