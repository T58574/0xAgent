export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
}

import { proxyService } from './proxyService';

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class SearxngService {
  private searxngUrl: string;

  constructor(searxngUrl = 'http://localhost:8080') {
    this.searxngUrl = searxngUrl;
  }

  /**
   * Search web with multi-tier fallback:
   * 1. Local SearXNG (if Docker container is running)
   * 2. DuckDuckGo HTML Search (primary public web scraper)
   * 3. DuckDuckGo Instant Answer API
   * 4. Wikipedia OpenSearch API (for encyclopedic / fact queries)
   */
  public async search(query: string, limit = 5, customSearxngUrl?: string | null): Promise<SearchResultItem[]> {
    if (!query || !query.trim()) return [];

    const cleanQuery = query.trim();

    // 1. Try local SearXNG instance
    try {
      const results = await this.searchSearxng(cleanQuery, limit, customSearxngUrl);
      if (results.length > 0) return results;
    } catch {
      // SearXNG not running, proceed to fallbacks
    }

    // 2. DuckDuckGo HTML Search
    try {
      const ddgResults = await this.searchDuckDuckGoHtml(cleanQuery, limit);
      if (ddgResults.length > 0) {
        return ddgResults;
      }
    } catch (err) {
      console.warn('[SearxngService] DuckDuckGo HTML search error:', err);
    }

    // 3. DuckDuckGo Instant API
    try {
      const instantResults = await this.searchDuckDuckGoInstant(cleanQuery, limit);
      if (instantResults.length > 0) {
        return instantResults;
      }
    } catch (err) {
      console.warn('[SearxngService] DuckDuckGo Instant API error:', err);
    }

    // 4. Wikipedia OpenSearch Fallback
    try {
      const wikiResults = await this.searchWikipedia(cleanQuery, limit);
      if (wikiResults.length > 0) {
        return wikiResults;
      }
    } catch (err) {
      console.warn('[SearxngService] Wikipedia search error:', err);
    }

    return [];
  }

  /**
   * Search using SearXNG instance
   */
  public async searchSearxng(query: string, limit = 5, customUrl?: string | null): Promise<SearchResultItem[]> {
    const baseUrl = (customUrl && customUrl.trim() ? customUrl.trim() : this.searxngUrl).replace(/\/+$/, '');
    const url = `${baseUrl}/search?q=${encodeURIComponent(query.trim())}&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any;
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results.slice(0, limit).map((r: any) => ({
            title: decodeHtmlEntities(r.title || 'Untitled'),
            url: r.url || '',
            snippet: decodeHtmlEntities(r.content || r.snippet || ''),
            engine: r.engine || 'searxng',
          }));
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
    return [];
  }

  /**
   * Scrape DuckDuckGo HTML search results
   */
  public async searchDuckDuckGoHtml(query: string, limit = 5): Promise<SearchResultItem[]> {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await proxyService.fetchWithProxy(
      ddgUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: controller.signal,
      },
      'web_search'
    );
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`DDG returned status ${res.status}`);
    const html = await res.text();

    // Regex matching result link regardless of attribute order
    const linkRegex = /<a\s+[^>]*?class="[^"]*?result__a[^"]*?"[^>]*?href="([^"]+)"[^>]*?>([\s\S]*?)<\/a>|<a\s+[^>]*?href="([^"]+)"[^>]*?class="[^"]*?result__a[^"]*?"[^>]*?>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<(?:a|div)\s+[^>]*?class="[^"]*?result__snippet[^"]*?"[^>]*?>([\s\S]*?)<\/(?:a|div)>/gi;

    const urls: { url: string; title: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null && urls.length < limit) {
      let rawUrl = match[1] || match[3] || '';
      const rawTitle = match[2] || match[4] || '';

      if (rawUrl.includes('uddg=')) {
        const extracted = rawUrl.split('uddg=')[1]?.split('&')[0];
        if (extracted) rawUrl = decodeURIComponent(extracted);
      } else if (rawUrl.startsWith('//')) {
        rawUrl = 'https:' + rawUrl;
      }

      const title = decodeHtmlEntities(rawTitle);
      if (rawUrl && title && !rawUrl.includes('duckduckgo.com/y.js')) {
        urls.push({ url: rawUrl, title });
      }
    }

    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < limit) {
      snippets.push(decodeHtmlEntities(match[1]));
    }

    const results: SearchResultItem[] = [];
    for (let i = 0; i < urls.length; i++) {
      if (!results.some((r) => r.url === urls[i].url)) {
        results.push({
          title: urls[i].title,
          url: urls[i].url,
          snippet: snippets[i] || urls[i].title,
          engine: 'duckduckgo',
        });
      }
    }

    return results;
  }

  /**
   * DuckDuckGo Instant Answer API
   */
  public async searchDuckDuckGoInstant(query: string, limit: number): Promise<SearchResultItem[]> {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const apiRes = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    const results: SearchResultItem[] = [];
    if (apiRes.ok) {
      const json = (await apiRes.json()) as any;
      if (json.AbstractText && json.AbstractURL) {
        results.push({
          title: decodeHtmlEntities(json.Heading || query),
          url: json.AbstractURL,
          snippet: decodeHtmlEntities(json.AbstractText),
          engine: 'duckduckgo-instant',
        });
      }
      if (Array.isArray(json.RelatedTopics)) {
        for (const topic of json.RelatedTopics) {
          if (results.length >= limit) break;
          if (topic.FirstURL && topic.Text) {
            results.push({
              title: decodeHtmlEntities(topic.Text.substring(0, 60)),
              url: topic.FirstURL,
              snippet: decodeHtmlEntities(topic.Text),
              engine: 'duckduckgo-instant',
            });
          }
        }
      }
    }
    return results;
  }

  /**
   * Wikipedia OpenSearch API
   */
  public async searchWikipedia(query: string, limit: number): Promise<SearchResultItem[]> {
    const lang = /[а-яА-ЯёЁ]/.test(query) ? 'ru' : 'en';
    const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      headers: { 'User-Agent': '0xAgent/1.0 (local AI assistant)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    const [, titles, descriptions, urls] = data;
    const results: SearchResultItem[] = [];

    if (Array.isArray(titles) && Array.isArray(urls)) {
      for (let i = 0; i < titles.length; i++) {
        if (urls[i] && titles[i]) {
          results.push({
            title: decodeHtmlEntities(titles[i]),
            url: urls[i],
            snippet: decodeHtmlEntities(descriptions[i] || titles[i]),
            engine: 'wikipedia',
          });
        }
      }
    }
    return results;
  }
}

export const searxngService = new SearxngService();
