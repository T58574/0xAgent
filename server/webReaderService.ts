export class WebReaderService {
  /**
   * Fetch a URL and convert it into clean, compressed, token-friendly Markdown.
   */
  public async readPage(urlStr: string, maxChars = 6000): Promise<string> {
    if (!urlStr || !urlStr.startsWith('http')) {
      throw new Error('Invalid URL format. Must start with http:// or https://');
    }

    try {
      // 1. Attempt fetching via Jina Reader API first (returns pristine Markdown)
      const jinaResult = await this.fetchJinaReader(urlStr, maxChars);
      if (jinaResult) {
        return jinaResult;
      }
    } catch {
      // Fallback to local HTML parser below
    }

    // 2. Fallback: Native lightweight HTML-to-Markdown extractor
    return this.fetchAndCleanLocal(urlStr, maxChars);
  }

  /**
   * Fast Jina Reader API Markdown fetcher (r.jina.ai)
   */
  private async fetchJinaReader(targetUrl: string, maxChars: number): Promise<string | null> {
    try {
      const jinaUrl = `https://r.jina.ai/${targetUrl}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(jinaUrl, {
        headers: {
          'Accept': 'text/plain',
          'X-With-Generated-Alt': 'true',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        let text = await response.text();
        text = text.trim();

        if (text.length > maxChars) {
          text = text.substring(0, maxChars) + `\n\n[... Content truncated to ${maxChars} chars for LLM context economy ...]`;
        }
        return `[Source: ${targetUrl}]\n\n${text}`;
      }
    } catch {
      // Ignore and fallback
    }
    return null;
  }

  /**
   * Local HTML cleaner that removes ads, scripts, nav, and formats to Markdown
   */
  private async fetchAndCleanLocal(targetUrl: string, maxChars: number): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: Failed to fetch page content from ${targetUrl}`);
    }

    let html = await res.text();

    // 1. Remove non-content tags
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    // 2. Convert basic HTML formatting to Markdown
    let md = html
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n#### $1\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

    // Strip remaining HTML tags
    md = md.replace(/<[^>]+>/g, '');

    // Clean extra whitespace
    md = md
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');

    if (md.length > maxChars) {
      md = md.substring(0, maxChars) + `\n\n[... Content truncated to ${maxChars} chars for LLM context economy ...]`;
    }

    return `[Source: ${targetUrl}]\n\n${md}`;
  }
}

export const webReaderService = new WebReaderService();
