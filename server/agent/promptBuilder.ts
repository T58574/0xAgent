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
  const envContext = `\n\n# ENVIRONMENT
- OS: Windows (${process.platform})
- Shell: PowerShell
- Workspace: ${config.workspace_dir || process.cwd()}
- Direct PowerShell commands only. Do not wrap in 'powershell -Command' or 'cd'. Do not run blocking background dev-servers.
- ALWAYS use compact relative paths (e.g. 'src/App.tsx', 'server/agent.ts', '.') in tool calls and commands. Avoid redundant absolute drive paths ('C:\\Users\\...').`;

  const isPlanningMode = config.planning_mode !== false;
  const planningContext = isPlanningMode
    ? `\n\n# PLANNING MODE
Before modifying files, inspect codebase first (<read_file>, <list_dir>, <grep_search>), state brief plan, and verify changes.`
    : '';

  const activePersona = getActivePersona();
  const personaContext = `\n\n# AGENT PERSONA: ${activePersona.metadata.name} (${activePersona.metadata.id})

## SOUL.md
${activePersona.soul}

## USER.md (${activePersona.metadata.user_id})
${activePersona.user}

## ISOLATION & MEMORY RULES:
- Each conversation is strictly isolated. Do not bleed context from past dialogues.
- Only call <update_user_profile> when the user explicitly requests to remember personal preferences.
- Never write USER.md or SOUL.md to workspace directory.`;

  const toolExecutionDirective = `\n\n# TOOL EXECUTION & ENVIRONMENT INTERACTION PROTOCOL
1. Provide a brief explanation before emitting XML tool calls.
2. ALWAYS use <patch_file> with concise SEARCH/REPLACE blocks (3-8 lines) for existing files. Reserve <write_file> strictly for new files.
3. Use compact relative paths for path attributes (e.g. path="src/index.ts" or path=".").
4. Close all XML tool tags properly.
5. STOP GENERATING immediately after emitting tool tags. The execution engine runs the tool in the real OS environment and returns the real result in a <tool_response name="...">...</tool_response> message.
6. NEVER fabricate, simulate, or hallucinate tool outputs yourself (such as writing "[Tool ... output:]" or "<tool_response>" in your response). You only output the tool CALL tag and wait for the real environment response.`;

  const gemmaToolDirective = isGemmaModel
    ? `\n\n# JSON TOOL FORMAT (Gemma 4)\nYou may also call tools in JSON format wrapped in <tool_call> tags.`
    : '';

  const reasoningDirective = !isReasoningExplicitlyOff && !isGemmaModel
    ? `\n\n# REASONING INSTRUCTIONS\nWhen analyzing tasks or forming code changes, think step-by-step inside <think>...</think> tags in RUSSIAN before providing the final answer or tool calls.`
    : '';

  const languageProtocolDirective = `\n\n# LANGUAGE & COMMUNICATION PROTOCOL
- You MUST ALWAYS communicate, converse, explain, think, and answer the user STRICTLY IN RUSSIAN (Русский язык).
- Code, code blocks, variables, function names, types, terminal commands, and technical identifiers MUST remain in ENGLISH.
- Never output mixed English conversational sentences or switch to English when explaining code. All explanations must be fluent, natural Russian.`;

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
