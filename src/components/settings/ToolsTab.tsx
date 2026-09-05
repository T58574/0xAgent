import React, { useState, useEffect } from 'react';
import { Globe, Activity, Wrench } from 'lucide-react';
import { SearchEngineInfo, ToolDefinition, WebSearchProvider } from '../../types';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { SettingsHeader } from './common';
import { WebSearchConfigSection } from './tools/WebSearchConfigSection';
import { ToolsRegistrySection } from './tools/ToolsRegistrySection';
import { SearchEngineTester, SearchTestResult } from './tools/SearchEngineTester';

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

type ToolsSubtab = 'search' | 'registry' | 'tester';

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

  // Active Subtab View
  const [activeSubtab, setActiveSubtab] = useState<ToolsSubtab>('search');

  // Search Engines list & testing state
  const [engines, setEngines] = useState<SearchEngineInfo[]>([]);
  const [testQuery, setTestQuery] = useState('react 19 server components');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<SearchTestResult | null>(null);

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
      setToolsSuccessMsg(t.settings.toolsTab.presetAppliedSuccess);
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

  const activeToolsCount = tools.filter((t) => t.enabled).length;

  return (
    <div className="w-full space-y-6 pb-10 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header */}
      <SettingsHeader
        title={t.settings.toolsTab.title}
        subtitle={t.settings.toolsTab.subtitle}
        icon={<Wrench size={18} />}
        actionSlot={
          activeSubtab === 'registry' ? (
            <div className="flex items-center gap-1.5 select-none">
              {savingToggles && (
                <span className="text-[10px] font-mono text-[var(--theme-text-muted)] animate-pulse mr-1">
                  ({t.settings.saving})
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
          ) : undefined
        }
      />

      {/* 2. Sub-Navigation Tabs Bar (Segmented Pills) */}
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubtab('search')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'search'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Globe size={14} className={activeSubtab === 'search' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.toolsTab.subtabSearch}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] uppercase">
            {webSearchProvider}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('registry')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'registry'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Wrench size={14} className={activeSubtab === 'registry' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.toolsTab.subtabRegistry}</span>
          {tools.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
              {activeToolsCount}/{tools.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('tester')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'tester'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Activity size={14} className={activeSubtab === 'tester' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.toolsTab.subtabTester}</span>
          {testResult && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              {testResult.latencyMs}ms
            </span>
          )}
        </button>
      </div>

      {/* Subtab 1: Web Search */}
      {activeSubtab === 'search' && (
        <WebSearchConfigSection
          webSearchProvider={webSearchProvider}
          setWebSearchProvider={setWebSearchProvider}
          firecrawlApiKey={firecrawlApiKey}
          setFirecrawlApiKey={setFirecrawlApiKey}
          firecrawlApiUrl={firecrawlApiUrl}
          setFirecrawlApiUrl={setFirecrawlApiUrl}
          searxngUrl={searxngUrl}
          setSearxngUrl={setSearxngUrl}
          engines={engines}
        />
      )}

      {/* Subtab 2: Tools Registry */}
      {activeSubtab === 'registry' && (
        <ToolsRegistrySection
          tools={tools}
          loadingTools={loadingTools}
          toolsSuccessMsg={toolsSuccessMsg}
          onToggleTool={handleToggleTool}
        />
      )}

      {/* Subtab 3: Search Tester */}
      {activeSubtab === 'tester' && (
        <SearchEngineTester
          testQuery={testQuery}
          setTestQuery={setTestQuery}
          isTesting={isTesting}
          onRunTest={handleTestSearch}
          testResult={testResult}
        />
      )}
    </div>
  );
};
