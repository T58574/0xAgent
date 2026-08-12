import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'user_preference' | 'project_convention' | 'architecture' | 'fact' | 'general';
  createdAt: number;
  updatedAt: number;
}

const APP_DIR = path.join(os.homedir(), '.0xagent');
const MEMORY_FILE = path.join(APP_DIR, 'memory.json');

function ensureDir(): void {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
}

export function loadMemories(): MemoryItem[] {
  ensureDir();
  if (!fs.existsSync(MEMORY_FILE)) {
    const initial: MemoryItem[] = [
      {
        id: 'mem_1',
        key: 'preferred_language',
        value: 'Russian',
        category: 'user_preference',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'mem_2',
        key: 'gpu_card',
        value: 'AMD Radeon RX 7800 XT (Vulkan backend recommended)',
        category: 'architecture',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    saveMemories(initial);
    return initial;
  }
  try {
    const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to parse memory.json:', err);
    return [];
  }
}

export function saveMemories(items: MemoryItem[]): void {
  ensureDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

export function addOrUpdateMemory(key: string, value: string, category?: string): MemoryItem {
  const memories = loadMemories();
  const validCategories: MemoryItem['category'][] = ['user_preference', 'project_convention', 'architecture', 'fact', 'general'];
  const cat: MemoryItem['category'] = validCategories.includes(category as any) ? (category as MemoryItem['category']) : 'fact';
  const existingIdx = memories.findIndex(m => m.key.toLowerCase() === key.toLowerCase());

  const now = Date.now();
  if (existingIdx >= 0) {
    memories[existingIdx].value = value;
    memories[existingIdx].category = cat;
    memories[existingIdx].updatedAt = now;
    saveMemories(memories);
    return memories[existingIdx];
  }

  const newItem: MemoryItem = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    key,
    value,
    category: cat,
    createdAt: now,
    updatedAt: now,
  };

  memories.push(newItem);
  saveMemories(memories);
  return newItem;
}

export function deleteMemory(keyOrId: string): boolean {
  let memories = loadMemories();
  const origLen = memories.length;
  memories = memories.filter(m => m.id !== keyOrId && m.key.toLowerCase() !== keyOrId.toLowerCase());
  if (memories.length !== origLen) {
    saveMemories(memories);
    return true;
  }
  return false;
}

export function queryMemories(query: string): MemoryItem[] {
  const memories = loadMemories();
  if (!query || query.trim() === '*') return memories;
  const q = query.toLowerCase();
  return memories.filter(m =>
    m.key.toLowerCase().includes(q) ||
    m.value.toLowerCase().includes(q) ||
    m.category.toLowerCase().includes(q)
  );
}

export function getSystemPromptMemoryContext(): string {
  const memories = loadMemories();
  if (memories.length === 0) return '';

  const lines = memories.slice(0, 10).map(m => `- [${m.category.toUpperCase()}] ${m.key}: ${m.value}`);
  return `\n\n# Long-Term Persistent Memory (${memories.length} facts remembered):\n${lines.join('\n')}`;
}
