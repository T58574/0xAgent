import { AppConfig, SearchEngineInfo, WebSearchProvider } from '../src/types';
import { SearchResultItem, searxngService } from './searxngService';
import { firecrawlService } from './firecrawlService';

export interface UnifiedSearchResult {
  results: SearchResultItem[];
  engineUsed: string;
  latencyMs: number;
  error?: string;
  cascadeTrail?: string[];
}

export interface SearchEngineProvider {
  id: WebSearchProvider;
  name: string;
  description: string;
  requiresKey: boolean;
  defaultUrl?: string;
  isConfigured: (config: AppConfig) => boolean;
  isAvailable: (config: AppConfig) => Promise<boolean>;
  search: (query: string, limit: number, config: AppConfig) => Promise<SearchResultItem[]>;
  test?: (config: AppConfig) => Promise<{ ok: boolean; latencyMs: number; message?: string }>;
}

class SearchEngineRegistry {
  private providers: Map<string, SearchEngineProvider> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public register(provider: SearchEngineProvider): void {
    this.providers.set(provider.id, provider);
  }

  public get(id: string): SearchEngineProvider | undefined {
    return this.providers.get(id);
  }

  public getAll(): SearchEngineProvider[] {
    return Array.from(this.providers.values());
  }

  public async getEngineInfoList(config: AppConfig): Promise<SearchEngineInfo[]> {
    const list: SearchEngineInfo[] = [
      {
        id: 'auto',
        name: 'Auto Cascade',
        description: 'Smart auto-fallback: Firecrawl -> SearXNG -> DuckDuckGo -> Wikipedia',
        requiresKey: false,
        isConfigured: true,
        isAvailable: true,
      },
    ];

    for (const provider of this.providers.values()) {
      let available = true;
      try {
        available = await provider.isAvailable(config);
      } catch {
        available = false;
      }

      list.push({
        id: provider.id,
        name: provider.name,
        description: provider.description,
        requiresKey: provider.requiresKey,
        defaultUrl: provider.defaultUrl,
        isConfigured: provider.isConfigured(config),
        isAvailable: available,
      });
    }

    return list;
  }

  private registerDefaults(): void {
    // 1. Firecrawl Engine Provider
    this.register({
      id: 'firecrawl',
      name: 'Firecrawl',
      description: 'Markdown-optimized web search & deep scraping (Keyless / Cloud API / Self-Hosted)',
      requiresKey: false,
      defaultUrl: 'https://api.firecrawl.dev',
      isConfigured: (cfg) => Boolean(cfg.firecrawl_api_key?.trim() || cfg.firecrawl_api_url?.trim()),
      isAvailable: async (_cfg) => true,
      search: async (query, limit, cfg) => {
        return firecrawlService.search(query, limit, cfg.firecrawl_api_key, cfg.firecrawl_api_url);
      },
      test: async (cfg) => {
        return firecrawlService.testConnection(cfg.firecrawl_api_key, cfg.firecrawl_api_url);
      },
    });

    // 2. SearXNG Engine Provider
    this.register({
      id: 'searxng',
      name: 'SearXNG',
      description: 'Self-hosted privacy-focused metasearch engine (Docker or remote)',
      requiresKey: false,
      defaultUrl: 'http://localhost:8080',
      isConfigured: (cfg) => Boolean(cfg.searxng_url?.trim()),
      isAvailable: async (cfg) => {
        try {
          const url = (cfg.searxng_url || 'http://localhost:8080').replace(/\/+$/, '') + '/search?q=test&format=json';
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 2000);
          const res = await fetch(url, { signal: ctrl.signal });
          clearTimeout(t);
          return res.ok;
        } catch {
          return false;
        }
      },
      search: async (query, limit, cfg) => {
        return searxngService.searchSearxng(query, limit, cfg.searxng_url);
      },
      test: async (cfg) => {
        const start = Date.now();
        try {
          const res = await searxngService.searchSearxng('test', 1, cfg.searxng_url);
          const latencyMs = Date.now() - start;
          return { ok: res.length > 0, latencyMs, message: `SearXNG OK (${latencyMs}ms)` };
        } catch (err: any) {
          return { ok: false, latencyMs: Date.now() - start, message: err?.message || 'SearXNG unreachable' };
        }
      },
    });

    // 3. DuckDuckGo Engine Provider
    this.register({
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      description: 'Free public web search & instant answer scraper (No API key needed)',
      requiresKey: false,
      isConfigured: () => true,
      isAvailable: async () => true,
      search: async (query, limit) => {
        let results = await searxngService.searchDuckDuckGoHtml(query, limit);
        if (results.length === 0) {
          results = await searxngService.searchDuckDuckGoInstant(query, limit);
        }
        return results;
      },
      test: async () => {
        const start = Date.now();
        try {
          const res = await searxngService.searchDuckDuckGoHtml('wikipedia', 1);
          const latencyMs = Date.now() - start;
          return { ok: res.length > 0, latencyMs, message: `DuckDuckGo OK (${latencyMs}ms)` };
        } catch (err: any) {
          return { ok: false, latencyMs: Date.now() - start, message: err?.message || 'DDG error' };
        }
      },
    });

