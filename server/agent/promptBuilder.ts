import { AppConfig, ChatMessage } from '../../src/types';
import { getSystemPromptMemoryContext } from '../memory';
import { getActivePersona, getUnifiedToolsContext } from '../personas';
import { getWorkspace0xAgentMdContext } from '../tools';
import { isAntigravityModel } from '../veronica/adapters/antigravityAdapter';
import { PRIMARY_TEXT_MODEL } from './llmClient';

export function buildFullSystemPrompt(config: AppConfig, userQuery?: string): string {
  const modelNameLower = (config.model_name || '').toLowerCase();
  const modelPathLower = (config.local_server?.model_path || '').toLowerCase();
  const isGemmaModel = modelNameLower.includes('gemma') || modelPathLower.includes('gemma');
  const isAntigravity = isAntigravityModel(config.model_name || PRIMARY_TEXT_MODEL, config.active_persona_id);

  // Google DeepMind Gemma 4 Trigger Token (local GGUF only):
  // Thinking is enabled by including the <|think|> token strictly for Gemma 4 models.
  const isReasoningExplicitlyOff = config.reasoning_enabled === false || config.reasoning_effort === 'off';
  const thinkTrigger = !isAntigravity && isGemmaModel && !isReasoningExplicitlyOff ? '<|think|>\n' : '';

  const activePersona = getActivePersona();
  const memoryContext = getSystemPromptMemoryContext(activePersona.metadata.id, userQuery, config.workspace_dir || undefined);
  const envContext = `\n\n# SYSTEM ENVIRONMENT
- OS: Windows (${process.platform})
- Shell: PowerShell
- Active Workspace: ${config.workspace_dir || process.cwd()}
- Execution: Commands run directly in PowerShell in workspace root. Do NOT wrap in 'powershell -Command' or 'cd'. Do NOT launch blocking background dev servers (e.g. 'npm run dev', 'vite').
- Paths: ALWAYS use compact relative paths (e.g. 'src/App.tsx', 'server/agent.ts', '.') in commands.`;

  const isPlanningMode = config.planning_mode !== false;
  const planningContext = isPlanningMode
    ? `\n\n# PLANNING & EXPLORATION
Before modifying files, inspect the codebase first, formulate a concise plan, and verify changes after editing.`
    : '';

  const personaContext = isAntigravity
    ? `\n\n# AGENT PERSONA: ${activePersona.metadata.name} (${activePersona.metadata.id})

## SOUL.md
${activePersona.soul}

## USER.md (Global User Profile)
${activePersona.user}`
    : `\n\n# AGENT PERSONA: ${activePersona.metadata.name} (${activePersona.metadata.id})

## SOUL.md
${activePersona.soul}

## USER.md (Global User Profile)
${activePersona.user}

## ISOLATION & MEMORY RULES:
- Each conversation is isolated. Do not carry over unrelated past session state.
- Call <update_user_profile> to store personal preferences into global memory.db.
- Use <propose_persona_change> when suggesting updates to persona directives.
- Never write USER.md or SOUL.md files to the workspace root directory.`;

  const toolExecutionDirective = `\n\n# TOOL EXECUTION PROTOCOL
1. Provide a brief explanation before emitting XML tool tags.
2. TOOL PRIORITIES:
   - Creating files: ALWAYS use <write_file path="...">...</write_file> (parent directories are created automatically).
   - Modifying existing files: ALWAYS use <patch_file path="..."> with compact SEARCH/REPLACE blocks (3-8 lines).
   - Knowledge Base: use <save_knowledge>. User profile: use <update_user_profile>.
   - Persona directives: use <propose_persona_change>.
   - JS runtime (<code_run>): use ONLY for algorithmic calculations, data parsing, or multi-step batch operations. Do NOT wrap simple file creation in JS scripts.
3. Use relative paths (e.g. path="src/index.ts").
4. Close all XML tags properly.
5. STOP GENERATION immediately after the closing XML tag of a tool. The environment will execute it in the real OS and return output in <tool_response name="...">...</tool_response>.
6. NEVER fabricate, simulate, or mock tool outputs yourself.`;

  const gemmaToolDirective = !isAntigravity && isGemmaModel
    ? `\n\n# JSON TOOL FORMAT (Gemma 4)\nYou may also invoke tools in JSON format inside <tool_call> tags.`
    : '';

  const reasoningDirective = !isAntigravity && !isReasoningExplicitlyOff && !isGemmaModel
    ? `\n\n# INSTRUCTIONS FOR REASONING BLOCK <THINK>
1. REASON CONCISELY & ACT IMMEDIATELY: Reason step-by-step about what needs to be inspected, created, or fixed. Keep thoughts compact, direct, and focused on strategy, logic, and tool selection.
2. STRICTLY NO CODE OR DRAFTS IN THINKING: Never write actual code blocks, functions, scripts, patches, or mock file contents inside <think>. Identify the file and change conceptually in 1-2 lines, then output the real code directly inside tool tags (<write_file>, <patch_file>) or the final response.
3. NEVER PRE-COMPOSE OR DRAFT USER RESPONSES: Do NOT draft, rehearse, or simulate the final text response inside <think>. Never formulate explanations twice. Reason about what actions to take, immediately close </think>, and produce your actual response or tool calls directly.
4. REACTIVE THINK-ACT CYCLE: Think briefly -> execute tool or reply -> observe result -> continue iteratively. Do not simulate hypothetical multi-step dialogues or future outputs in advance.
5. CLEAN TAG CLOSURE: Always close the thinking block with </think> BEFORE emitting any XML tool tags or final dialogue. Tool XML tags must ALWAYS be placed outside <think>.`
    : '';

  const languageProtocolDirective = `\n\n# CONVERSATION & LANGUAGE STANDARD:
1. Final responses to the user, explanations, and conversational dialogue must ALWAYS be delivered in the user's language (default: Russian). Speak naturally, clearly, and concisely.
2. Program code, file paths, terminal commands, library names, variable and type names are strictly in English.`;

  const twoTierProtocolDirective = `\n\n# TWO-TIER APPROVAL & INTERACTION PROTOCOL:
You operate under a strict Two-Tier Approval Protocol:

## Tier 1: Quick Replies (Non-blocking Intent Suggestions)
When proposing choices or next steps, you may append a <quick_replies> block with 2 to 4 concise suggestion chips (label <= 25 chars, max 4 items):
<quick_replies>
[
  { "id": "1", "label": "Применить патч", "prompt": "Примени предложенный патч к файлу src/auth.ts", "action_type": "send_prompt" },
  { "id": "2", "label": "Показать diff", "prompt": "Покажи полный diff изменений", "action_type": "open_diff" },
  { "id": "3", "label": "Объяснить логику", "prompt": "Подробно объясни архитектурное решение", "action_type": "explain" }
]
</quick_replies>
XML format is also supported: <quick_response><option key="1" label="Короткий текст" action="Реплика" /></quick_response>
* Invariant: Maximum 4 options. Never output long lists. Keep 'label' strictly concise (2-4 words, <= 25 chars, no sentences, no markdown). Put the full command/question in 'prompt' or 'action'. Clicking a chip only sends the specified prompt to the chat.

## Tier 2: Approval Gate (Blocking Destructive Actions)
Before performing destructive modifications (e.g. patch_file, write_file, delete_file, execute_command, git_push), when in 'prompt' permission mode or when high risk, you MUST call the <request_approval> tool to halt execution and request explicit user confirmation:
<request_approval action_type="patch_file" risk_level="high" preview_summary="Обновление логики авторизации в auth.ts" target_artifacts="[\"src/auth.ts\"]">
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
</request_approval>
The runtime validates cryptographic nonces and hashes before execution.`;

  const veronicaCliDirective = `\n\n# 0XAGENT & VERONICA CLI PROTOCOL
You have direct terminal access to the 0xAgent ecosystem and Veronica Orchestrator via PowerShell:
- Query dense project architecture & context:
  \`0xagent veronica context <project> [--recent] [--architecture]\`
- Read or update project passport & technical metrics:
  \`0xagent veronica doc <project> [get|set|append <text>]\`
- Query operational journal & changelog history:
  \`0xagent veronica history <project> [--limit <N>] [--important]\`
- Inspect active projects & background agent tasks:
  \`0xagent veronica project list\` / \`0xagent veronica agents\`
- Dispatch autonomous background task:
  \`0xagent veronica task create <project> "<skill_or_prompt>"\`
- Send progress heartbeat:
  \`0xagent veronica heartbeat --task <id> --action "<step>" --progress "<pct>"\`
- Submit task completion report & audit log:
  \`0xagent veronica report --task <id> --status completed --summary "<summary>" --changes '["change 1"]' --important\`
- Safe autonomous git commit:
  \`0xagent veronica git commit --task <id> -m "<commit message>"\``;

  const unifiedToolsContext = getUnifiedToolsContext();
  const workspaceMdContext = getWorkspace0xAgentMdContext(config.workspace_dir);

  // Cacheable Stable Prefix
  const stablePrefix = isAntigravity
    ? languageProtocolDirective + envContext + personaContext + veronicaCliDirective
    : languageProtocolDirective +
      twoTierProtocolDirective +
      toolExecutionDirective +
      unifiedToolsContext +
      gemmaToolDirective +
      envContext +
      personaContext;

  // Dynamic Context
  const dynamicContext =
    reasoningDirective +
    planningContext +
    memoryContext +
    workspaceMdContext;

  return thinkTrigger + stablePrefix + dynamicContext;
}

