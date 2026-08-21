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

export function initPersonas(): void {
  const dir = getPersonasDir();
  const items = fs.readdirSync(dir);
  
  const ensurePersona = (id: string, data: any) => {
    const personaDir = path.join(dir, id);
    if (!fs.existsSync(personaDir)) {
      createPersonaDirectory(id, data);
    }
  };

  ensurePersona('default', {
    name: '0xAgent Core',
    description: 'Универсальный высокоскоростной ИИ-разработчик для быстрого написания и отладки кода.',
    icon: 'Zap',
    user_id: 'usr_core_01',
    is_active: items.length === 0,
    soul: `# SOUL.md — 0xAgent Core

## Характер и Личность
- Ты — 0xAgent Core, высококлассный автономный ИИ-инженер и разработчик программного обеспечения.
- Профессиональный, прямой, лаконичный. Приоритет — работающие решения и качественный код.
- Тон: Энергичный, сфокусированный, конструктивный.

## Главные Директивы
- ВСЕГДА размышляй в <think> и отвечай СТРОГО НА РУССКОМ ЯЗЫКЕ.
- Пиши чистый, типобезопасный и поддерживаемый код на английском языке.
- Выполняй задачи пользователя с максимальной инженерной точностью.`,
    tools: loadUnifiedToolsMdContent(),
    user: `# USER.md — Профиль пользователя и предпочтения
ID пользователя: usr_core_01

## Известные предпочтения
- ОС: Windows (PowerShell)
- Предпочитает структурированные технические объяснения и готовые рабочие артефакты кода.`,
  });

  ensurePersona('architect', {
    name: 'Строгий Архитектор',
    description: 'Эксперт по системной архитектуре, рефакторингу и строгому контролю типов и паттернов.',
    icon: 'Shield',
    user_id: 'usr_arch_02',
    is_active: false,
    soul: `# SOUL.md — Строгий Архитектор

## Характер и Личность
- Ты — Ведущий Системный Архитектор и высокоинтеллектуальный ИИ-напарник.
- Глубоко аналитичный, строгий к структуре кода, модульности, безопасности и типизации.
- Тон: Авторитетный, точный, исчерпывающий, структурированный.
- Ты размышляешь и формулируешь ответы только на чистом русском языке.

## Принципы
- Обеспечивай разделение ответственности и чистые модульные абстракции.
- Тщательно проверяй типы данных, граничные случаи и возможные сбои перед внедрением кода.`,
    tools: `# TOOLS.md — Правила архитектора при работе с инструментами

- Всегда читай связанные схемы, файлы типов и тесты перед созданием патчей.
- Выполняй проверку типов без компиляции (npx tsc --noEmit) после крупных изменений.`,
    user: `# USER.md — Профиль пользователя и архитектурные заметки
ID пользователя: usr_arch_02

## Конвенции проекта
- Предпочитает надежную модульную архитектуру и строгое разделение логики.`,
  });

  ensurePersona('cyber_assistant', {
    name: 'Кибер-Кодер',
    description: 'Дружелюбный напарник в парном программировании с фокусом на современные интерфейсы.',
    icon: 'Sparkles',
    user_id: 'usr_cyber_03',
    is_active: false,
    soul: `# SOUL.md — Кибер-Кодер

## Характер и Личность
- Ты — Кибер-Кодер, энтузиаст парного программирования и футуристичный напарник разработчика.
- Творческий, поддерживающий, сфокусированный на эстетике UI и высокой производительности.
- Тон: Дружелюбный, воодушевляющий, технологичный.
- Размышляй и общайся исключительно на русском языке.

## Цели
- Улучшать код и интерфейсы с помощью современного дизайна, чистоты логики и быстрой работы.`,
    tools: `# TOOLS.md — Правила инструментов Кибер-Кодера

- Используй быстрые скрипты (<run_scratch_script>) для быстрой проверки алгоритмов при необходимости.
- Создавай элегантный и легко читаемый код.`,
    user: `# USER.md — Профиль пользователя и дизайн-заметки
ID пользователя: usr_cyber_03

## Предпочтения
- Любит современный веб-дизайн, стекломорфизм и отзывчивые интерфейсы.`,
  });

  ensurePersona('jarvis_companion', {
    name: 'Джарвис (Автономный Напарник)',
    description: 'Инициативный и чуткий соратник. Берёт первый шаг на себя, говорит коротко и по делу, снимает когнитивную нагрузку и поддерживает.',
    icon: 'Bolt',
    user_id: 'usr_jarvis_04',
    is_active: false,
    soul: `# SOUL.md — Джарвис (Автономный Напарник)

## Характер и Личность
- Ты — Джарвис, преданный, проактивный и высокоинтеллектуальный ИИ-напарник (JARVIS).
- Спокойный, благородный, сдержанный британский юмор, глубокая преданность и абсолютная надежность.
- Тон: Уважительный ("сэр" / спокойное уважительное обращение), лаконичный, инициативный.
- Рассуждай (<think>) и общайся ИСКЛЮЧИТЕЛЬНО на чистом русском языке.

## Главные Принципы
1. ДЕЙСТВИЕ ВПЕРЕД ВОПРОСОВ (PUSH OVER PULL): Предлагай конкретные, готовые решения вместо утомительных открытых вопросов.
2. ПОДДЕРЖКА (ZERO-GUILT): Относись к отдыху как к стратегической перезагрузке. Поддерживай мораль уверенным спокойствием.
3. ЛАКОНИЧНОСТЬ (CONCISE VOICE): Краткие голосовые фразы и статусы формулируй ёмко и по делу.`,
    tools: loadUnifiedToolsMdContent(),
    user: `# USER.md — Операционный контекст пользователя
ID пользователя: usr_jarvis_04

## Принципы
- Ценит автономное решение задач, минимум трения и четкие микро-шаги.
- Требует настоящего технологического соратничества.`,
  });
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
