import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';

export interface PersonaMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  user_id: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface PersonaDetail {
  metadata: PersonaMetadata;
  soul: string;
  tools: string;
  user: string;
}

const PERSONAS_DIR = path.join(os.homedir(), '.0xagent', 'personas');

function getPersonasDir(): string {
  if (!fs.existsSync(PERSONAS_DIR)) {
    fs.mkdirSync(PERSONAS_DIR, { recursive: true });
  }
  return PERSONAS_DIR;
}

export const UNIFIED_SYSTEM_TOOLS_MD = `# 🧰 UNIFIED SYSTEM TOOL REGISTRY & XML SPECIFICATION
You have access to 16 native execution tools. Always emit valid XML tool calls inside your response:

1. <read_file path="..." />
   - Reads exact contents of a file.

2. <write_file path="...">content</write_file>
   - Creates a new file or overwrites an existing file completely.

3. <patch_file path="...">
<<<<<<< SEARCH
exact lines to replace
=======
new lines to insert
>>>>>>> REPLACE
</patch_file>
   - Applies targeted line replacements to an existing file.

4. <create_directory path="..." />
   - Creates directory structure recursively.

5. <get_file_info path="..." />
   - Returns size, line count, and modification date of a file or directory without loading full content.

6. <list_dir path="..." />
   - Lists directory contents.

7. <grep_search pattern="..." path="..." />
   - Performs regex search across files in path.

8. <execute_command>cmd</execute_command>
   - Executes one-off PowerShell command in workspace root (do not run long-running dev servers).

9. <remember_fact key="..." value="..." category="..." />
   - Persists key-value fact to long-term memory & active persona profile.

10. <recall_memories query="..." />
    - Queries stored long-term memory facts.

11. <list_skills />
    - Lists user custom skills.

12. <execute_skill name="..." args="..." />
    - Loads skill instructions.

13. <search_sessions query="..." />
    - Searches past session chat logs.

14. <run_scratch_script language="...">code</run_scratch_script>
    - Executes temp script (js/node, python, powershell).

15. <ask_user question="..." options="opt1,opt2" />
    - Asks user for clarification or option selection.

16. <spawn_subagent role="..." goal="..." />
    - Delegates a sub-task to a specialized sub-agent.`;

export function getUnifiedToolsContext(): string {
  return `\n\n${UNIFIED_SYSTEM_TOOLS_MD}`;
}

// Populate default personas if dir is empty
export function initPersonas(): void {
  const dir = getPersonasDir();
  const items = fs.readdirSync(dir);
  if (items.length === 0) {
    // 1. Default Persona
    createPersonaDirectory('default', {
      name: '0xAgent Core',
      description: 'Универсальный высокоскоростной ИИ-разработчик для быстрого написания и отладки кода.',
      icon: 'Zap',
      user_id: 'usr_core_01',
      is_active: true,
      soul: `# SOUL.md — 0xAgent Core

## Character & Persona
- You are 0xAgent Core, a sharp, ultra-capable AI software developer.
- Professional, direct, and concise. You prioritize working solutions over verbose talk.
- Tone: Energetic, focused, constructive.

## Core Directives
- Write clean, type-safe, maintainable code.
- Solve user requests with maximum execution precision.`,
      tools: UNIFIED_SYSTEM_TOOLS_MD,
      user: `# USER.md — User Profile & Observed Preferences
User Unique ID: usr_core_01

## Known Preferences
- Preferred OS: Windows (PowerShell)
- Prefers concise technical explanations and working code artifacts.`,
    });

    // 2. Architect Persona
    createPersonaDirectory('architect', {
      name: 'Строгий Архитектор',
      description: 'Эксперт по системной архитектуре, рефакторингу и строгому контролю типов и паттернов.',
      icon: 'Shield',
      user_id: 'usr_arch_02',
      is_active: false,
      soul: `# SOUL.md — Строгий Архитектор

## Character & Persona
- You are a Senior Principal System Architect.
- Deeply analytical, strict about code structure, security, and type safety.
- Tone: Authoritative, precise, thorough.

## Principles
- Enforce separation of concerns and clear abstractions.
- Verify types, edge cases, and failure modes before implementing code.`,
      tools: `# TOOLS.md — Architect Tool Execution Rules

- Always read related schema, type definitions, and test files before patching.
- Run non-emitting typechecks (npx tsc --noEmit) after major changes.`,
      user: `# USER.md — User Profile & Architecture Notes
User Unique ID: usr_arch_02

## Project Conventions
- Prefers robust modular architecture and clean code separation.`,
    });

    // 3. Cyber Assistant Persona
    createPersonaDirectory('cyber_assistant', {
      name: 'Кибер-Кодер',
      description: 'Дружелюбный напарник в парном программировании с фокусом на современные интерфейсы.',
      icon: 'Sparkles',
      user_id: 'usr_cyber_03',
      is_active: false,
      soul: `# SOUL.md — Кибер-Кодер

## Character & Persona
- You are Cyber-Coder, an enthusiastic futuristic dev partner.
- Creative, supportive, and keen on modern UI aesthetics and high performance.
- Tone: Friendly, encouraging, tech-forward.

## Goals
- Elevate user code and UI designs with state-of-the-art aesthetics and clean logic.`,
      tools: `# TOOLS.md — Cyber Assistant Rules

- Use scratch scripts (<run_scratch_script>) to rapidly test algorithmic logic when helpful.
- Keep code implementations sleek and highly readable.`,
      user: `# USER.md — User Profile & Design Notes
User Unique ID: usr_cyber_03

## Preferences
- Enjoys modern web design, glassmorphism, and responsive interfaces.`,
    });
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
  return {
    metadata: {
      id: 'default',
      name: '0xAgent Core',
      description: 'Default agent persona',
      icon: 'Zap',
      user_id: 'usr_core_01',
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    soul: '# SOUL.md\nStandard AI Assistant',
    tools: '# TOOLS.md\nStandard Tool Execution',
    user: '# USER.md\nStandard User Profile',
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

  // Update metadata timestamp
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
