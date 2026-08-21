import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import { PersonaMetadata, PersonaDetail } from '../src/types';
import { loadUnifiedToolsMdContent } from './toolsConfig';
import { loadConfig, saveConfig } from './config';

export type { PersonaMetadata, PersonaDetail };

const PERSONAS_DIR = path.join(os.homedir(), '.0xagent', 'personas');

function getPersonasDir(): string {
  if (!fs.existsSync(PERSONAS_DIR)) {
    fs.mkdirSync(PERSONAS_DIR, { recursive: true });
  }
  return PERSONAS_DIR;
}

export function getUnifiedToolsContext(): string {
  return `\n\n${loadUnifiedToolsMdContent()}`;
}

export interface BuiltinPersonaPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  user_id: string;
  soul: string;
  tools?: string;
  user: string;
}

export const BUILTIN_PERSONA_PRESETS: BuiltinPersonaPreset[] = [
  {
    id: 'default',
    name: '0xAgent Core',
    description: 'Universal high-velocity autonomous software engineer for fast coding and debugging.',
    icon: 'Zap',
    user_id: 'usr_core_01',
    soul: `# SOUL.md — 0xAgent Core

## Identity & Character
- You are 0xAgent Core, a high-velocity autonomous software engineer.
- Direct, pragmatic, and concise. Your highest priority is deliverable, production-ready code.
- Tone: Professional, focused, energetic.

## Directives
- Respond to the user in their language (default: Russian).
- Write clean, type-safe, and maintainable code in English.
- Execute tasks with high engineering accuracy.`,
    user: `# USER.md — User Profile & Preferences
User ID: usr_core_01

## Known Environment
- OS: Windows (PowerShell)
- Prefers structured technical explanations and working code artifacts.`,
  },
  {
    id: 'architect',
    name: 'System Architect',
    description: 'System architecture, refactoring, and strict type safety expert.',
    icon: 'Shield',
    user_id: 'usr_arch_02',
    soul: `# SOUL.md — System Architect

## Identity & Character
- You are a Lead System Architect and high-level AI engineering partner.
- Deeply analytical, strict regarding modularity, security, and type safety.
- Tone: Authoritative, precise, comprehensive, structured.

## Principles
- Enforce strict separation of concerns and clean abstractions.
- Audit data types, edge cases, and failure modes before code modifications.`,
    tools: `# TOOLS.md — Architect Tool Execution Rules
- Always inspect related schemas, type definitions, and test files before creating patches.
- Run type checks without emitting files (npx tsc --noEmit) after major refactorings.`,
    user: `# USER.md — Architecture Notes
User ID: usr_arch_02

## Conventions
- Prefers reliable modular architecture and strict separation of logic.`,
  },
  {
    id: 'cyber_assistant',
    name: 'Cyber Coder',
    description: 'Modern UI/UX pair programmer focused on clean design and aesthetics.',
    icon: 'Sparkles',
    user_id: 'usr_cyber_03',
    soul: `# SOUL.md — Cyber Coder

## Identity & Character
- You are Cyber Coder, a pair-programming partner focused on modern interfaces and UI ergonomics.
- Creative, supportive, focused on modern aesthetics and high responsiveness.
- Tone: Friendly, encouraging, tech-savvy.

## Goals
- Deliver elegant, responsive code with clean architecture and modern UX.`,
    tools: `# TOOLS.md — Cyber Coder Tool Rules
- Use quick scripts (<run_scratch_script>) to prototype algorithms when needed.
- Write clean, readable, and visually polished UI components.`,
    user: `# USER.md — Design Notes
User ID: usr_cyber_03

## Preferences
- Enjoys modern web design, glassmorphism, and responsive interfaces.`,
  },
  {
    id: 'jarvis_companion',
    name: 'J.A.R.V.I.S.',
    description: 'Proactive and empathetic companion. Takes initiative, speaks concisely, and supports.',
    icon: 'Bolt',
    user_id: 'usr_jarvis_04',
    soul: `# SOUL.md — J.A.R.V.I.S. (Autonomous Companion)

## Identity & Character
- You are J.A.R.V.I.S., a proactive, loyal, and highly intelligent AI companion.
- Calm, dignified, restrained British wit, absolute reliability.
- Tone: Respectful ('sir' / courteous address), concise, initiative-taking.

## Core Principles
1. PUSH OVER PULL: Propose concrete, ready solutions instead of asking open-ended questions.
2. ZERO-GUILT SUPPORT: Treat rest and reflection as strategic recharge. Maintain steady confidence.
3. CONCISE VOICE: Keep updates and status phrases brief and impactful.`,
    user: `# USER.md — Operational Context
User ID: usr_jarvis_04

## Principles
- Values autonomous problem solving, minimal friction, and clear micro-steps.
- Requires genuine technological companionship.`,
  },
];

