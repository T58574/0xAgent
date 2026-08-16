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
- Direct PowerShell commands only. Do not wrap in 'powershell -Command' or 'cd'. Do not run blocking background dev-servers.`;

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

  const toolExecutionDirective = `\n\n# TOOL EXECUTION RULES
1. Provide a brief explanation before emitting XML tool calls.
2. ALWAYS use <patch_file> with concise SEARCH/REPLACE blocks (3-8 lines) for existing files. Reserve <write_file> strictly for new files.
3. Close all XML tool tags properly.`;

  const gemmaToolDirective = isGemmaModel
    ? `\n\n# JSON TOOL FORMAT (Gemma 4)\nYou may also call tools in JSON format wrapped in <tool_call> tags.`
    : '';

  const reasoningDirective = !isReasoningExplicitlyOff && !isGemmaModel
    ? `\n\n# REASONING INSTRUCTIONS\nWhen analyzing tasks or forming code changes, think step-by-step inside <think>...</think> tags before providing the final answer or tool calls.`
    : '';

  const unifiedToolsContext = getUnifiedToolsContext();
  const workspaceMdContext = getWorkspace0xAgentMdContext(config.workspace_dir);

  return (
    thinkTrigger +
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