    // 4. Wikipedia OpenSearch Engine Provider
    this.register({
      id: 'wikipedia',
      name: 'Wikipedia',
      description: 'Encyclopedic knowledge and verified facts via MediaWiki OpenSearch API',
      requiresKey: false,
      isConfigured: () => true,
      isAvailable: async () => true,
      search: async (query, limit) => {
        return searxngService.searchWikipedia(query, limit);
      },
      test: async () => {
        const start = Date.now();
        try {
          const res = await searxngService.searchWikipedia('Software', 1);
          const latencyMs = Date.now() - start;
          return { ok: res.length > 0, latencyMs, message: `Wikipedia OK (${latencyMs}ms)` };
        } catch (err: any) {
          return { ok: false, latencyMs: Date.now() - start, message: err?.message || 'Wikipedia error' };
        }
      },
    });
  }

  /**
   * Unified search dispatcher
   */
  public async search(
    query: string,
    limit = 5,
    config: AppConfig
  ): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    const providerId = (config.web_search_provider || 'auto').toLowerCase();
    const cascadeTrail: string[] = [];

    // Mode: Explicit Single Provider
    if (providerId !== 'auto' && this.providers.has(providerId)) {
      const provider = this.providers.get(providerId)!;
      try {
        cascadeTrail.push(provider.name);
        const results = await provider.search(query, limit, config);
        if (results.length > 0) {
          return {
            results,
            engineUsed: provider.name,
            latencyMs: Date.now() - startTime,
            cascadeTrail,
          };
        }
      } catch (err: any) {
        console.warn(`[SearchEngineRegistry] Provider ${providerId} failed:`, err?.message || err);
      }
    }

    // Mode: Auto Cascade Fallback
    // 1. Try Firecrawl (if key exists, or try keyless)
    const firecrawl = this.providers.get('firecrawl');
    if (firecrawl && (config.firecrawl_api_key || providerId === 'auto')) {
      try {
        cascadeTrail.push('Firecrawl');
        const fcResults = await firecrawl.search(query, limit, config);
        if (fcResults.length > 0) {
          return {
            results: fcResults,
            engineUsed: 'Firecrawl',
            latencyMs: Date.now() - startTime,
            cascadeTrail,
          };
        }
      } catch (err: any) {
        // Firecrawl failed (e.g. rate limit, keyless IP block), smoothly cascade
      }
    }

    // 2. Try SearXNG (if local/remote instance configured)
    const searxng = this.providers.get('searxng');
    if (searxng) {
      try {
        cascadeTrail.push('SearXNG');
        const sxResults = await searxng.search(query, limit, config);
        if (sxResults.length > 0) {
          return {
            results: sxResults,
            engineUsed: 'SearXNG',
            latencyMs: Date.now() - startTime,
            cascadeTrail,
          };
        }
      } catch {
        // SearXNG offline, cascade
      }
    }

    // 3. Try DuckDuckGo
    const ddg = this.providers.get('duckduckgo');
    if (ddg) {
      try {
        cascadeTrail.push('DuckDuckGo');
        const ddgResults = await ddg.search(query, limit, config);
        if (ddgResults.length > 0) {
          return {
            results: ddgResults,
            engineUsed: 'DuckDuckGo',
            latencyMs: Date.now() - startTime,
            cascadeTrail,
          };
        }
      } catch {
        // DDG failed, cascade
      }
    }

    // 4. Try Wikipedia
    const wiki = this.providers.get('wikipedia');
    if (wiki) {
      try {
        cascadeTrail.push('Wikipedia');
        const wikiResults = await wiki.search(query, limit, config);
        if (wikiResults.length > 0) {
          return {
            results: wikiResults,
            engineUsed: 'Wikipedia',
            latencyMs: Date.now() - startTime,
            cascadeTrail,
          };
        }
      } catch {
        // Wikipedia failed
      }
    }

    return {
      results: [],
      engineUsed: 'none',
      latencyMs: Date.now() - startTime,
      cascadeTrail,
      error: `No search results found for "${query}" across attempted engines: ${cascadeTrail.join(' -> ')}`,
    };
  }
}

export const searchEngineRegistry = new SearchEngineRegistry();

export function registerSearchEngineProvider(provider: SearchEngineProvider): void {
  searchEngineRegistry.register(provider);
}