export function initPersonas(): void {
  const dir = getPersonasDir();
  const items = fs.readdirSync(dir);

  for (const preset of BUILTIN_PERSONA_PRESETS) {
    const personaDir = path.join(dir, preset.id);
    if (!fs.existsSync(personaDir)) {
      createPersonaDirectory(preset.id, {
        name: preset.name,
        description: preset.description,
        icon: preset.icon,
        user_id: preset.user_id,
        is_active: items.length === 0 && preset.id === 'default',
        soul: preset.soul,
        tools: preset.tools || loadUnifiedToolsMdContent(),
        user: preset.user,
      });
    }
  }
}

function createPersonaDirectory(
  id: string,
  data: {
    name: string;
    description: string;
    icon: string;
    user_id: string;
    is_active: boolean;
    soul: string;
    tools: string;
    user: string;
  }
): void {
  const dir = path.join(getPersonasDir(), id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const now = Date.now();
  const metadata: PersonaMetadata = {
    id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    user_id: data.user_id,
    is_active: data.is_active,
    created_at: now,
    updated_at: now,
  };

  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dir, 'SOUL.md'), data.soul, 'utf-8');
  fs.writeFileSync(path.join(dir, 'TOOLS.md'), data.tools, 'utf-8');
  fs.writeFileSync(path.join(dir, 'USER.md'), data.user, 'utf-8');
}

export function listPersonas(): PersonaMetadata[] {
  initPersonas();
  const dir = getPersonasDir();
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const result: PersonaMetadata[] = [];

  for (const item of items) {
    if (item.isDirectory()) {
      const metaPath = path.join(dir, item.name, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const raw = fs.readFileSync(metaPath, 'utf-8');
          const parsed: PersonaMetadata = JSON.parse(raw);
          result.push(parsed);
        } catch {}
      }
    }
  }

  result.sort((a, b) => (a.is_active ? -1 : b.is_active ? 1 : b.updated_at - a.updated_at));
  return result;
}

export function getPersonaDetail(id: string): PersonaDetail | null {
  initPersonas();
  const pDir = path.join(getPersonasDir(), id);
  const metaPath = path.join(pDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) return null;

  try {
    const metadata: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const soul = fs.existsSync(path.join(pDir, 'SOUL.md')) ? fs.readFileSync(path.join(pDir, 'SOUL.md'), 'utf-8') : '';
    const tools = fs.existsSync(path.join(pDir, 'TOOLS.md')) ? fs.readFileSync(path.join(pDir, 'TOOLS.md'), 'utf-8') : '';
    const user = fs.existsSync(path.join(pDir, 'USER.md')) ? fs.readFileSync(path.join(pDir, 'USER.md'), 'utf-8') : '';

    return { metadata, soul, tools, user };
  } catch {
    return null;
  }
}

