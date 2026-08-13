export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
}

export class SearxngService {
  private searxngUrl: string;

  constructor(searxngUrl = 'http://localhost:8080') {
    this.searxngUrl = searxngUrl;
  }

  /**
   * Search web via local SearXNG (or fallback to public DuckDuckGo search API)
   */
  public async search(query: string, limit = 5): Promise<SearchResultItem[]> {
    if (!query || !query.trim()) return [];

    // 1. Try local SearXNG instance first
    try {
      const url = `${this.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any;
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results.slice(0, limit).map((r: any) => ({
            title: r.title || 'Untitled',
            url: r.url || '',
            snippet: r.content || r.snippet || '',
            engine: r.engine || 'searxng',
          }));
        }
      }
    } catch {
      // SearXNG not available (Docker off) - fall back to DuckDuckGo
    }

    // 2. Fallback: Public DuckDuckGo search API / Lite Parser
    return this.fallbackDuckDuckGoSearch(query, limit);
  }

  /**
   * Fallback DuckDuckGo search without API keys
   */
  private async fallbackDuckDuckGoSearch(query: string, limit: number): Promise<SearchResultItem[]> {
    const results: SearchResultItem[] = [];

    // 1. Try DuckDuckGo Instant Answer API first
    try {
      const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const apiRes = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (apiRes.ok) {
        const json = (await apiRes.json()) as any;
        if (json.AbstractText && json.AbstractURL) {
          results.push({
            title: json.Heading || query,
            url: json.AbstractURL,
            snippet: json.AbstractText,
            engine: 'duckduckgo-instant',
          });
        }
        if (Array.isArray(json.RelatedTopics)) {
          for (const topic of json.RelatedTopics) {
            if (results.length >= limit) break;
            if (topic.FirstURL && topic.Text) {
              results.push({
                title: topic.Text.substring(0, 60),
                url: topic.FirstURL,
                snippet: topic.Text,
                engine: 'duckduckgo-instant',
              });
            }
          }
        }
      }
    } catch {}

    if (results.length >= limit) return results.slice(0, limit);

    // 2. HTML DuckDuckGo fallback
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const linkRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippetRegex = /<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

        const urls: { url: string; title: string }[] = [];
        let match: RegExpExecArray | null;

        while ((match = linkRegex.exec(html)) !== null && urls.length < limit) {
          let rawUrl = match[1];
          if (rawUrl.includes('uddg=')) {
            const extracted = rawUrl.split('uddg=')[1]?.split('&')[0];
            if (extracted) rawUrl = decodeURIComponent(extracted);
          }
          const title = match[2].replace(/<[^>]+>/g, '').trim();
          if (rawUrl && title) {
            urls.push({ url: rawUrl, title });
          }
        }

        const snippets: string[] = [];
        while ((match = snippetRegex.exec(html)) !== null && snippets.length < limit) {
          snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
        }

        for (let i = 0; i < urls.length; i++) {
          if (!results.some((r) => r.url === urls[i].url)) {
            results.push({
              title: urls[i].title,
              url: urls[i].url,
              snippet: snippets[i] || urls[i].title,
              engine: 'duckduckgo-html',
            });
          }
        }
      }
    } catch (err) {
      console.warn('[SearxngService] DuckDuckGo HTML fallback error:', err);
    }

    return results.slice(0, limit);
  }
}

export const searxngService = new SearxngService();
