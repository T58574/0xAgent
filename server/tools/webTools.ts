import fs from 'node:fs';
import { fffService } from '../fffService';
import { searchEngineRegistry } from '../searchEngineRegistry';
import { webReaderService } from '../webReaderService';
import { firecrawlService } from '../firecrawlService';
import { loadConfig } from '../config';

export async function executeFffSearch(workspaceDir: string | null | undefined, query: string): Promise<string> {
  const rootDir = workspaceDir && fs.existsSync(workspaceDir) ? workspaceDir : process.cwd();
  const results = await fffService.searchFiles(rootDir, query, 30);

  if (results.length === 0) {
    return `[FFF Search] No matching files found for query: "${query}"`;
  }

  const lines = results.map((r, i) => `${i + 1}. ${r.relativePath}`);
  return `[FFF Search Results for "${query}"] (Found ${results.length} files):\n${lines.join('\n')}`;
}

export async function executeWebSearch(query: string): Promise<string> {
  if (!query || !query.trim()) {
    return '[Web Search Error]: Query string is empty.';
  }

  const config = loadConfig();
  const { results, engineUsed, latencyMs, error } = await searchEngineRegistry.search(query, 5, config);

  if (results.length === 0) {
    return `[Web Search (${engineUsed})]: No results found online for "${query}". ${error ? `(${error})` : ''}`;
  }

  const formatted = results.map((r, i) => {
    return `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\nSource Engine: ${r.engine || engineUsed}\n`;
  });

  return `[Web Search Results for "${query}"] (Engine: ${engineUsed}, Latency: ${latencyMs}ms):\n\n${formatted.join('\n')}`;
}

export async function executeReadWebPage(urlStr: string): Promise<string> {
  if (!urlStr || !urlStr.trim()) {
    return '[Read Web Page Error]: URL string is empty.';
  }

  const config = loadConfig();

  // If Firecrawl is configured or preferred, attempt Firecrawl scraper first
  if (config.firecrawl_api_key?.trim() || config.web_search_provider === 'firecrawl') {
    try {
      return await firecrawlService.scrape(urlStr, config.firecrawl_api_key, config.firecrawl_api_url, 6000);
    } catch {
      // Fallback to standard web reader
    }
  }

  try {
    return await webReaderService.readPage(urlStr, 6000);
  } catch (err: any) {
    return `[Read Web Page Error]: Failed to read page ${urlStr}: ${err?.message || err}`;
  }
}

