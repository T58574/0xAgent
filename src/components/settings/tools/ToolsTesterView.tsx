import React from 'react';
import {
  RotateCcw,
  Play,
  ArrowRight,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { SettingsSection } from '../common';

interface ToolsTesterViewProps {
  testQuery: string;
  setTestQuery: (val: string) => void;
  isTesting: boolean;
  onRunTest: () => void;
  testResult: {
    results: Array<{ title: string; url: string; snippet: string; engine?: string }>;
    engineUsed: string;
    latencyMs: number;
    error?: string;
    cascadeTrail?: string[];
  } | null;
}

export const ToolsTesterView: React.FC<ToolsTesterViewProps> = ({
  testQuery,
  setTestQuery,
  isTesting,
  onRunTest,
  testResult,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t.settings.toolsTab.testSearchTitle}
        description="Проверка ответа активного поискового провайдера в реальном времени"
      >
        <Card variant="default" className="p-6 space-y-5 rounded-2xl">
          <div className="flex gap-2.5">
            <div className="flex-1">
              <Input
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onRunTest()}
                placeholder={t.settings.toolsTab.testSearchPlaceholder}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={onRunTest}
              disabled={isTesting || !testQuery.trim()}
              loading={isTesting}
              icon={isTesting ? <RotateCcw size={13} /> : <Play size={13} />}
            >
              {isTesting ? t.settings.toolsTab.testing : t.settings.toolsTab.testSearchBtn}
            </Button>
          </div>

          {/* Test Results Output */}
          {testResult ? (
            <div className="space-y-3 pt-3 border-t border-[var(--theme-border)] animate-fadeIn">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-[var(--theme-text)]">
                  {t.settings.toolsTab.testResults}
                </span>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <Badge variant="success" size="xs">
                    {testResult.engineUsed}
                  </Badge>
                  <Badge variant="neutral" size="xs">
                    {testResult.latencyMs}ms
                  </Badge>
                </div>
              </div>

              {testResult.cascadeTrail && testResult.cascadeTrail.length > 1 && (
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--theme-text-muted)] font-mono flex-wrap p-2.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)]">
                  <span>{t.settings.toolsTab.cascadeTrail}:</span>
                  {testResult.cascadeTrail.map((hop, idx) => (
                    <React.Fragment key={idx}>
                      <Badge variant="neutral" size="xs">
                        {hop}
                      </Badge>
                      {idx < (testResult.cascadeTrail?.length || 0) - 1 && (
                        <ArrowRight size={10} className="text-[var(--theme-text-muted)]" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {testResult.error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{testResult.error}</span>
                </div>
              )}

              {testResult.results.length === 0 && !testResult.error && (
                <div className="p-8 text-center text-xs text-[var(--theme-text-muted)] italic">
                  {t.settings.toolsTab.noResults}
                </div>
              )}

              <div className="space-y-3">
                {testResult.results.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] space-y-1.5 hover:border-[var(--theme-border)]/80 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-[var(--theme-text)] hover:underline flex items-center gap-1.5 truncate"
                      >
                        <span className="truncate">{item.title}</span>
                        <ExternalLink size={11} className="shrink-0 text-[var(--theme-text-muted)]" />
                      </a>
                      {item.engine && (
                        <Badge variant="neutral" size="xs">
                          {item.engine}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--theme-text-muted)]">
              Введите поисковый запрос и нажмите «{t.settings.toolsTab.testSearchBtn}» для проверки задержки и каскада.
            </div>
          )}
        </Card>
      </SettingsSection>
    </div>
  );
};