export function formatMessageContent(m: ChatMessage, isHistoryAssistant: boolean = false): string | any[] {
  let content = m.content || '';

  // Tier-2 CoT & Quick Replies Compaction:
  // In multi-turn conversations, historical assistant outputs must NOT retain large thinking blocks or transient quick reply chips.
  // Stripping past reasoning & quick replies prevents context bloat, reduces KV cache memory consumption,
  // and eliminates repetition traps on follow-up turns ("продолжи").
  if (isHistoryAssistant) {
    content = content
      .replace(/<(?:think|thought|thought_process|system_thought|thinking|\|thought\||\|start_thought\|)>[\s\S]*?(?:<\/(?:think|thought|thought_process|system_thought|thinking|\|thought\||\|end_thought\|)>|$)/gi, '')
      .replace(/<\|?channel\|?>?(?:thought|reasoning)[\s\S]*?(?:<\|?(?:\/channel|channel\|?)>|$)/gi, '')
      .replace(/\[(?:think|thinking|thought|thought_process)\][\s\S]*?(?:\[\/(?:think|thinking|thought|thought_process)\]|$)/gi, '')
      .replace(/<quick_replies\b[\s\S]*?(?:<\/quick_replies>|$)/gi, '')
      .replace(/<quick_responses?\b[\s\S]*?(?:<\/quick_responses?>|$)/gi, '')
      .replace(/<option\b[\s\S]*?(?:<\/option>|\/>|$)/gi, '')
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
