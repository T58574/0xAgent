import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ToolDefinition } from '../src/types';

export type { ToolDefinition };

export interface ToolsConfigState {
  toggles: Record<string, boolean>;
  updated_at: number;
}

const TOOLS_CONFIG_PATH = path.join(os.homedir(), '.0xagent', 'tools_config.json');
const UNIFIED_TOOLS_MD_PATH = path.join(os.homedir(), '.0xagent', 'TOOLS.md');

export const DEFAULT_TOOLS_REGISTRY: ToolDefinition[] = [
  {
    id: 'read_file',
    name: 'read_file',
    description: 'Чтение точного содержимого текстовых файлов в текущей рабочей области.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `1. <read_file path="..." />
   - Чтение точного содержимого файла.`,
  },
  {
    id: 'write_file',
    name: 'write_file',
    description: 'Создание нового файла (использовать ТОЛЬКО для новых файлов или маленьких файлов до 50 строк).',
    category: 'files',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `2. <write_file path="...">content</write_file>
   - Использовать ИСКЛЮЧИТЕЛЬНО для создания новых файлов или коротких конфигов (<50 строк). ДЛЯ ИЗМЕНЕНИЯ СУЩЕСТВУЮЩИХ ФАЙЛОВ ИСПОЛЬЗУЙТЕ patch_file.`,
  },
  {
    id: 'patch_file',
    name: 'patch_file',
    description: 'ОБЯЗАТЕЛЬНЫЙ ИНСТРУМЕНТ для изменения существующих файлов. Поддерживает несколько SEARCH/REPLACE блоков в одном вызове.',
    category: 'files',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `3. <patch_file path="...">
<<<<<<< SEARCH
короткие уникальные строки для замены (3-8 строк)
=======
новые строки кода
>>>>>>> REPLACE

<<<<<<< SEARCH
второй фрагмент для замены в том же файле
=======
второй новый фрагмент
>>>>>>> REPLACE
</patch_file>
   - ОБЯЗАТЕЛЕН для изменения любых существующих файлов! Поддерживает множество блоков SEARCH/REPLACE подряд.`,
  },
  {
    id: 'create_directory',
    name: 'create_directory',
    description: 'Рекурсивное создание структуры директорий в проекте.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `4. <create_directory path="..." />
   - Рекурсивно создает директорию.`,
  },
  {
    id: 'get_file_info',
    name: 'get_file_info',
    description: 'Получение метаданных файла или папки (размер, число строк, дата изменения).',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `5. <get_file_info path="..." />
   - Возвращает размер, количество строк и дату изменения без чтения всего содержимого.`,
  },
  {
    id: 'list_dir',
    name: 'list_dir',
    description: 'Просмотр списка файлов и поддиректорий в указанном каталоге.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `6. <list_dir path="..." />
   - Выводит содержимое директории.`,
  },
  {
    id: 'grep_search',
    name: 'grep_search',
    description: 'Быстрый поиск по регулярным выражениям во всех файлах каталога.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `7. <grep_search pattern="..." path="..." />
   - Выполняет поиск по регулярному выражению в файлах.`,
  },
  {
    id: 'fff_search',
    name: 'fff_search',
    description: 'Сверхбыстрый нечеткий поиск файлов (Fuzzy File Finder) с учётом Git-статуса и частоты вызовов.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `7b. <fff_search query="..." />
   - Выполняет мгновенный нечеткий поиск файлов (FFF) в проекте.`,
  },
  {
    id: 'web_search',
    name: 'web_search',
    description: 'Поиск информации в интернете через локальный SearXNG / DuckDuckGo с минимальным расходом токенов.',
    category: 'web',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `7c. <web_search query="..." />
   - Выполняет интернет-поиск и возвращает список релевантных заголовков и ссылок.`,
  },
  {
    id: 'read_web_page',
    name: 'read_web_page',
    description: 'Загрузка и очистка веб-страницы по URL в токеново-оптимизированный Markdown.',
    category: 'web',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `7d. <read_web_page url="..." />
   - Читает веб-страницу по URL, удаляя рекламу и сжимая контент.`,
  },
  {
    id: 'execute_command',
    name: 'execute_command',
    description: 'Запуск одноразовых PowerShell команд в корне рабочей области (сборка, тесты, проверка типов).',
    category: 'terminal',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `8. <execute_command>cmd</execute_command>
   - Выполняет одноразовую команду PowerShell в рабочей области (запрещен запуск бесконечных dev-серверов).`,
  },
  {
    id: 'remember_fact',
    name: 'remember_fact',
    description: 'Сохранение важного факта или правила в долговременную память Агента.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `9. <remember_fact key="..." value="..." category="..." />
   - Сохраняет факт в долговременную память.`,
  },
  {
    id: 'recall_memories',
    name: 'recall_memories',
    description: 'Поиск сохраненных фактов и пользовательских заметок из долговременной памяти.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `10. <recall_memories query="..." />
    - Запрашивает сохраненные факты из памяти.`,
  },
  {
    id: 'list_skills',
    name: 'list_skills',
    description: 'Получение списка всех доступных пользователю файлов скиллов.',
    category: 'skills',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `11. <list_skills />
    - Выводит список доступных скиллов.`,
  },
  {
    id: 'execute_skill',
    name: 'execute_skill',
    description: 'Загрузка и выполнение специализированных инструкций из скилла.',
    category: 'skills',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `12. <execute_skill name="..." args="..." />
    - Загружает инструкции указанного скилла.`,
  },
  {
    id: 'search_sessions',
    name: 'search_sessions',
    description: 'Поиск по прошлым диалогам и сессиям чатов для получения исторического контекста.',
    category: 'sessions',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `13. <search_sessions query="..." />
    - Ищет информацию в истории прошлых сессий.`,
  },
  {
    id: 'run_scratch_script',
    name: 'run_scratch_script',
    description: 'Запуск временного скрипта (Node.js, Python, PowerShell) во временном окружении.',
    category: 'terminal',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `14. <run_scratch_script language="...">code</run_scratch_script>
    - Выполняет временный скрипт для быстрого тестирования гипотез.`,
  },
  {
    id: 'ask_user',
    name: 'ask_user',
    description: 'Запрос уточнения или выбора вариантов у пользователя.',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `15. <ask_user question="..." options="opt1,opt2" />
    - Задает уточняющий вопрос пользователю в интерфейсе.`,
  },
  {
    id: 'spawn_subagent',
    name: 'spawn_subagent',
    description: 'Создание и запуск специализированного дочернего ИИ-агента для автономной подзадачи.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `16. <spawn_subagent role="..." goal="..." />
    - Делегирует задачу узкоспециализированному субагенту.`,
  },
  {
    id: 'save_knowledge',
    name: 'save_knowledge',
    description: 'Сохранение структурированной статьи, инсайта или стратегического анализа в Архив Знаний (Knowledge Vault).',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `17. <save_knowledge title="..." category="..." tags="..." summary="...">content</save_knowledge>
    - Сохранение важной статьи, инсайта или стратегии в Архив Знаний.`,
  },
  {
    id: 'search_knowledge',
    name: 'search_knowledge',
    description: 'Поиск по Архиву Знаний с фильтрацией по теме, тегам и ключевым словам.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `18. <search_knowledge query="..." category="..." tag="..." />
    - Поиск по хранилищу знаний.`,
  },
  {
    id: 'list_knowledge',
    name: 'list_knowledge',
    description: 'Просмотр списка всех сохраненных статей и категорий в Архиве Знаний.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `19. <list_knowledge category="..." />
    - Список статей из архива знаний.`,
  },
  {
    id: 'update_user_profile',
    name: 'update_user_profile',
    description: 'Мгновенное сохранение факта, имени, привычек или предпочтений пользователя в профиль USER.md активной персоны.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `24. <update_user_profile trait="..." category="preferences|profile|knowledge" />
    - Мгновенно сохраняет и дополняет информацию о пользователе в USER.md активной персоны. НЕ создавайте файлы USER.md в корне рабочей области!`,
  },
  {
    id: 'update_persona_file',
    name: 'update_persona_file',
    description: 'Обновление файла активной персоны (SOUL.md, USER.md или TOOLS.md) в системном каталоге ~/.0xagent/personas/.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `25. <update_persona_file file="SOUL.md|USER.md|TOOLS.md">контент</update_persona_file>
    - Обновляет файл активной персоны в системной директории. НЕ пишите файлы персоны в проект!`,
  },
];

export function loadToolsToggles(): Record<string, boolean> {
  try {
    if (fs.existsSync(TOOLS_CONFIG_PATH)) {
      const raw = fs.readFileSync(TOOLS_CONFIG_PATH, 'utf-8');
      const parsed: ToolsConfigState = JSON.parse(raw);
      if (parsed && typeof parsed.toggles === 'object') {
        return parsed.toggles;
      }
    }
  } catch (err) {
    console.error('Failed to read tools_config.json:', err);
  }

  // Fallback: all enabled by default
  const defaultToggles: Record<string, boolean> = {};
  for (const t of DEFAULT_TOOLS_REGISTRY) {
    defaultToggles[t.id] = true;
  }
  return defaultToggles;
}

export function generateToolsMdContent(toggles: Record<string, boolean>): string {
  const activeTools = DEFAULT_TOOLS_REGISTRY.filter((t) => togglingIsEnabled(t.id, toggles));

  let md = `# 🧰 UNIFIED SYSTEM TOOL REGISTRY & XML SPECIFICATION\n`;
  md += `You have access to ${activeTools.length} native execution tools. Always emit valid XML tool calls inside your response:\n\n`;

  activeTools.forEach((tool, index) => {
    // Adapt index in generated prompt XML
    const formattedSpec = tool.xmlSpec.replace(/^\d+\.\s*/, `${index + 1}. `);
    md += `${formattedSpec}\n\n`;
  });

  return md.trim();
}

function togglingIsEnabled(toolId: string, toggles: Record<string, boolean>): boolean {
  if (Object.prototype.hasOwnProperty.call(toggles, toolId)) {
    return Boolean(toggles[toolId]);
  }
  return true;
}

export function saveToolsToggles(toggles: Record<string, boolean>): { tools: ToolDefinition[]; content: string } {
  const dir = path.dirname(TOOLS_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const payload: ToolsConfigState = {
    toggles,
    updated_at: Date.now(),
  };

  fs.writeFileSync(TOOLS_CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  const content = generateToolsMdContent(toggles);
  fs.writeFileSync(UNIFIED_TOOLS_MD_PATH, content, 'utf-8');

  return getToolsState();
}

export function saveCustomToolsMd(content: string): { tools: ToolDefinition[]; content: string } {
  const dir = path.dirname(UNIFIED_TOOLS_MD_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(UNIFIED_TOOLS_MD_PATH, content, 'utf-8');
  return getToolsState();
}

export function loadUnifiedToolsMdContent(): string {
  const toggles = loadToolsToggles();
  const generated = generateToolsMdContent(toggles);

  try {
    const dir = path.dirname(UNIFIED_TOOLS_MD_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(UNIFIED_TOOLS_MD_PATH, generated, 'utf-8');
  } catch (err) {
    console.error('Failed to sync UNIFIED_TOOLS_MD_PATH:', err);
  }

  return generated;
}

export function getToolsState(): { tools: ToolDefinition[]; content: string } {
  const toggles = loadToolsToggles();
  const tools = DEFAULT_TOOLS_REGISTRY.map((tool) => ({
    ...tool,
    enabled: togglingIsEnabled(tool.id, toggles),
  }));

  const content = loadUnifiedToolsMdContent();
  return { tools, content };
}
