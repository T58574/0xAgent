import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  Flame,
  Layers,
  Sparkles,
  Check,
  AlertCircle,
  ExternalLink,
  Zap,
  Play,
  RotateCcw,
  BookOpen,
  Terminal,
  Brain,
  MessageSquare,
  FileCode,
  Lock,
  Activity,
  ArrowRight,
  Wrench,
} from 'lucide-react';
import { SearchEngineInfo, ToolDefinition, WebSearchProvider } from '../../types';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { SettingsHeader, SettingsSection } from './common';

interface ToolsTabProps {
  webSearchProvider: WebSearchProvider;
  setWebSearchProvider: (val: WebSearchProvider) => void;
  firecrawlApiKey: string;
  setFirecrawlApiKey: (val: string) => void;
  firecrawlApiUrl: string;
  setFirecrawlApiUrl: (val: string) => void;
  searxngUrl: string;
  setSearxngUrl: (val: string) => void;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({
  webSearchProvider,
  setWebSearchProvider,
  firecrawlApiKey,
  setFirecrawlApiKey,
  firecrawlApiUrl,
  setFirecrawlApiUrl,
  searxngUrl,
  setSearxngUrl,
}) => {
  const { t } = useI18n();

  // Search Engines list & testing state
  const [engines, setEngines] = useState<SearchEngineInfo[]>([]);
  const [testQuery, setTestQuery] = useState('react 19 server components');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    results: Array<{ title: string; url: string; snippet: string; engine?: string }>;
    engineUsed: string;
    latencyMs: number;
    error?: string;
    cascadeTrail?: string[];
  } | null>(null);

