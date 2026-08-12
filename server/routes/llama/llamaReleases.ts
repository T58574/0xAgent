import { Router } from 'express';

let cachedLlamaReleases: any[] | null = null;
let lastLlamaFetchTime: number = 0;
const LLAMA_RELEASES_TTL_MS = 15 * 60 * 1000;

export function createLlamaReleasesRouter(): Router {
  const router = Router();

  router.get('/llama-releases', async (_req, res) => {
    try {
      const now = Date.now();
      if (cachedLlamaReleases && now - lastLlamaFetchTime < LLAMA_RELEASES_TTL_MS) {
        return res.json({ releases: cachedLlamaReleases, cached: true });
      }

      const response = await fetch('https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=10', {
        headers: { 'User-Agent': '0xAgent-Local-IDE/1.0' },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const releasesData: any[] = await response.json();
      const parsedReleases = releasesData.map((r) => ({
        tag_name: r.tag_name,
        name: r.name,
        published_at: r.published_at,
        assets: (r.assets || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          size: a.size,
          browser_download_url: a.browser_download_url,
        })),
      }));

      cachedLlamaReleases = parsedReleases;
      lastLlamaFetchTime = now;

      res.json({ releases: parsedReleases, cached: false });
    } catch (err: any) {
      if (cachedLlamaReleases) {
        return res.json({ releases: cachedLlamaReleases, cached: true, error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