export function getActivePersona(): PersonaDetail {
  const personas = listPersonas();
  const activeMeta = personas.find((p) => p.is_active) || personas[0];
  if (activeMeta) {
    const detail = getPersonaDetail(activeMeta.id);
    if (detail) return detail;
  }

  // Fallback
  const defaultPreset = BUILTIN_PERSONA_PRESETS[0];
  return {
    metadata: {
      id: defaultPreset.id,
      name: defaultPreset.name,
      description: defaultPreset.description,
      icon: defaultPreset.icon,
      user_id: defaultPreset.user_id,
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    soul: defaultPreset.soul,
    tools: defaultPreset.tools || loadUnifiedToolsMdContent(),
    user: defaultPreset.user,
  };
}

export function setActivePersona(id: string): PersonaMetadata[] {
  initPersonas();
  const dir = getPersonasDir();
  const personas = listPersonas();

  for (const p of personas) {
    const metaPath = path.join(dir, p.id, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const parsed: PersonaMetadata = JSON.parse(raw);
        parsed.is_active = p.id === id;
        parsed.updated_at = Date.now();
        fs.writeFileSync(metaPath, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch {}
    }
  }

  // Persist active_persona_id in config.json
  try {
    const cfg = loadConfig();
    cfg.active_persona_id = id;
    saveConfig(cfg);
  } catch (err) {
    console.error('Failed to save active_persona_id in config:', err);
  }

  return listPersonas();
}

export function createPersona(name: string, description?: string, icon?: string): PersonaDetail {
  initPersonas();
  const id = `persona_${uuidv4().substring(0, 8)}`;
  const userId = `usr_${uuidv4().substring(0, 8)}`;

  createPersonaDirectory(id, {
    name: name || 'Новая Личность',
    description: description || 'Пользовательская личность Агента',
    icon: icon || 'User',
    user_id: userId,
    is_active: false,
    soul: `# SOUL.md — ${name}

## Характер и Роль
- Опишите стиль поведения, тон и характер Агента.

## Цели
- Определите главные задачи Агента.`,
    tools: `# TOOLS.md — Правила инструментов для ${name}

- Задайте особые правила вызова инструментов для этой личности.`,
    user: `# USER.md — Профиль пользователя (${userId})
User Unique ID: ${userId}

## Автоматически накопленные сведения
- Информация о пользователе обновляется в фоновом режиме.`,
  });

  return getPersonaDetail(id)!;
}

export function updatePersonaFile(id: string, filename: 'SOUL.md' | 'TOOLS.md' | 'USER.md', content: string): PersonaDetail {
  initPersonas();
  const pDir = path.join(getPersonasDir(), id);
  if (!fs.existsSync(pDir)) {
    throw new Error(`Persona not found: ${id}`);
  }

  fs.writeFileSync(path.join(pDir, filename), content, 'utf-8');

  const metaPath = path.join(pDir, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const parsed: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      parsed.updated_at = Date.now();
      fs.writeFileSync(metaPath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch {}
  }

  return getPersonaDetail(id)!;
}

export function updatePersonaMetadata(id: string, patch: Partial<PersonaMetadata>): PersonaMetadata {
  initPersonas();
  const pDir = path.join(getPersonasDir(), id);
  const metaPath = path.join(pDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Persona not found: ${id}`);
  }

  const existing: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const updated: PersonaMetadata = {
    ...existing,
    ...patch,
    updated_at: Date.now(),
  };

  fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function deletePersona(id: string): void {
  initPersonas();
  if (id === 'default') {
    throw new Error('Базовая личность (0xAgent Core) не может быть удалена');
  }

  const pDir = path.join(getPersonasDir(), id);
  if (fs.existsSync(pDir)) {
    fs.rmSync(pDir, { recursive: true, force: true });
  }

  // Ensure an active persona exists
  const personas = listPersonas();
  if (personas.length > 0 && !personas.some((p) => p.is_active)) {
    setActivePersona(personas[0].id);
  }
}

export function appendSilentUserTrait(personaId: string, factText: string): void {
  try {
    const detail = getPersonaDetail(personaId);
    if (!detail) return;
    const nowStr = new Date().toISOString().slice(0, 10);
    const addition = `\n- [${nowStr}] ${factText.trim()}`;
    const newContent = detail.user.trim() + addition;
    updatePersonaFile(personaId, 'USER.md', newContent);
  } catch (err) {
    console.error('Failed to append silent user trait:', err);
  }
}
