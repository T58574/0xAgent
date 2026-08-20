import { AppConfig, ChatMessage } from '../../src/types';
import { getSystemPromptMemoryContext } from '../memory';
import { getActivePersona, getUnifiedToolsContext } from '../personas';
import { getWorkspace0xAgentMdContext } from '../tools';

export function buildFullSystemPrompt(config: AppConfig): string {
  const modelNameLower = (config.model_name || '').toLowerCase();
  const modelPathLower = (config.local_server?.model_path || '').toLowerCase();
  const isGemmaModel = modelNameLower.includes('gemma') || modelPathLower.includes('gemma');

  // Google DeepMind Gemma 4 Trigger Token:
  // Thinking is enabled by including the <|think|> token strictly for Gemma 4 models.
  const isReasoningExplicitlyOff = config.reasoning_enabled === false || config.reasoning_effort === 'off';
  const thinkTrigger = isGemmaModel && !isReasoningExplicitlyOff ? '<|think|>\n' : '';

  const memoryContext = getSystemPromptMemoryContext();
  const envContext = `\n\n# ОКРУЖЕНИЕ СИСТЕМЫ
- ОС: Windows (${process.platform})
- Оболочка: PowerShell
- Рабочая директория: ${config.workspace_dir || process.cwd()}
- Команды исполняются напрямую в PowerShell. Не оборачивай в 'powershell -Command' или 'cd'. Не запускай блокирующие фоновые серверы разработки.
- ВСЕГДА используй компактные относительные пути (напр. 'src/App.tsx', 'server/agent.ts', '.') в вызовах инструментов и командах.`;

  const isPlanningMode = config.planning_mode !== false;
  const planningContext = isPlanningMode
    ? `\n\n# РЕЖИМ ПЛАНИРОВАНИЯ
Перед изменением файлов сначала изучи кодовую базу (<read_file>, <list_dir>, <grep_search>), сформулируй краткий план и проверь изменения.`
    : '';

  const activePersona = getActivePersona();
  const personaContext = `\n\n# ПЕРСОНА АГЕНТА: ${activePersona.metadata.name} (${activePersona.metadata.id})

## SOUL.md
${activePersona.soul}

## USER.md (${activePersona.metadata.user_id})
${activePersona.user}

## ПРАВИЛА ИЗОЛЯЦИИ И ПАМЯТИ:
- Каждый диалог строго изолирован. Не переноси контекст из прошлых несвязанных сессий.
- Вызывай <update_user_profile> только когда пользователь явно просит запомнить личные предпочтения.
- Никогда не создавай файлы USER.md или SOUL.md в корне рабочего пространства.`;

  const toolExecutionDirective = `\n\n# ПРОТОКОЛ ВЫЗОВА ИНСТРУМЕНТОВ
1. Давай краткое пояснение перед вызовом XML-тегов инструментов.
2. ПРИОРИТЕТ АТОМАРНЫХ ИНСТРУМЕНТОВ:
   - Для создания файлов ВСЕГДА используй <write_file path="...">...</write_file> (родительские директории создаются автоматически).
   - Для модификации существующих файлов ВСЕГДА используй <patch_file path="..."> с компактными SEARCH/REPLACE блоками (3-8 строк).
   - Для базы знаний используй <save_knowledge>, для профиля пользователя — <update_user_profile>.
   - Инструмент <code_run> используй ТОЛЬКО для алгоритмических расчетов, парсинга данных или сложных пакетных операций. НЕ оборачивай простое создание 1-2 файлов в громоздкие JS-скрипты.
3. Используй относительные пути (напр. path="src/index.ts" или path="notes/profiles/identity.md").
4. Закрывай все XML-теги инструментов корректно.
5. ОСТАНАВЛИВАЙ ГЕНЕРАЦИЮ сразу после закрывающего тега инструмента. Среда исполнит команду в реальной ОС и вернет ответ в <tool_response name="...">...</tool_response>.
6. НИКОГДА не выдумывай и не симулируй результаты инструментов самостоятельно.`;

  const gemmaToolDirective = isGemmaModel
    ? `\n\n# JSON ФОРМАТ ИНСТРУМЕНТОВ (Gemma 4)\nТы также можешь вызывать инструменты в формате JSON внутри тегов <tool_call>.`
    : '';

  const reasoningDirective = !isReasoningExplicitlyOff && !isGemmaModel
    ? `\n\n# ИНСТРУКЦИИ ДЛЯ БЛОКА РАССУЖДЕНИЙ <THINK>
1. Веди весь процесс размышления, анализа задачи и формулирования плана ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ.
2. АРХИТЕКТУРНЫЙ ФОКУС: В блоке рассуждений формулируй стратегию, логику и выбор инструментов.
3. ЗАПРЕТ ЧЕРНОВИКОВ ФАЙЛОВ В МЫСЛЯХ: Категорически запрещено прописывать полный текст файлов, шаблоны или длинные патчи внутри блока рассуждений. Текст файлов сразу пишется в тело целевого инструмента (<write_file>, <patch_file>, <save_knowledge>).
4. ЭФФЕКТИВНОСТЬ: Избегай зацикливания и многократного повторения одних и тех же мыслей.
5. ТЕГИ ИНСТРУМЕНТОВ ВНЕ МЫСЛЕЙ: Всегда закрывай блок размышлений тегом </think> ПЕРЕД вызовом XML-тегов инструментов! Вызовы инструментов ВСЕГДА должны быть снаружи блока <think>.`
    : '';

  const languageProtocolDirective = `\n\n# ГЛАВНЫЙ ЯЗЫКОВОЙ СТАНДАРТ (СТРОЖАЙШИЙ ЗАПРЕТ СМЕШИВАНИЯ ЯЗЫКОВ):
1. ВСЕ рассуждения (<think>), весь диалог, все объяснения и заголовки формулируй ИСКЛЮЧИТЕЛЬНО НА ЧИСТОМ И ГРАМОТНОМ РУССКОМ ЯЗЫКЕ.
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать английские слова, фразы, заголовки или предложения внутри русского текста (полный запрет на рунглиш/Chinglish).
3. Все термины формулируй по-русски или сопровождай понятным русским пояснением.
4. Английский язык разрешен СТРОГО И ТОЛЬКО для: программного кода, имен переменных/функций/типов, команд терминала и официальных названий компаний/моделей (OpenAI, Anthropic, Gemma, Qwen, DeepSeek).`;

  const unifiedToolsContext = getUnifiedToolsContext();
  const workspaceMdContext = getWorkspace0xAgentMdContext(config.workspace_dir);

  return (
    thinkTrigger +
    languageProtocolDirective +
    personaContext +
    unifiedToolsContext +
    toolExecutionDirective +
    gemmaToolDirective +
    reasoningDirective +
    envContext +
    planningContext +
    memoryContext +
    workspaceMdContext
  );
}