  // Tools Registry State
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [savingToggles, setSavingToggles] = useState(false);
  const [toolsSuccessMsg, setToolsSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSearchEngines();
    fetchTools();
  }, []);

  const fetchSearchEngines = async () => {
    try {
      const data = await api.get_search_engines();
      if (data?.engines) {
        setEngines(data.engines);
      }
    } catch (err) {
      console.warn('Failed to load search engines:', err);
    }
  };

  const fetchTools = async () => {
    setLoadingTools(true);
    try {
      const data = await api.get_tools_state();
      if (data?.tools) {
        setTools(data.tools);
      }
    } catch (err) {
      console.error('Failed to load tools registry:', err);
    } finally {
      setLoadingTools(false);
    }
  };

  const handleToggleTool = async (toolId: string, enabled: boolean) => {
    const updated = tools.map((tool) => (tool.id === toolId ? { ...tool, enabled } : tool));
    setTools(updated);

    const toggles: Record<string, boolean> = {};
    for (const tool of updated) {
      toggles[tool.id] = tool.enabled;
    }

    setSavingToggles(true);
    try {
      await api.save_tools_toggles(toggles);
    } catch (err) {
      console.error('Failed to save tool toggle:', err);
    } finally {
      setSavingToggles(false);
    }
  };

  const applyBulkPreset = async (preset: 'all' | 'recommended' | 'readonly') => {
    const updated = tools.map((tool) => {
      if (preset === 'all') return { ...tool, enabled: true };
      if (preset === 'readonly') {
        const isReadonly = [
          'read_file',
          'list_dir',
          'grep_search',
          'fff_search',
          'get_file_info',
          'web_search',
          'read_web_page',
          'recall_memories',
          'search_knowledge',
          'list_knowledge',
          'search_sessions',
        ].includes(tool.id);
        return { ...tool, enabled: isReadonly };
      }
      // recommended preset
      return { ...tool, enabled: tool.id !== 'run_scratch_script' };
    });

    setTools(updated);
    const toggles: Record<string, boolean> = {};
    for (const tool of updated) {
      toggles[tool.id] = tool.enabled;
    }

    setSavingToggles(true);
    try {
      await api.save_tools_toggles(toggles);
      setToolsSuccessMsg('Пресет инструментов успешно применён');
      setTimeout(() => setToolsSuccessMsg(null), 2500);
    } catch (err) {
      console.error('Failed to apply tools preset:', err);
    } finally {
      setSavingToggles(false);
    }
  };

  const handleTestSearch = async () => {
    if (!testQuery.trim() || isTesting) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await api.test_web_search({
        query: testQuery.trim(),
        provider: webSearchProvider,
        firecrawl_api_key: firecrawlApiKey,
        firecrawl_api_url: firecrawlApiUrl,
        searxng_url: searxngUrl,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        results: [],
        engineUsed: webSearchProvider,
        latencyMs: 0,
        error: err?.message || 'Search execution failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getEngineIcon = (id: string) => {
    switch (id) {
      case 'auto':
        return <Sparkles size={15} className="text-cyan-400" />;
      case 'firecrawl':
        return <Flame size={15} className="text-amber-400" />;
      case 'searxng':
        return <Globe size={15} className="text-emerald-400" />;
      case 'duckduckgo':
        return <Zap size={15} className="text-orange-400" />;
      case 'wikipedia':
        return <BookOpen size={15} className="text-indigo-400" />;
      default:
        return <Search size={15} className="text-[var(--theme-accent)]" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'files':
        return <FileCode size={14} className="text-sky-400" />;
      case 'web':
        return <Globe size={14} className="text-cyan-400" />;
      case 'memory':
        return <Brain size={14} className="text-purple-400" />;
      case 'terminal':
        return <Terminal size={14} className="text-emerald-400" />;
      case 'interactive':
        return <MessageSquare size={14} className="text-pink-400" />;
      default:
        return <Layers size={14} className="text-[var(--theme-text-muted)]" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'files':
        return t.settings.toolsTab.catFiles;
      case 'web':
        return t.settings.toolsTab.catWeb;
      case 'memory':
        return t.settings.toolsTab.catMemory;
      case 'terminal':
        return t.settings.toolsTab.catTerminal;
      case 'interactive':
        return t.settings.toolsTab.catInteractive;
      default:
        return category;
    }
  };

  const categories = ['files', 'web', 'terminal', 'memory', 'interactive'] as const;

  return (
    <div className="w-full space-y-6 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header */}
      <SettingsHeader
        title={t.settings.toolsTab.title}
        subtitle={t.settings.toolsTab.subtitle}
        icon={<Wrench size={18} />}
      />

      {/* 2. Web Search Engine Configuration */}
      <SettingsSection
        title={t.settings.toolsTab.searchEngineTitle}
        badge={webSearchProvider === 'auto' ? 'Auto Cascade' : webSearchProvider.toUpperCase()}
        description={t.settings.toolsTab.searchEngineDesc}
      >
        <Card variant="default" className="space-y-4">
          {/* Search Engine Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                id: 'auto',
                name: 'Auto Cascade',
                desc: 'Firecrawl → SearXNG → DuckDuckGo → Wikipedia',
              },
              {
                id: 'firecrawl',
                name: 'Firecrawl',
                desc: 'Чистый Markdown и глубокий скрейпинг страниц',
              },
              {
                id: 'searxng',
                name: 'SearXNG',
                desc: 'Локальный приватный мета-поисковик (Docker / URL)',
              },
              {
                id: 'duckduckgo',
                name: 'DuckDuckGo',
                desc: 'Бесплатный поиск без ключа и регистрации',
              },
              {
                id: 'wikipedia',
                name: 'Wikipedia',
                desc: 'Энциклопедические факты через OpenSearch API',
              },
            ].map((eng) => {
              const isSelected = webSearchProvider === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => setWebSearchProvider(eng.id as WebSearchProvider)}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] shadow-sm ring-1 ring-[var(--theme-accent)]/30'
                      : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:bg-[var(--theme-border-subtle)] hover:border-[var(--theme-text-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 w-full">
                    <div className="flex items-center gap-2">
                      {getEngineIcon(eng.id)}
                      <span className="text-xs font-bold text-[var(--theme-text)]">{eng.name}</span>
                    </div>
                    {isSelected && <Check size={14} className="text-[var(--theme-accent)] shrink-0" />}
                  </div>
                  <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">{eng.desc}</p>
                </button>
              );
            })}

            {/* Dynamic Registered Search Engines */}
            {engines
              .filter((e) => !['auto', 'firecrawl', 'searxng', 'duckduckgo', 'wikipedia'].includes(e.id))
              .map((eng) => {
                const isSelected = webSearchProvider === eng.id;
                return (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => setWebSearchProvider(eng.id as WebSearchProvider)}
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] shadow-sm ring-1 ring-[var(--theme-accent)]/30'
                        : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:bg-[var(--theme-border-subtle)] hover:border-[var(--theme-text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 w-full">
                      <div className="flex items-center gap-2">
                        {getEngineIcon(eng.id)}
                        <span className="text-xs font-bold text-[var(--theme-text)]">{eng.name}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-[var(--theme-accent)] shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                      {eng.description}
                    </p>
                  </button>
                );
              })}
          </div>

          {/* Engine Credentials & Custom Endpoints */}
          <div className="space-y-3 pt-2 border-t border-[var(--theme-border)]">
            <Input
              label={t.settings.toolsTab.firecrawlKeyLabel}
              type="password"
              value={firecrawlApiKey}
              onChange={(e) => setFirecrawlApiKey(e.target.value)}
              placeholder={t.settings.toolsTab.firecrawlKeyPlaceholder}
              helperText={t.settings.toolsTab.firecrawlKeyHint}
              prefixIcon={<Flame size={13} className="text-amber-400" />}
              mono
              actionSlot={
                <a
                  href="https://firecrawl.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[var(--theme-text)] hover:underline flex items-center gap-1 font-normal opacity-80 hover:opacity-100"
                >
                  <span>Получить 1000 бесплатных кредитов</span>
                  <ExternalLink size={10} />
                </a>
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <Input
                label={t.settings.toolsTab.firecrawlUrlLabel}
                value={firecrawlApiUrl}
                onChange={(e) => setFirecrawlApiUrl(e.target.value)}
                placeholder="https://api.firecrawl.dev"
                mono
              />

              <Input
                label={t.settings.toolsTab.searxngUrlLabel}
                value={searxngUrl}
                onChange={(e) => setSearxngUrl(e.target.value)}
                placeholder="http://localhost:8080"
                mono
              />
            </div>
          </div>

          {/* Interactive Live Search Diagnostic Sandbox */}
          <div className="p-4 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-[var(--theme-text)]" />
                <span className="text-xs font-bold text-[var(--theme-text)]">
                  {t.settings.toolsTab.testSearchTitle}
                </span>
              </div>
              {testResult && (
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <Badge variant="success" size="xs">
                    {testResult.engineUsed}
                  </Badge>
                  <Badge variant="neutral" size="xs">
                    {testResult.latencyMs}ms
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
                  placeholder={t.settings.toolsTab.testSearchPlaceholder}
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={handleTestSearch}
                disabled={isTesting || !testQuery.trim()}
                loading={isTesting}
                icon={isTesting ? <RotateCcw size={13} /> : <Play size={13} />}
              >
                {isTesting ? t.settings.toolsTab.testing : t.settings.toolsTab.testSearchBtn}
              </Button>
            </div>

            {/* Test Results Output */}
            {testResult && (
              <div className="space-y-2 pt-2 border-t border-[var(--theme-border)]">
                {testResult.cascadeTrail && testResult.cascadeTrail.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--theme-text-muted)] font-mono flex-wrap">
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
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{testResult.error}</span>
                  </div>
                )}

                {testResult.results.length === 0 && !testResult.error && (
                  <div className="text-xs text-[var(--theme-text-muted)] italic">
                    {t.settings.toolsTab.noResults}
                  </div>
                )}

                {testResult.results.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-[var(--theme-text)] hover:underline flex items-center gap-1 truncate"
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
                    <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </SettingsSection>

      {/* 3. Agent Tools Registry & Toggles */}
      <SettingsSection
        title={t.settings.toolsTab.toolsManagementTitle}
        description={t.settings.toolsTab.toolsManagementDesc}
        actionSlot={
          <div className="flex items-center gap-2 select-none">
            {savingToggles && (
              <span className="text-[10px] font-mono text-[var(--theme-text-muted)] animate-pulse">
                (сохранение...)
              </span>
            )}
            <Button
              variant="secondary"
              size="xs"
              onClick={() => applyBulkPreset('all')}
            >
              {t.settings.toolsTab.enableAll}
            </Button>
            <Button
              variant="accent"
              size="xs"
              onClick={() => applyBulkPreset('recommended')}
            >
              {t.settings.toolsTab.recommendedPreset}
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => applyBulkPreset('readonly')}
            >
              {t.settings.toolsTab.readOnlyPreset}
            </Button>
          </div>
        }
      >
        <Card variant="default" className="space-y-4">
          {toolsSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <Check size={14} />
              <span>{toolsSuccessMsg}</span>
            </div>
          )}

          {loadingTools ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--theme-text-muted)]">
              <RotateCcw size={14} className="animate-spin" />
              <span>Загрузка реестра инструментов...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((catKey) => {
                const catTools = tools.filter((t) => t.category === catKey);
                if (catTools.length === 0) return null;

                return (
                  <div key={catKey} className="space-y-2">
                    <div className="flex items-center gap-2 px-1 pt-1">
                      {getCategoryIcon(catKey)}
                      <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider">
                        {getCategoryLabel(catKey)}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--theme-text-muted)] font-semibold">
                        ({catTools.filter((t) => t.enabled).length}/{catTools.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {catTools.map((tool) => (
                        <div
                          key={tool.id}
                          className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                            tool.enabled
                              ? 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] shadow-xs'
                              : 'bg-[var(--theme-input-bg)] border-dashed border-[var(--theme-border)]/60 opacity-60'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[var(--theme-text)]">
                                &lt;{tool.name}&gt;
                              </span>
                              {tool.requiresApproval && (
                                <Badge variant="warning" size="xs" icon={<Lock size={9} />}>
                                  Approval
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed line-clamp-2">
                              {tool.description}
                            </p>
                          </div>

                          <Toggle
                            checked={tool.enabled}
                            onChange={(val) => handleToggleTool(tool.id, val)}
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </SettingsSection>
    </div>
  );
};
