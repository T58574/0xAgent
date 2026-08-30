import { SearchResultItem } from './searxngService';

export interface FirecrawlSearchResult {
  success: boolean;
  data?: Array<{
    url?: string;
    title?: string;
    description?: string;
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  }>;
  error?: string;
  warning?: string;
}

export interface FirecrawlScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

export class FirecrawlService {
  private defaultApiUrl: string;

  constructor(defaultApiUrl = 'https://api.firecrawl.dev') {
    this.defaultApiUrl = defaultApiUrl.replace(/\/+$/, '');
  }

  /**
   * Search the web using Firecrawl API (Keyless or with API key / Self-hosted)
   */
  public async search(
    query: string,
    limit = 5,
    apiKey?: string | null,
    apiUrl?: string | null
  ): Promise<SearchResultItem[]> {
    if (!query || !query.trim()) return [];

    const baseUrl = (apiUrl && apiUrl.trim() ? apiUrl.trim() : this.defaultApiUrl).replace(/\/+$/, '');
    const cleanQuery = query.trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': '0xAgent/1.0 (local AI assistant)',
    };

    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const endpoint = `${baseUrl}/v1/search`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: cleanQuery,
          limit,
          scrapeOptions: {
            formats: ['markdown'],
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = (await response.json()) as FirecrawlSearchResult;

      if (!response.ok || json.success === false) {
        const errMsg = json.error || `HTTP Error ${response.status}`;
        if (errMsg.includes('suspicious') || errMsg.includes('API key')) {
          throw new Error(`Firecrawl Keyless limitation: ${errMsg}`);
        }
        throw new Error(`Firecrawl search failed: ${errMsg}`);
      }

      const results: SearchResultItem[] = [];
      const items = json.data || [];

      for (const item of items) {
        const itemUrl = item.url || item.metadata?.sourceURL || '';
        const itemTitle = item.title || item.metadata?.title || itemUrl || 'Untitled';
        const itemSnippet = item.description || item.metadata?.description || (item.markdown ? item.markdown.substring(0, 300).replace(/\n+/g, ' ') : '');

        if (itemUrl) {
          results.push({
            title: itemTitle.trim(),
            url: itemUrl.trim(),
            snippet: itemSnippet.trim() || itemTitle.trim(),
            engine: 'firecrawl',
          });
        }
      }

      return results;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Scrape a webpage into clean Markdown using Firecrawl
   */
  public async scrape(
    targetUrl: string,
    apiKey?: string | null,
    apiUrl?: string | null,
    maxChars = 8000
  ): Promise<string> {
    if (!targetUrl || !targetUrl.startsWith('http')) {
      throw new Error('Invalid URL format. Must start with http:// or https://');
    }

    const baseUrl = (apiUrl && apiUrl.trim() ? apiUrl.trim() : this.defaultApiUrl).replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': '0xAgent/1.0 (local AI assistant)',
    };

    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const endpoint = `${baseUrl}/v1/scrape`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: targetUrl,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = (await response.json()) as FirecrawlScrapeResult;

      if (!response.ok || json.success === false) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      let markdown = json.data?.markdown || '';
      if (!markdown && json.data?.html) {
        markdown = json.data.html.replace(/<[^>]+>/g, ' ');
      }

      markdown = markdown.trim();
      if (markdown.length > maxChars) {
        markdown = markdown.substring(0, maxChars) + `\n\n[... Content truncated to ${maxChars} chars for LLM context economy ...]`;
      }

      const title = json.data?.metadata?.title;
      return `[Source: ${targetUrl}${title ? ` | ${title}` : ''}]\n\n${markdown}`;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Health check / ping Firecrawl instance
   */
  public async testConnection(
    apiKey?: string | null,
    apiUrl?: string | null
  ): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const startTime = Date.now();
    try {
      const results = await this.search('test', 1, apiKey, apiUrl);
      const latencyMs = Date.now() - startTime;
      return {
        ok: true,
        latencyMs,
        message: results.length > 0 ? `Connected successfully (${latencyMs}ms)` : `Connected (${latencyMs}ms, 0 results)`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        ok: false,
        latencyMs,
        message: err?.message || 'Connection failed',
      };
    }
  }
}

export const firecrawlService = new FirecrawlService();