export function formatMessageContent(m: ChatMessage, isHistoryAssistant: boolean = false): string | any[] {
  let content = m.content || '';

  // Tier-2 CoT Compaction:
  // In multi-turn conversations, historical assistant outputs must NOT retain large thinking blocks.
  // Stripping past reasoning prevents context bloat, reduces KV cache memory consumption,
  // and eliminates repetition traps on follow-up turns ("продолжи").
  if (isHistoryAssistant) {
    content = content
      .replace(/<(?:think|thought|thinking|\|thought\||\|start_thought\|)>[\s\S]*?(?:<\/(?:think|thought|thinking|\|thought\||\|end_thought\|)>|$)/gi, '')
      .replace(/<\|?channel\|?>?thought[\s\S]*?(?:<\|?(?:\/channel|channel\|?)>|$)/gi, '')
      .replace(/\[(?:think|thinking|thought)\][\s\S]*?(?:\[\/(?:think|thinking|thought)\]|$)/gi, '')
      .trim();

    // If this assistant message executed tools, ensure XML tool tags remain in content
    // Check and reconstruct each tool call individually so no tool call is lost if partially inside/outside <think>
    if (m.tool_calls && m.tool_calls.length > 0) {
      const missingTags: string[] = [];

      for (const tc of m.tool_calls) {
        let argsObj: any = {};
        try {
          argsObj = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments || {};
        } catch {
          argsObj = {};
        }

        const tagPattern = new RegExp(`<(?:${tc.name}|${tc.name.replace(/_/g, '')})\\b`, 'i');
        const alreadyPresent = tagPattern.test(content) && (!argsObj.path || content.includes(argsObj.path));

        if (!alreadyPresent) {
          if (tc.name === 'list_dir' || tc.name === 'listdir') {
            missingTags.push(`<list_dir path="${argsObj.path || '.'}" />`);
          } else if (tc.name === 'read_file' || tc.name === 'readfile') {
            missingTags.push(`<read_file path="${argsObj.path || ''}" />`);
          } else if (tc.name === 'grep_search' || tc.name === 'grepsearch') {
            missingTags.push(`<grep_search pattern="${argsObj.pattern || ''}" path="${argsObj.path || '.'}" />`);
          } else if (tc.name === 'fff_search' || tc.name === 'fffsearch') {
            missingTags.push(`<fff_search query="${argsObj.query || ''}" />`);
          } else if (tc.name === 'web_search' || tc.name === 'websearch') {
            missingTags.push(`<web_search query="${argsObj.query || ''}" />`);
          } else if (tc.name === 'read_web_page' || tc.name === 'readwebpage') {
            missingTags.push(`<read_web_page url="${argsObj.url || ''}" />`);
          } else if (tc.name === 'execute_command' || tc.name === 'executecommand') {
            missingTags.push(`<execute_command command="${argsObj.command || ''}" />`);
          } else if (tc.name === 'write_file' || tc.name === 'writefile') {
            missingTags.push(`<write_file path="${argsObj.path || ''}">\n${argsObj.content || ''}\n</write_file>`);
          } else if (tc.name === 'patch_file' || tc.name === 'patchfile') {
            missingTags.push(`<patch_file path="${argsObj.path || ''}">\n${argsObj.content || ''}\n</patch_file>`);
          } else {
            missingTags.push(`<${tc.name}>\n${JSON.stringify(argsObj)}\n</${tc.name}>`);
          }
        }
      }

      if (missingTags.length > 0) {
        content = content ? `${content}\n\n${missingTags.join('\n')}` : missingTags.join('\n');
      }
    }
  }

  if (Array.isArray(m.images) && m.images.length > 0) {
    const parts: any[] = [];
    if (content) {
      parts.push({ type: 'text', text: content });
    }
    for (const imgUrl of m.images) {
      parts.push({
        type: 'image_url',
        image_url: { url: imgUrl },
      });
    }
    return parts;
  }
  return content;
}
