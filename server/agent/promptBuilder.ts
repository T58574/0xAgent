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
2. ВСЕГДА используй <patch_file> с компактными SEARCH/REPLACE блоками (3-8 строк) для существующих файлов. Инструмент <write_file> используй только для новых файлов.
3. Используй относительные пути (напр. path="src/index.ts" или path=".").
4. Закрывай все XML-теги инструментов корректно.
5. ОСТАНАВЛИВАЙ ГЕНЕРАЦИЮ сразу после закрывающего тега инструмента. Среда исполнит команду в реальной ОС и вернет ответ в <tool_response name="...">...</tool_response>.
6. НИКОГДА не выдумывай и не симулируй результаты инструментов самостоятельно.`;

  const gemmaToolDirective = isGemmaModel
    ? `\n\n# JSON ФОРМАТ ИНСТРУМЕНТОВ (Gemma 4)\nТы также можешь вызывать инструменты в формате JSON внутри тегов <tool_call>.`
    : '';

  const reasoningDirective = !isReasoningExplicitlyOff && !isGemmaModel
    ? `\n\n# ИНСТРУКЦИИ ДЛЯ БЛОКА РАССУЖДЕНИЙ <THINK>
- Веди весь процесс размышления, анализа задачи и формулирования плана ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ.
- Запрещено вести рассуждения на английском языке, чтобы исключить смешивание языков в итоговом ответе.`
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

  // If this assistant message executed tools but its content lost raw tags (e.g. legacy session),
  // reconstruct the XML tags so the LLM context clearly sees what the assistant requested.
  if (isHistoryAssistant && m.tool_calls && m.tool_calls.length > 0) {
    const hasExistingTags = /<(?:read_file|readfile|write_file|writefile|patch_file|patchfile|list_dir|listdir|grep_search|grepsearch|fff_search|fffsearch|web_search|websearch|read_web_page|readwebpage|execute_command|executecommand|save_knowledge|search_knowledge|list_knowledge|run_scratch_script|ask_user|ask_user_question|spawn_subagent|tool_?call|code_run|todo_write|update_?user_?profile|update_?persona_?file)\b/i.test(content);
    if (!hasExistingTags) {
      const reconstructedTags = m.tool_calls.map((tc) => {
        let argsObj: any = {};
        try {
          argsObj = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments || {};
        } catch {
          argsObj = {};
        }
        if (tc.name === 'list_dir' || tc.name === 'listdir') {
          return `<list_dir path="${argsObj.path || '.'}" />`;
        }
        if (tc.name === 'read_file' || tc.name === 'readfile') {
          return `<read_file path="${argsObj.path || ''}" />`;
        }
        if (tc.name === 'grep_search' || tc.name === 'grepsearch') {
          return `<grep_search pattern="${argsObj.pattern || ''}" path="${argsObj.path || '.'}" />`;
        }
        if (tc.name === 'fff_search' || tc.name === 'fffsearch') {
          return `<fff_search query="${argsObj.query || ''}" />`;
        }
        if (tc.name === 'web_search' || tc.name === 'websearch') {
          return `<web_search query="${argsObj.query || ''}" />`;
        }
        if (tc.name === 'read_web_page' || tc.name === 'readwebpage') {
          return `<read_web_page url="${argsObj.url || ''}" />`;
        }
        if (tc.name === 'execute_command' || tc.name === 'executecommand') {
          return `<execute_command command="${argsObj.command || ''}" />`;
        }
        if (tc.name === 'write_file' || tc.name === 'writefile') {
          return `<write_file path="${argsObj.path || ''}">\n${argsObj.content || ''}\n</write_file>`;
        }
        if (tc.name === 'patch_file' || tc.name === 'patchfile') {
          return `<patch_file path="${argsObj.path || ''}">\n${argsObj.content || ''}\n</patch_file>`;
        }
        return `<${tc.name}>\n${JSON.stringify(argsObj)}\n</${tc.name}>`;
      }).join('\n');

      content = content ? `${content}\n\n${reconstructedTags}` : reconstructedTags;
    }
  }

  // Google DeepMind Gemma 4 Multi-Turn Conversation Rule:
  // "In multi-turn conversations, the historical model output should only include the final response.
  // Thoughts from previous model turns must not be added before the next user turn begins,
  // with the exception of tool call turns where thinking content should be preserved."
  if (isHistoryAssistant && (!m.tool_calls || m.tool_calls.length === 0)) {
    content = content
      .replace(/<(?:think|thought|\|thought\||\|start_thought\|)>[\s\S]*?<\/(?:think|thought|\|thought\||\|end_thought\|)>/gi, '')
      .replace(/<\|?channel\|?>?thought[\s\S]*?<\|?(?:\/channel|channel\|?)>/gi, '')
      .replace(/\[(?:think|thinking)\][\s\S]*?\[\/(?:think|thinking)\]/gi, '')
      .trim();
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
