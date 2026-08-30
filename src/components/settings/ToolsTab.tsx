import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  Flame,
  Shield,
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
  Eye,
  EyeOff,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { SearchEngineInfo, ToolDefinition, WebSearchProvider } from '../../types';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';

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
  const [showApiKey, setShowApiKey] = useState(false);
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
        const isReadonly = ['read_file', 'list_dir', 'grep_search', 'fff_search', 'get_file_info', 'web_search', 'read_web_page', 'recall_memories', 'search_knowledge', 'list_knowledge', 'search_sessions'].includes(tool.id);
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
        return <Sparkles size={16} className="text-cyan-400" />;
      case 'firecrawl':
        return <Flame size={16} className="text-amber-400" />;
      case 'searxng':
        return <Globe size={16} className="text-emerald-400" />;
      case 'duckduckgo':
        return <Zap size={16} className="text-orange-400" />;
      case 'wikipedia':
        return <BookOpen size={16} className="text-indigo-400" />;
      default:
        return <Search size={16} className="text-[var(--theme-accent)]" />;
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

  // Group tools by category
  const categories = ['files', 'web', 'terminal', 'memory', 'interactive'] as const;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-6 font-sans text-[var(--theme-text)]">
      
      {/* Top Banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl bento-card border border-[var(--theme-border)] bg-[var(--theme-panel)]">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-accent)] shrink-0">
          <Globe size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-[var(--theme-text)]">
            {t.settings.toolsTab.title}
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)]">
            {t.settings.toolsTab.subtitle}
          </p>
        </div>
      </div>

      {/* SECTION 1: Web Search Engine Configuration */}
      <div className="flex flex-col gap-4 p-5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-panel)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-[var(--theme-accent)]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
              {t.settings.toolsTab.searchEngineTitle}
            </h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
            {webSearchProvider === 'auto' ? 'Auto Cascade' : webSearchProvider.toUpperCase()}
          </span>
        </div>

        <p className="text-xs text-[var(--theme-text-muted)]">
          {t.settings.toolsTab.searchEngineDesc}
        </p>

        {/* Search Engine Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {/* 1. Auto Cascade Card */}
          <button
            type="button"
            onClick={() => setWebSearchProvider('auto')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              webSearchProvider === 'auto'
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)] shadow-xs'
                : 'bg-[var(--theme-bg)]/40 border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {getEngineIcon('auto')}
                <span className="text-xs font-bold text-[var(--theme-text)]">Auto Cascade</span>
              </div>
              {webSearchProvider === 'auto' && (
                <Check size={14} className="text-[var(--theme-accent)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              Firecrawl → SearXNG → DuckDuckGo → Wikipedia
            </p>
          </button>

          {/* 2. Firecrawl Card */}
          <button
            type="button"
            onClick={() => setWebSearchProvider('firecrawl')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              webSearchProvider === 'firecrawl'
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)] shadow-xs'
                : 'bg-[var(--theme-bg)]/40 border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {getEngineIcon('firecrawl')}
                <span className="text-xs font-bold text-[var(--theme-text)]">Firecrawl</span>
              </div>
              {webSearchProvider === 'firecrawl' && (
                <Check size={14} className="text-[var(--theme-accent)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              Чистый Markdown и глубокий скрейпинг страниц
            </p>
          </button>

          {/* 3. SearXNG Card */}
          <button
            type="button"
            onClick={() => setWebSearchProvider('searxng')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              webSearchProvider === 'searxng'
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)] shadow-xs'
                : 'bg-[var(--theme-bg)]/40 border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {getEngineIcon('searxng')}
                <span className="text-xs font-bold text-[var(--theme-text)]">SearXNG</span>
              </div>
              {webSearchProvider === 'searxng' && (
                <Check size={14} className="text-[var(--theme-accent)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              Локальный приватный мета-поисковик (Docker / URL)
            </p>
          </button>

          {/* 4. DuckDuckGo Card */}
          <button
            type="button"
            onClick={() => setWebSearchProvider('duckduckgo')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              webSearchProvider === 'duckduckgo'
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)] shadow-xs'
                : 'bg-[var(--theme-bg)]/40 border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {getEngineIcon('duckduckgo')}
                <span className="text-xs font-bold text-[var(--theme-text)]">DuckDuckGo</span>
              </div>
              {webSearchProvider === 'duckduckgo' && (
                <Check size={14} className="text-[var(--theme-accent)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              Бесплатный поиск без ключа и регистрации
            </p>
          </button>

          {/* 5. Wikipedia Card */}
          <button
            type="button"
            onClick={() => setWebSearchProvider('wikipedia')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              webSearchProvider === 'wikipedia'
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)] shadow-xs'
                : 'bg-[var(--theme-bg)]/40 border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {getEngineIcon('wikipedia')}
                <span className="text-xs font-bold text-[var(--theme-text)]">Wikipedia</span>
              </div>
              {webSearchProvider === 'wikipedia' && (
                <Check size={14} className="text-[var(--theme-accent)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              Энциклопедические факты через OpenSearch API
            </p>
          </button>

          {/* Dynamic/Custom Registered Search Engines */}
          {engines
            .filter((e) => !['auto', 'firecrawl', 'searxng', 'duckduckgo', 'wikipedia'].includes(e.id))
            .map((eng) => (
              <button
                key={eng.id}
                type="button"
                onClick={() => setWebSearchProvider(eng.id)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  webSearchProvider === eng.id
                    ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)] shadow-xs'
                    : 'bg-[var(--theme-bg)]/40 border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {getEngineIcon(eng.id)}
                    <span className="text-xs font-bold text-[var(--theme-text)]">{eng.name}</span>
                  </div>
                  {webSearchProvider === eng.id && (
                    <Check size={14} className="text-[var(--theme-accent)]" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                  {eng.description}
                </p>
              </button>
            ))}
        </div>

        {/* Engine Credentials & Custom Endpoints */}
        <div className="flex flex-col gap-3 pt-2 border-t border-[var(--theme-border)]">
          {/* Firecrawl API Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
                <Flame size={13} className="text-amber-400" />
                <span>{t.settings.toolsTab.firecrawlKeyLabel}</span>
              </label>
              <a
                href="https://firecrawl.dev"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[var(--theme-accent)] hover:underline flex items-center gap-1"
              >
                <span>Получить 1000 бесплатных кредитов</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative flex items-center">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={firecrawlApiKey}
                onChange={(e) => setFirecrawlApiKey(e.target.value)}
                placeholder={t.settings.toolsTab.firecrawlKeyPlaceholder}
                className="w-full px-3 py-2 pr-10 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-accent)] font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <span className="text-[10px] text-[var(--theme-text-muted)]">
              {t.settings.toolsTab.firecrawlKeyHint}
            </span>
          </div>

          {/* Advanced URLs in 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                {t.settings.toolsTab.firecrawlUrlLabel}
              </label>
              <input
                type="text"
                value={firecrawlApiUrl}
                onChange={(e) => setFirecrawlApiUrl(e.target.value)}
                placeholder="https://api.firecrawl.dev"
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] font-mono focus:outline-none focus:border-[var(--theme-accent)]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                {t.settings.toolsTab.searxngUrlLabel}
              </label>
              <input
                type="text"
                value={searxngUrl}
                onChange={(e) => setSearxngUrl(e.target.value)}
                placeholder="http://localhost:8080"
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] font-mono focus:outline-none focus:border-[var(--theme-accent)]"
              />
            </div>
          </div>
        </div>

        {/* Interactive Live Search Diagnostic Sandbox */}
        <div className="mt-2 p-4 rounded-xl bg-[var(--theme-bg)]/60 border border-[var(--theme-border)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[var(--theme-accent)]" />
              <span className="text-xs font-bold text-[var(--theme-text)]">
                {t.settings.toolsTab.testSearchTitle}
              </span>
            </div>
            {testResult && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {testResult.engineUsed}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
                  {testResult.latencyMs}ms
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
              placeholder={t.settings.toolsTab.testSearchPlaceholder}
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--theme-panel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)]"
            />
            <button
              type="button"
              onClick={handleTestSearch}
              disabled={isTesting || !testQuery.trim()}
              className="px-4 py-2 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isTesting ? (
                <RotateCcw size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              <span>{isTesting ? t.settings.toolsTab.testing : t.settings.toolsTab.testSearchBtn}</span>
            </button>
          </div>

          {/* Test Results Output */}
          {testResult && (
            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--theme-border)]">
              {testResult.cascadeTrail && testResult.cascadeTrail.length > 1 && (
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--theme-text-muted)] font-mono">
                  <span>{t.settings.toolsTab.cascadeTrail}:</span>
                  {testResult.cascadeTrail.map((hop, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-1.5 py-0.5 rounded bg-white/5 border border-[var(--theme-border)]">
                        {hop}
                      </span>
                      {idx < (testResult.cascadeTrail?.length || 0) - 1 && (
                        <ArrowRight size={10} className="text-[var(--theme-text-muted)]" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {testResult.error && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
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
                  className="p-2.5 rounded-lg bg-[var(--theme-panel)] border border-[var(--theme-border)] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[var(--theme-text)] hover:text-[var(--theme-accent)] flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{item.title}</span>
                      <ExternalLink size={11} className="shrink-0 text-[var(--theme-text-muted)]" />
                    </a>
                    {item.engine && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)] shrink-0">
                        {item.engine}
                      </span>
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
      </div>

      {/* SECTION 2: Agent Tools Registry & Toggles */}
      <div className="flex flex-col gap-4 p-5 rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-panel)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[var(--theme-accent)]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
              {t.settings.toolsTab.toolsManagementTitle}
            </h4>
            {savingToggles && (
              <span className="text-[10px] font-mono text-[var(--theme-accent)] animate-pulse">
                (сохранение...)
              </span>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 select-none">
            <button
              type="button"
              onClick={() => applyBulkPreset('all')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--theme-border)] text-[11px] font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer transition-colors"
            >
              {t.settings.toolsTab.enableAll}
            </button>
            <button
              type="button"
              onClick={() => applyBulkPreset('recommended')}
              className="px-2.5 py-1 rounded-lg bg-[var(--theme-accent)]/10 hover:bg-[var(--theme-accent)]/20 border border-[var(--theme-accent)]/20 text-[11px] font-medium text-[var(--theme-accent)] cursor-pointer transition-colors"
            >
              {t.settings.toolsTab.recommendedPreset}
            </button>
            <button
              type="button"
              onClick={() => applyBulkPreset('readonly')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--theme-border)] text-[11px] font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer transition-colors"
            >
              {t.settings.toolsTab.readOnlyPreset}
            </button>
          </div>
        </div>

        <p className="text-xs text-[var(--theme-text-muted)]">
          {t.settings.toolsTab.toolsManagementDesc}
        </p>

        {toolsSuccessMsg && (
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <Check size={14} />
            <span>{toolsSuccessMsg}</span>
          </div>
        )}

        {/* Categorized Tools List */}
        {loadingTools ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--theme-text-muted)]">
            <RotateCcw size={14} className="animate-spin" />
            <span>Загрузка реестра инструментов...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {categories.map((catKey) => {
              const catTools = tools.filter((t) => t.category === catKey);
              if (catTools.length === 0) return null;

              return (
                <div key={catKey} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1 pt-2">
                    {getCategoryIcon(catKey)}
                    <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider">
                      {getCategoryLabel(catKey)}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                      ({catTools.filter((t) => t.enabled).length}/{catTools.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {catTools.map((tool) => (
                      <div
                        key={tool.id}
                        className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                          tool.enabled
                            ? 'bg-[var(--theme-bg)]/60 border-[var(--theme-border)]'
                            : 'bg-[var(--theme-bg)]/20 border-dashed border-[var(--theme-border)]/50 opacity-60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[var(--theme-text)]">
                              &lt;{tool.name}&gt;
                            </span>
                            {tool.requiresApproval && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"
                                title="Требует подтверждения пользователя в UI"
                              >
                                <Lock size={9} />
                                <span>Approval</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed line-clamp-2">
                            {tool.description}
                          </p>
                        </div>

                        {/* Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleTool(tool.id, !tool.enabled)}
                          className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 ${
                            tool.enabled ? 'bg-[var(--theme-accent)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              tool.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
