import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export interface AntigravityModelInfo {
  slug: string;
  name: string;
  description?: string;
  effort?: string;
  supportedEfforts?: ('low' | 'medium' | 'high')[];
  defaultEffort?: 'low' | 'medium' | 'high';
}

export const DEFAULT_ANTIGRAVITY_MODELS: AntigravityModelInfo[] = [
  {
    slug: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    effort: 'low',
    supportedEfforts: ['low', 'medium', 'high'],
    defaultEffort: 'low',
  },
  {
    slug: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    effort: 'low',
    supportedEfforts: ['low', 'medium', 'high'],
    defaultEffort: 'low',
  },
  {
    slug: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    effort: 'low',
    supportedEfforts: ['low', 'medium', 'high'],
    defaultEffort: 'low',
  },
  {
    slug: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    effort: 'low',
    supportedEfforts: ['low', 'high'],
    defaultEffort: 'low',
  },
  {
    slug: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Thinking)',
    effort: undefined,
    supportedEfforts: [],
  },
  {
    slug: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    effort: undefined,
    supportedEfforts: [],
  },
  {
    slug: 'gpt-oss-120b-medium',
    name: 'GPT-OSS 120B (Medium)',
    effort: undefined,
    supportedEfforts: [],
  },
  {
    slug: 'inherit',
    name: 'Default Antigravity Inherited Model',
    effort: undefined,
    supportedEfforts: [],
  },
];

export function parseAgyModelsOutput(output: string): {
  rawModels: { slug: string; name: string }[];
  models: AntigravityModelInfo[];
} {
  const lines = output.split('\n');
  const rawList: { slug: string; name: string }[] = [];
  const families: Map<
    string,
    {
      baseSlug: string;
      baseName: string;
      efforts: ('low' | 'medium' | 'high')[];
    }
  > = new Map();
  const standalone: AntigravityModelInfo[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Fetching')) continue;

    const parts = trimmed.split('\t');
    let slug = '';
    let name = '';
    if (parts.length >= 2) {
      slug = parts[0].trim();
      name = parts[1].trim();
    } else {
      const match = trimmed.match(/^(\S+)\s+(.+)$/);
      if (match) {
        slug = match[1].trim();
        name = match[2].trim();
      } else {
        slug = trimmed;
        name = trimmed;
      }
    }

    if (!slug) continue;
    rawList.push({ slug, name });

    const effortMatch = slug.match(/^(.*?)-(low|medium|high)$/);
    if (effortMatch) {
      const baseSlug = effortMatch[1];
      const effort = effortMatch[2] as 'low' | 'medium' | 'high';
      const cleanName = name.replace(/\s*\((Low|Medium|High|Med)\)\s*/i, '').trim();

      let family = families.get(baseSlug);
      if (!family) {
        family = { baseSlug, baseName: cleanName, efforts: [] };
        families.set(baseSlug, family);
      }
      if (!family.efforts.includes(effort)) {
        family.efforts.push(effort);
      }
    } else {
      standalone.push({
        slug,
        name,
        effort: undefined,
        supportedEfforts: [],
      });
    }
  }

  const result: AntigravityModelInfo[] = [];
  for (const [, fam] of families.entries()) {
    const effortOrder: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    fam.efforts.sort((a, b) => effortOrder.indexOf(a) - effortOrder.indexOf(b));
    result.push({
      slug: fam.baseSlug,
      name: fam.baseName,
      effort: 'low',
      supportedEfforts: fam.efforts,
      defaultEffort: 'low',
    });
  }

  result.push(...standalone);

  if (!result.some((m) => m.slug === 'inherit')) {
    result.push({
      slug: 'inherit',
      name: 'Default Antigravity Inherited Model',
      effort: undefined,
      supportedEfforts: [],
    });
  }
  if (!rawList.some((m) => m.slug === 'inherit')) {
    rawList.push({ slug: 'inherit', name: 'Auto (Inherit Antigravity)' });
  }

  return { rawModels: rawList, models: result };
}

