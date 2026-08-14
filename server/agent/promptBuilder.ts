import { AppConfig, ChatMessage } from '../../src/types';
import { getSystemPromptMemoryContext } from '../memory';
import { getActivePersona, getUnifiedToolsContext } from '../personas';
import { getWorkspace0xAgentMdContext } from '../tools';

export function buildFullSystemPrompt(config: AppConfig): string {
  const memoryContext = getSystemPromptMemoryContext();
  const envContext = `\n\n# OPERATING SYSTEM & SHELL ENVIRONMENT
- OS: Windows (${process.platform})
- Shell: PowerShell (powershell.exe)
- Active Working Directory: ${config.workspace_dir || process.cwd()}

CRITICAL RULES FOR <execute_command>:
1. You are running on Windows inside PowerShell. Write standard PowerShell commands.
2. Do NOT wrap commands in "powershell -Command ...", "powershell -Command cd ...", or explicit "cd <path>". The command is ALREADY executed inside PowerShell in the workspace root directory! Write direct commands like: \`npm run build\`, \`npx tsc --noEmit\`, \`Get-ChildItem\`, \`git status\`.
3. NEVER execute long-running blocking background dev-servers (e.g., 'npm run dev', 'vite', 'npm start') inside <execute_command> as they will run indefinitely and time out. Execute one-off build or test commands instead.`;

  const isPlanningMode = config.planning_mode !== false;
  const planningContext = isPlanningMode
    ? `\n\n# 📋 PLANNING MODE IS ACTIVE
You are operating in Planning Mode.
Before executing modifying tool calls (<write_file>, <patch_file>, <execute_command>), follow this mandatory workflow:
1. RESEARCH & DIAGNOSE: Use read-only tools (<read_file>, <list_dir>, <grep_search>) to inspect existing codebase, imports, types, and find the exact root cause.
2. FORMULATE IMPLEMENTATION PLAN: Clearly present your analysis and proposed solution in your response before or alongside executing actions:
   - Root Cause Analysis
   - Proposed Changes (files to create/modify)
   - Verification Plan
3. Explain your technical rationale concisely.`
    : '';

  const activePersona = getActivePersona();
  const personaContext = `\n\n# ACTIVE AGENT PERSONA: ${activePersona.metadata.name} (${activePersona.metadata.id})

## SOUL.md — CHARACTER & BEHAVIOR
${activePersona.soul}

## USER.md — USER PROFILE & OBSERVED TRAITS (${activePersona.metadata.user_id})
${activePersona.user}

## PERSONA MEMORY & USER PROFILE RULES:
- Active Persona Directory: ~/.0xagent/personas/${activePersona.metadata.id}/
- NEVER create or write USER.md, SOUL.md, or profile files in the user's project workspace directory!
- To quickly remember user preferences, user name, habits, or facts: ALWAYS use the fast tool: <update_user_profile trait="User info here" category="profile" />
- To update persona character or behavior: use <update_persona_file file="SOUL.md">new soul content</update_persona_file>.`;

  const reasoningDirective = `\n\n# REASONING & CHAIN-OF-THOUGHT INSTRUCTIONS:
- You should output your step-by-step reasoning and plan inside <think>...</think> tags before providing your answer or executing tools.
- Everything inside <think>...</think> is processed as internal reasoning and rendered cleanly in the reasoning viewer for the user.`;

  const toolExecutionDirective = `\n\n# CRITICAL INSTRUCTIONS FOR TOOL EXECUTION & CODE MODIFICATIONS
1. EXPLANATION FIRST: Always write a brief natural language explanation of your diagnosis and intended changes BEFORE emitting XML tool calls.
2. MANDATORY PATCH FIRST POLICY: ALWAYS use <patch_file> for modifying existing codebase files. NEVER use <write_file> to rewrite an entire file (>50 lines) just to change a few components or lines!
3. MULTI-BLOCK PATCHES: You can place MULTIPLE SEARCH/REPLACE blocks inside a single <patch_file path="..."> tag to modify multiple places at once. Keep SEARCH blocks concise and unique (3-8 lines).
4. NO RAW CODE PATCH LEAKS: NEVER output raw SEARCH/REPLACE blocks outside of <patch_file path="..."> tags.
5. PROPER XML TAGS: Always close every XML tool call tag (<patch_file path="...">...</patch_file>). Reserve <write_file> strictly for creating new files or tiny config files under 50 lines.`;

  const modelNameLower = (config.model_name || '').toLowerCase();
  const modelPathLower = (config.local_server?.model_path || '').toLowerCase();
  const isGemmaModel = modelNameLower.includes('gemma') || modelPathLower.includes('gemma');

  const gemmaToolDirective = isGemmaModel
    ? `\n\n# ALTERNATIVE TOOL CALL FORMAT (Gemma 4 / JSON)
You may also call tools using JSON format wrapped in <tool_call> tags:
<tool_call>{"name": "read_file", "arguments": {"path": "src/main.ts"}}</tool_call>
<tool_call>{"name": "write_file", "arguments": {"path": "src/main.ts", "content": "file contents here"}}</tool_call>
<tool_call>{"name": "execute_command", "arguments": {"command": "npm run build"}}</tool_call>
<tool_call>{"name": "update_user_profile", "arguments": {"trait": "User preferred theme is matrix", "category": "preferences"}}</tool_call>
<tool_call>{"name": "list_dir", "arguments": {"path": "."}}</tool_call>
<tool_call>{"name": "grep_search", "arguments": {"pattern": "TODO", "path": "src/"}}</tool_call>
<tool_call>{"name": "patch_file", "arguments": {"path": "file.ts", "content": "<<<<<<< SEARCH\nold code\n=======\nnew code\n>>>>>>> REPLACE"}}</tool_call>
Both XML and JSON tool call formats are accepted.`
    : '';

  const unifiedToolsContext = getUnifiedToolsContext();
  const workspaceMdContext = getWorkspace0xAgentMdContext(config.workspace_dir);

  return (
    personaContext +
    reasoningDirective +
    unifiedToolsContext +
    toolExecutionDirective +
    gemmaToolDirective +
    envContext +
    planningContext +
    memoryContext +
    workspaceMdContext
  );
}

export function formatMessageContent(m: ChatMessage): string | any[] {
  if (Array.isArray(m.images) && m.images.length > 0) {
    const parts: any[] = [];
    if (m.content) {
      parts.push({ type: 'text', text: m.content });
    }
    for (const imgUrl of m.images) {
      parts.push({
        type: 'image_url',
        image_url: { url: imgUrl },
      });
    }
    return parts;
  }
  return m.content || '';
}
