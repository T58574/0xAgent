import path from 'node:path';
import fs from 'node:fs';
import { FileFinder } from '@ff-labs/fff-node';

interface FinderInstance {
  finder: any;
  basePath: string;
  isReady: boolean;
}

class FffService {
  private activeFinders: Map<string, FinderInstance> = new Map();

  /**
   * Get or initialize a FileFinder instance for the given directory.
   */
  public async getFinder(dirPath: string): Promise<FinderInstance | null> {
    const normPath = path.normalize(dirPath);
    if (!fs.existsSync(normPath)) return null;

    if (this.activeFinders.has(normPath)) {
      return this.activeFinders.get(normPath)!;
    }

    try {
      const result = FileFinder.create({ basePath: normPath });
      if (!result.ok) {
        console.warn(`[fffService] Failed to create FileFinder for ${normPath}:`, (result as any).error);
        return null;
      }

      const finder = result.value;
      const instance: FinderInstance = {
        finder,
        basePath: normPath,
        isReady: false,
      };

      this.activeFinders.set(normPath, instance);

      // Wait briefly for scan initialization (up to 2 seconds)
      try {
        await finder.waitForScan(2000);
        instance.isReady = true;
      } catch (err) {
        // If scan times out, we still mark it ready to attempt partial searches
        instance.isReady = true;
      }

      return instance;
    } catch (error) {
      console.warn(`[fffService] FFF Native initialization error:`, error);
      return null;
    }
  }

  /**
   * Perform high-speed fuzzy file search in workspace.
   */
  public async searchFiles(workspaceDir: string, query: string, maxResults = 30): Promise<{ relativePath: string; fullPath: string }[]> {
    const instance = await this.getFinder(workspaceDir);
    if (!instance) {
      return this.fallbackFileSearch(workspaceDir, query, maxResults);
    }

    try {
      const searchRes = instance.finder.fileSearch(query);
      if (searchRes.ok && searchRes.value && Array.isArray(searchRes.value.items)) {
        return searchRes.value.items.slice(0, maxResults).map((item: any) => ({
          relativePath: item.relativePath || item.path || '',
          fullPath: path.join(workspaceDir, item.relativePath || item.path || ''),
        }));
      }
    } catch (err) {
      console.warn('[fffService] FFF fileSearch failed, using fallback:', err);
    }

    return this.fallbackFileSearch(workspaceDir, query, maxResults);
  }

  /**
   * Perform high-speed grep search in workspace.
   */
  public async grepText(workspaceDir: string, query: string, maxResults = 50): Promise<string> {
    const instance = await this.getFinder(workspaceDir);
    if (!instance) {
      return '';
    }

    try {
      if (typeof instance.finder.grep === 'function') {
        const grepRes = instance.finder.grep(query);
        if (grepRes.ok && grepRes.value && Array.isArray(grepRes.value.items)) {
          const items = grepRes.value.items.slice(0, maxResults);
          return items.map((m: any) => `${m.relativePath || m.path}:${m.line || 1} -> ${m.lineContent || m.content || ''}`).join('\n');
        }
      }
    } catch (err) {
      console.warn('[fffService] FFF grep failed:', err);
    }

    return '';
  }

  /**
   * Fallback file finder using Node.js fs when native FFF is unavailable.
   */
  private fallbackFileSearch(dir: string, query: string, maxResults: number): { relativePath: string; fullPath: string }[] {
    const results: { relativePath: string; fullPath: string }[] = [];
    const qLower = query.toLowerCase();

    const walk = (currentDir: string) => {
      if (results.length >= maxResults) return;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) break;
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;

          const full = path.join(currentDir, entry.name);
          const rel = path.relative(dir, full);

          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile()) {
            if (!query || entry.name.toLowerCase().includes(qLower) || rel.toLowerCase().includes(qLower)) {
              results.push({ relativePath: rel, fullPath: full });
            }
          }
        }
      } catch {
        // ignore read errors
      }
    };

    walk(dir);
    return results;
  }

  /**
   * Cleanup resources when shutting down.
   */
  public destroyAll() {
    for (const [, instance] of this.activeFinders.entries()) {
      try {
        instance.finder.destroy();
      } catch {}
    }
    this.activeFinders.clear();
  }
}

export const fffService = new FffService();