export function getSafeCliPath(customPath?: string | null): string {
  if (customPath && customPath !== 'agy') return customPath;
  if (process.platform === 'win32') {
    const localAgy = path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
    if (fs.existsSync(localAgy)) return localAgy;
  }
  return 'agy';
}

export function isAntigravityModel(rawModel?: string | null, activePersonaId?: string | null): boolean {
  if (activePersonaId === 'veronica') return true;
  if (!rawModel) return false;
  const selectedModel = rawModel.toLowerCase().trim();
  if (selectedModel.startsWith('local:') || selectedModel.endsWith('.gguf')) {
    return false;
  }
  return (
    selectedModel.startsWith('gemini-') ||
    selectedModel.startsWith('claude-') ||
    selectedModel.startsWith('gpt-') ||
    selectedModel.startsWith('deepseek-') ||
    selectedModel.startsWith('antigravity') ||
    selectedModel === 'inherit' ||
    selectedModel === 'auto' ||
    selectedModel === 'agy'
  );
}

export function resolveAntigravityModelAndEffort(rawModel?: string | null, rawEffort?: string | null): {
  model?: string;
  effort?: string;
} {
  if (!rawModel || rawModel === 'inherit' || rawModel === 'auto' || rawModel === 'agy' || rawModel === 'antigravity') {
    return { model: undefined, effort: undefined };
  }

  const clean = rawModel.toLowerCase().trim().replace(/^antigravity:/, '');

  // 1. Claude and GPT-OSS models NEVER support --effort flag
  if (
    clean.startsWith('claude-') ||
    clean.includes('claude') ||
    clean.startsWith('gpt-oss') ||
    clean.includes('gpt-oss')
  ) {
    if (clean.includes('opus')) {
      return { model: 'claude-opus-4-6-thinking', effort: undefined };
    }
    if (clean.includes('sonnet')) {
      return { model: 'claude-sonnet-4-6', effort: undefined };
    }
    if (clean.includes('gpt-oss')) {
      return { model: 'gpt-oss-120b-medium', effort: undefined };
    }
    return { model: clean, effort: undefined };
  }

  // 2. Direct slug format with effort encoded
  if (['gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low'].includes(clean)) {
    return { model: clean, effort: undefined };
  }
  if (['gemini-3.7-flash-high', 'gemini-3.7-flash-medium', 'gemini-3.7-flash-low'].includes(clean)) {
    return { model: clean, effort: undefined };
  }
  if (['gemini-3.6-flash-high', 'gemini-3.6-flash-medium', 'gemini-3.6-flash-low'].includes(clean)) {
    return { model: clean, effort: undefined };
  }
  if (['gemini-3.1-pro-high', 'gemini-3.1-pro-low'].includes(clean)) {
    return { model: clean, effort: undefined };
  }

  // 3. Base model with effort parameter
  let effort = rawEffort && rawEffort !== 'auto' && rawEffort !== 'off' ? rawEffort.toLowerCase() : 'low';

  if (clean.includes('3.8') && clean.includes('flash')) {
    if (!['low', 'medium', 'high'].includes(effort)) effort = 'low';
    return { model: `gemini-3.8-flash-${effort}`, effort: undefined };
  }

  if (clean.includes('3.7') && clean.includes('flash')) {
    if (!['low', 'medium', 'high'].includes(effort)) effort = 'low';
    return { model: `gemini-3.7-flash-${effort}`, effort: undefined };
  }

  if (clean.includes('3.6') && clean.includes('flash')) {
    if (!['low', 'medium', 'high'].includes(effort)) effort = 'low';
    return { model: `gemini-3.6-flash-${effort}`, effort: undefined };
  }

  if (clean.includes('3.1') && clean.includes('pro')) {
    if (effort === 'medium' || !['low', 'high'].includes(effort)) effort = 'low';
    return { model: `gemini-3.1-pro-${effort}`, effort: undefined };
  }

  return { model: clean, effort: undefined };
}

