import React from 'react';
import { Play, RotateCcw, Activity, ArrowRight } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { SettingsSection } from '../common';
import { useI18n } from '../../../i18n';

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
}

export interface SearchTestResult {
  results: SearchResultItem[];
  engineUsed: string;
  latencyMs: number;
  error?: string;
  cascadeTrail?: string[];
}

interface SearchEngineTesterProps {
  testQuery: string;
  setTestQuery: (q: string) => void;
  isTesting: boolean;
  onRunTest: () => void;
  testResult: SearchTestResult | null;
}

export const SearchEngineTester: React.FC<SearchEngineTesterProps> = ({
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

          {testResult && (
            <div className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)] space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2 border-b border-[var(--theme-border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Badge variant={testResult.error ? 'danger' : 'success'} size="xs">
                    {testResult.error ? 'Error' : '200 OK'}
                  </Badge>
                  <span className="font-semibold text-[var(--theme-text)]">
                    Engine: <code className="font-mono text-xs">{testResult.engineUsed}</code>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[var(--theme-text-muted)] font-mono">
                  <span className="flex items-center gap-1">
                    <Activity size={11} />
                    {testResult.latencyMs} ms
                  </span>
                  <span>{testResult.results?.length || 0} hits</span>
                </div>
              </div>

              {testResult.cascadeTrail && testResult.cascadeTrail.length > 0 && (
                <div className="text-[11px] font-mono text-[var(--theme-text-muted)] flex items-center gap-1.5 flex-wrap">
                  <span className="font-sans font-semibold">Cascade:</span>
                  {testResult.cascadeTrail.map((hop, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <ArrowRight size={10} className="opacity-50" />}
                      <span className="px-1.5 py-0.5 rounded bg-[var(--theme-card-bg)] border border-[var(--theme-border)]">
                        {hop}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {testResult.error ? (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono">
                  {testResult.error}
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {testResult.results?.map((res, idx) => (
                    <a
                      key={idx}
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-2.5 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] transition-all space-y-1 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--theme-text)] group-hover:underline truncate">
                          {res.title || res.url}
                        </span>
                        {res.engine && (
                          <span className="text-[9px] font-mono text-[var(--theme-text-muted)] shrink-0">
                            {res.engine}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                        {res.snippet}
                      </p>
                      <span className="text-[10px] text-[var(--theme-text-muted)] opacity-60 font-mono truncate block">
                        {res.url}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </SettingsSection>
    </div>
  );
};
