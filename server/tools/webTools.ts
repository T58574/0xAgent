import fs from 'node:fs';
import { fffService } from '../fffService';
import { searxngService } from '../searxngService';
import { webReaderService } from '../webReaderService';

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

  const results = await searxngService.search(query, 5);
  if (results.length === 0) {
    return `[Web Search]: No results found online for "${query}".`;
  }

  const formatted = results.map((r, i) => {
    return `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\n`;
  });

  return `[Web Search Results for "${query}"]:\n\n${formatted.join('\n')}`;
}

export async function executeReadWebPage(urlStr: string): Promise<string> {
  if (!urlStr || !urlStr.trim()) {
    return '[Read Web Page Error]: URL string is empty.';
  }

  try {
    return await webReaderService.readPage(urlStr, 6000);
  } catch (err: any) {
    return `[Read Web Page Error]: Failed to read page ${urlStr}: ${err?.message || err}`;
  }
}
