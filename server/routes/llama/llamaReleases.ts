let cachedLlamaReleases: any[] | null = null;
let lastLlamaFetchTime: number = 0;
const LLAMA_RELEASES_TTL_MS = 15 * 60 * 1000;

export async function fetchLlamaReleases(forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  if (!forceRefresh && cachedLlamaReleases && now - lastLlamaFetchTime < LLAMA_RELEASES_TTL_MS) {
    return cachedLlamaReleases;
  }

  const response = await fetch('https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=15', {
    headers: { 'User-Agent': '0xAgent-LocalApp' },
  });

  if (!response.ok) {
    if (cachedLlamaReleases) return cachedLlamaReleases;
    throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
  }

  const releases: any[] = await response.json();
  const formatted = releases.map((rel) => ({
    tag: rel.tag_name,
    name: rel.name || rel.tag_name,
    published_at: rel.published_at,
    assets: (rel.assets || [])
      .filter((a: any) => a.name.endsWith('.zip') || a.name.endsWith('.tar.gz') || a.name.endsWith('.exe'))
      .map((a: any) => ({
        name: a.name,
        download_url: a.browser_download_url,
        size: `${(a.size / (1024 * 1024)).toFixed(1)} MB`,
      })),
  }));

  cachedLlamaReleases = formatted;
  lastLlamaFetchTime = now;
  return formatted;
}
