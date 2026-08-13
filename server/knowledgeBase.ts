import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { KnowledgeEntry, KnowledgeQueryOptions } from '../src/types';

const APP_DIR = path.join(os.homedir(), '.0xagent');
const KB_DIR = path.join(APP_DIR, 'knowledge_base');
const ENTRIES_DIR = path.join(KB_DIR, 'entries');
const MANIFEST_FILE = path.join(KB_DIR, 'manifest.json');

async function ensureKbDirs(): Promise<void> {
  await fs.promises.mkdir(ENTRIES_DIR, { recursive: true });
}

export async function loadManifest(): Promise<KnowledgeEntry[]> {
  await ensureKbDirs();
  try {
    if (!fs.existsSync(MANIFEST_FILE)) {
      return [];
    }
    const data = await fs.promises.readFile(MANIFEST_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to parse knowledge_base manifest.json:', err);
    return [];
  }
}

async function saveManifest(entries: KnowledgeEntry[]): Promise<void> {
  await ensureKbDirs();
  await fs.promises.writeFile(MANIFEST_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export async function saveKnowledgeEntry(params: {
  title: string;
  category: string;
  content: string;
  summary?: string;
  tags?: string[];
  source?: string;
  id?: string;
}): Promise<KnowledgeEntry> {
  await ensureKbDirs();
  const manifest = await loadManifest();
  const now = Date.now();
  const id = params.id || `kb_${now}_${Math.random().toString(36).substring(2, 6)}`;
  
  const formattedSummary = params.summary || (params.content.length > 200 ? `${params.content.substring(0, 197)}...` : params.content);
  const tags = params.tags || [];

  const entry: KnowledgeEntry = {
    id,
    title: params.title.trim(),
    category: params.category.trim().toLowerCase() || 'general',
    content: params.content,
    summary: formattedSummary,
    tags: tags.map(t => t.trim().toLowerCase()).filter(Boolean),
    source: params.source || '0xAgent Core',
    createdAt: now,
    updatedAt: now,
  };

  const existingIdx = manifest.findIndex(e => e.id === id);
  if (existingIdx >= 0) {
    entry.createdAt = manifest[existingIdx].createdAt;
    manifest[existingIdx] = entry;
  } else {
    manifest.unshift(entry);
  }

  // Write detailed entry file
  const entryFile = path.join(ENTRIES_DIR, `${id}.json`);
  await fs.promises.writeFile(entryFile, JSON.stringify(entry, null, 2), 'utf-8');

  // Update manifest index
  await saveManifest(manifest);
  return entry;
}

export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
  await ensureKbDirs();
  const entryFile = path.join(ENTRIES_DIR, `${id}.json`);
  try {
    if (fs.existsSync(entryFile)) {
      const raw = await fs.promises.readFile(entryFile, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Failed to load knowledge entry ${id}:`, err);
  }

  // Fallback to manifest
  const manifest = await loadManifest();
  return manifest.find(e => e.id === id) || null;
}

export async function deleteKnowledgeEntry(id: string): Promise<boolean> {
  await ensureKbDirs();
  let manifest = await loadManifest();
  const origLen = manifest.length;
  manifest = manifest.filter(e => e.id !== id);

  if (manifest.length !== origLen) {
    await saveManifest(manifest);
    const entryFile = path.join(ENTRIES_DIR, `${id}.json`);
    if (fs.existsSync(entryFile)) {
      try {
        await fs.promises.unlink(entryFile);
      } catch (err) {
        console.error(`Failed to delete entry file ${entryFile}:`, err);
      }
    }
    return true;
  }
  return false;
}

export async function queryKnowledgeEntries(options?: KnowledgeQueryOptions): Promise<KnowledgeEntry[]> {
  const manifest = await loadManifest();
  if (!options) return manifest;

  let results = manifest;

  if (options.category && options.category !== '*' && options.category.trim()) {
    const cat = options.category.toLowerCase().trim();
    results = results.filter(e => e.category.toLowerCase() === cat);
  }

  if (options.tag && options.tag.trim()) {
    const tag = options.tag.toLowerCase().trim();
    results = results.filter(e => e.tags.some(t => t.includes(tag)));
  }

  if (options.startDate) {
    results = results.filter(e => e.createdAt >= options.startDate!);
  }

  if (options.endDate) {
    results = results.filter(e => e.createdAt <= options.endDate!);
  }

  if (options.query && options.query.trim() && options.query !== '*') {
    const q = options.query.toLowerCase().trim();
    results = results.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return results;
}

export async function listKnowledgeCategories(): Promise<{ category: string; count: number }[]> {
  const manifest = await loadManifest();
  const counts: Record<string, number> = {};

  for (const item of manifest) {
    const cat = item.category || 'general';
    counts[cat] = (counts[cat] || 0) + 1;
  }

  return Object.keys(counts).map(cat => ({
    category: cat,
    count: counts[cat]
  }));
}
