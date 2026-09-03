import React from 'react';
import {
  Flame,
  Check,
  ExternalLink,
} from 'lucide-react';
import { SearchEngineInfo, WebSearchProvider } from '../../../types';
import { useI18n } from '../../../i18n';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { SettingsSection } from '../common';

interface SearchProvidersViewProps {
  webSearchProvider: WebSearchProvider;
  setWebSearchProvider: (val: WebSearchProvider) => void;
  firecrawlApiKey: string;
  setFirecrawlApiKey: (val: string) => void;
  firecrawlApiUrl: string;
  setFirecrawlApiUrl: (val: string) => void;
  searxngUrl: string;
  setSearxngUrl: (val: string) => void;
  engines: SearchEngineInfo[];
  getEngineIcon: (id: string) => React.ReactNode;
}

export const SearchProvidersView: React.FC<SearchProvidersViewProps> = ({
  webSearchProvider,
  setWebSearchProvider,
  firecrawlApiKey,
  setFirecrawlApiKey,
  firecrawlApiUrl,
  setFirecrawlApiUrl,
  searxngUrl,
  setSearxngUrl,
  engines,
  getEngineIcon,
}) => {
  const { t } = useI18n();

  const standardEngines = [
    {
      id: 'auto',
      name: 'Auto Cascade',
      desc: t.settings.toolsTab.engineDescAuto,
    },
    {
      id: 'firecrawl',
      name: 'Firecrawl',
      desc: t.settings.toolsTab.engineDescFirecrawl,
    },
    {
      id: 'searxng',
      name: 'SearXNG',
      desc: t.settings.toolsTab.engineDescSearxng,
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      desc: t.settings.toolsTab.engineDescDuckDuckGo,
    },
    {
      id: 'wikipedia',
      name: 'Wikipedia',
      desc: t.settings.toolsTab.engineDescWikipedia,
    },
  ];

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t.settings.toolsTab.searchEngineTitle}
        badge={webSearchProvider === 'auto' ? 'Auto Cascade' : webSearchProvider.toUpperCase()}
        description={t.settings.toolsTab.searchEngineDesc}
      >
        <Card variant="default" className="p-6 space-y-6 rounded-2xl">
          {/* Search Engine Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {standardEngines.map((eng) => {
              const isSelected = webSearchProvider === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => setWebSearchProvider(eng.id as WebSearchProvider)}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none space-y-2 ${
                    isSelected
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] shadow-xs font-semibold ring-1 ring-[var(--theme-accent)]/30'
                      : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:bg-[var(--theme-border-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {getEngineIcon(eng.id)}
                      <span className="text-xs font-bold text-[var(--theme-text)]">{eng.name}</span>
                    </div>
                    {isSelected && <Check size={14} className="text-[var(--theme-accent)] shrink-0" />}
                  </div>
                  <p className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">{eng.desc}</p>
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
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none space-y-2 ${
                      isSelected
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] shadow-xs font-semibold ring-1 ring-[var(--theme-accent)]/30'
                        : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:bg-[var(--theme-border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {getEngineIcon(eng.id)}
                        <span className="text-xs font-bold text-[var(--theme-text)]">{eng.name}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-[var(--theme-accent)] shrink-0" />}
                    </div>
                    <p className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                      {eng.description}
                    </p>
                  </button>
                );
              })}
          </div>

          {/* Engine Credentials & Custom Endpoints */}
          <div className="space-y-4 pt-3 border-t border-[var(--theme-border)]">
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
                  <span>{t.settings.toolsTab.firecrawlFreeCredits}</span>
                  <ExternalLink size={10} />
                </a>
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
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
        </Card>
      </SettingsSection>
    </div>
  );
};
