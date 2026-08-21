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
    description: 'Чтение содержимого файла в рабочей директории.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `1. <read_file path="..." />
   - Читает точное содержимое файла по относительному пути.`,
  },
  {
    id: 'patch_file',
    name: 'patch_file',
    description: 'Применение SEARCH/REPLACE блоков для точечного изменения существующих файлов.',
    category: 'files',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `2. <patch_file path="...">
<<<<<<< SEARCH
точные строки для замены (3-8 строк)
=======
новые строки
>>>>>>> REPLACE
</patch_file>
   - ОБЯЗАТЕЛЕН для изменения существующих файлов. Поддерживает несколько блоков SEARCH/REPLACE.`,
  },
  {
    id: 'write_file',
    name: 'write_file',
    description: 'Создание нового файла или запись небольшого конфига (<50 строк).',
    category: 'files',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `3. <write_file path="...">содержимое</write_file>
   - Только для создания новых файлов. Для существующих используй patch_file.`,
  },
  {
    id: 'list_dir',
    name: 'list_dir',
    description: 'Просмотр списка файлов и директорий.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `4. <list_dir path="..." />
   - Возвращает дерево файлов и папок в директории.`,
  },
  {
    id: 'grep_search',
    name: 'grep_search',
    description: 'Поиск по регулярному выражению во всех файлах проекта.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `5. <grep_search pattern="..." path="..." />
   - Быстрый поиск вхождений текста или regex по кодовой базе.`,
  },
  {
    id: 'fff_search',
    name: 'fff_search',
    description: 'Мгновенный нечеткий поиск файлов по имени и пути.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `6. <fff_search query="..." />
   - Высокоскоростной нечеткий поиск путей файлов.`,
  },
  {
    id: 'execute_command',
    name: 'execute_command',
    description: 'Выполнение команд PowerShell в рабочей директории (сборка, тесты, git).',
    category: 'terminal',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `7. <execute_command>команда</execute_command>
   - Одноразовые команды PowerShell. Запрещен запуск блокирующих фоновых серверов.`,
  },
  {
    id: 'create_directory',
    name: 'create_directory',
    description: 'Рекурсивное создание директорий.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `8. <create_directory path="..." />
   - Создает структуру папок по указанному пути.`,
  },
  {
    id: 'get_file_info',
    name: 'get_file_info',
    description: 'Получение метаданных файла (размер, число строк, дата изменения).',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `9. <get_file_info path="..." />
   - Возвращает размер, тип и количество строк файла.`,
  },
  {
    id: 'web_search',
    name: 'web_search',
    description: 'Поиск в интернете через локальный SearXNG или DuckDuckGo.',
    category: 'web',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `10. <web_search query="..." />
   - Поиск документации, статей и свежих данных в интернете.`,
  },
  {
    id: 'read_web_page',
    name: 'read_web_page',
    description: 'Загрузка и конвертация веб-страницы в чистый Markdown.',
    category: 'web',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `11. <read_web_page url="..." />
   - Читает страницу по ссылке и возвращает очищенный текст.`,
  },
  {
    id: 'remember_fact',
    name: 'remember_fact',
    description: 'Сохранение важного факта в долговременную память агента.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `12. <remember_fact key="..." value="..." category="..." />
   - Сохраняет персистентный факт в долгосрочную память.`,
  },
  {
    id: 'recall_memories',
    name: 'recall_memories',
    description: 'Поиск фактов и предпочтений в долговременной памяти.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `13. <recall_memories query="..." />
   - Семантический поиск по сохраненным воспоминаниям.`,
  },
  {
    id: 'update_user_profile',
    name: 'update_user_profile',
    description: 'Обновление профиля пользователя в USER.md активной персоны.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `14. <update_user_profile trait="..." category="preferences|profile" />
   - Записывает предпочтения в USER.md персоны. Никогда не создавай USER.md в корне проекта!`,
  },
  {
    id: 'update_persona_file',
    name: 'update_persona_file',
    description: 'Редактирование файлов персоны (SOUL.md, USER.md, TOOLS.md).',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `15. <update_persona_file file="SOUL.md|USER.md|TOOLS.md">текст</update_persona_file>
   - Точечное обновление файлов текущей персоны.`,
  },
  {
    id: 'todo_write',
    name: 'todo_write',
    description: 'Интерактивный список шагов и задач в интерфейсе (HUD).',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `16. <todo_write todos='[{"content":"...","status":"pending|in_progress|completed"}]' />
   - Отображает и обновляет шкалу прогресса и шагов в чате.`,
  },
  {
    id: 'ask_user_question',
    name: 'ask_user_question',
    description: 'Интерактивная карточка вопроса с выбором вариантов или вводом ответа.',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `17. <ask_user_question questions='[{"id":"q1","question":"...","options":[{"label":"А"},{"label":"Б"}]}]' />
   - Задает вопрос пользователю в виде интерактивной формы.`,
  },
  {
    id: 'code_run',
    name: 'code_run',
    description: 'Изолированное выполнение JS-скриптов в песочнице с объектом tools.*.',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `18. <code_run>const res = await tools.list_dir({path: '.'}); return res;</code_run>
   - Пакетное выполнение нескольких вызовов инструментов в один шаг.`,
  },
  {
    id: 'spawn_subagent',
    name: 'spawn_subagent',
    description: 'Запуск фонового автономного субагента для изолированной задачи.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `19. <spawn_subagent role="..." goal="..." />
   - Создает параллельного субагента для исследования или тестирования.`,
  },
  {
    id: 'send_subagent_message',
    name: 'send_subagent_message',
    description: 'Отправка сообщения или указания запущенному субагенту.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `20. <send_subagent_message subagent_id="..." message="..." />
   - Передает новые инструкции работающему субагенту.`,
  },
  {
    id: 'interrupt_subagent',
    name: 'interrupt_subagent',
    description: 'Остановка и прерывание работы субагента.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `21. <interrupt_subagent subagent_id="..." />
   - Немедленно завершает работу субагента.`,
  },
  {
    id: 'list_subagents',
    name: 'list_subagents',
    description: 'Список активных субагентов текущей сессии.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `22. <list_subagents />
   - Возвращает статус всех запущенных субагентов.`,
  },
  {
    id: 'save_knowledge',
    name: 'save_knowledge',
    description: 'Сохранение структурированной статьи в Базу Знаний.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `23. <save_knowledge title="..." category="..." summary="...">текст</save_knowledge>
   - Сохраняет постоянную статью в Базу Знаний проекта.`,
  },
  {
    id: 'search_knowledge',
    name: 'search_knowledge',
    description: 'Поиск статей и заметок в Базе Знаний.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `24. <search_knowledge query="..." />
   - Находит релевантные статьи в Базе Знаний.`,
  },
  {
    id: 'list_knowledge',
    name: 'list_knowledge',
    description: 'Список всех статей в Базе Знаний.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `25. <list_knowledge />
   - Возвращает оглавление Базы Знаний.`,
  },
  {
    id: 'propose_pull_request',
    name: 'propose_pull_request',
    description: 'Формирование атомарного Pull Request для проверки архитектурных правок.',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `26. <propose_pull_request title="..." description="...">
[{"path":"server/routes/api.ts","newContent":"..."}]
</propose_pull_request>
   - Создает предложение изменений с фоновой проверкой TypeScript перед слиянием.`,
  },
  {
    id: 'search_sessions',
    name: 'search_sessions',
    description: 'Поиск по истории прошлых сессий диалога.',
    category: 'sessions',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `27. <search_sessions query="..." />
   - Поиск сообщений в архиве диалогов.`,
  },
  {
    id: 'run_scratch_script',
    name: 'run_scratch_script',
    description: 'Запуск временного скрипта проверки (Node.js, Python, PowerShell).',
    category: 'terminal',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `28. <run_scratch_script language="...">код</run_scratch_script>
   - Исполняет тестовый код в изолированном временном файле.`,
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

  let md = `# TOOL REGISTRY & XML SPECIFICATION\n`;
  md += `You have access to ${activeTools.length} tools. Always emit valid XML tool calls:\n\n`;

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
