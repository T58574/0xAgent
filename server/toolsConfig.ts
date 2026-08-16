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
    description: 'Read file contents in current workspace.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `1. <read_file path="..." />
   - Read exact file content.`,
  },
  {
    id: 'patch_file',
    name: 'patch_file',
    description: 'Apply one or more SEARCH/REPLACE diff blocks to modify existing files.',
    category: 'files',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `2. <patch_file path="...">
<<<<<<< SEARCH
exact lines to replace (3-8 lines)
=======
new replacement lines
>>>>>>> REPLACE
</patch_file>
   - MUST use for modifying existing files. Supports multiple SEARCH/REPLACE blocks.`,
  },
  {
    id: 'write_file',
    name: 'write_file',
    description: 'Create a new file or write tiny config (<50 lines).',
    category: 'files',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `3. <write_file path="...">content</write_file>
   - Create new files only. Use patch_file for existing files.`,
  },
  {
    id: 'list_dir',
    name: 'list_dir',
    description: 'List files and directories.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `4. <list_dir path="..." />
   - List directory entries.`,
  },
  {
    id: 'grep_search',
    name: 'grep_search',
    description: 'Search regex pattern across files.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `5. <grep_search pattern="..." path="..." />
   - Fast regex text search.`,
  },
  {
    id: 'fff_search',
    name: 'fff_search',
    description: 'Fast fuzzy file finder.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `6. <fff_search query="..." />
   - Fast fuzzy path search.`,
  },
  {
    id: 'execute_command',
    name: 'execute_command',
    description: 'Execute PowerShell command in workspace (build, test, git).',
    category: 'terminal',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `7. <execute_command>cmd</execute_command>
   - Run one-off PowerShell command. No long-running background servers.`,
  },
  {
    id: 'create_directory',
    name: 'create_directory',
    description: 'Create directory recursively.',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `8. <create_directory path="..." />
   - Create folder path.`,
  },
  {
    id: 'get_file_info',
    name: 'get_file_info',
    description: 'Get file metadata (size, lines, modified).',
    category: 'files',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `9. <get_file_info path="..." />
   - File metadata.`,
  },
  {
    id: 'web_search',
    name: 'web_search',
    description: 'Search web via SearXNG / DuckDuckGo.',
    category: 'web',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `10. <web_search query="..." />
   - Search web for docs/info.`,
  },
  {
    id: 'read_web_page',
    name: 'read_web_page',
    description: 'Fetch webpage converted to Markdown.',
    category: 'web',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `11. <read_web_page url="..." />
   - Fetch URL as clean Markdown.`,
  },
  {
    id: 'remember_fact',
    name: 'remember_fact',
    description: 'Save permanent fact to long-term memory.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `12. <remember_fact key="..." value="..." category="..." />
   - Save persistent memory fact.`,
  },
  {
    id: 'recall_memories',
    name: 'recall_memories',
    description: 'Search long-term memories.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `13. <recall_memories query="..." />
   - Search memory.`,
  },
  {
    id: 'update_user_profile',
    name: 'update_user_profile',
    description: 'Save user preferences into persona USER.md.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `14. <update_user_profile trait="..." category="preferences|profile" />
   - Update user profile in persona. Do not write USER.md in workspace!`,
  },
  {
    id: 'update_persona_file',
    name: 'update_persona_file',
    description: 'Update persona file (SOUL.md, USER.md, TOOLS.md).',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `15. <update_persona_file file="SOUL.md|USER.md|TOOLS.md">content</update_persona_file>
   - Update persona file.`,
  },
  {
    id: 'todo_write',
    name: 'todo_write',
    description: 'Update live task checklist in UI HUD.',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `16. <todo_write todos='[{"content":"...","status":"pending|in_progress|completed"}]' />
   - Update task checklist.`,
  },
  {
    id: 'ask_user_question',
    name: 'ask_user_question',
    description: 'Prompt interactive question card (single/multi-select, write-in).',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `17. <ask_user_question questions='[{"id":"q1","question":"...","options":[{"label":"A"},{"label":"B"}]}]' />
   - Ask user question in UI.`,
  },
  {
    id: 'code_run',
    name: 'code_run',
    description: 'Run batch JS code in sandbox with tools.* bindings.',
    category: 'interactive',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `18. <code_run>const res = await tools.list_dir({path: '.'}); return res;</code_run>
   - Execute JS code with tools.* in 1 turn.`,
  },
  {
    id: 'spawn_subagent',
    name: 'spawn_subagent',
    description: 'Spawn background autonomous subagent.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `19. <spawn_subagent role="..." goal="..." />
   - Spawn subagent for isolated subtask.`,
  },
  {
    id: 'send_subagent_message',
    name: 'send_subagent_message',
    description: 'Send message to running subagent.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `20. <send_subagent_message subagent_id="..." message="..." />
   - Send instruction to subagent.`,
  },
  {
    id: 'interrupt_subagent',
    name: 'interrupt_subagent',
    description: 'Interrupt running subagent.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `21. <interrupt_subagent subagent_id="..." />
   - Stop subagent.`,
  },
  {
    id: 'list_subagents',
    name: 'list_subagents',
    description: 'List subagents in current session.',
    category: 'agents',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `22. <list_subagents />
   - List subagents.`,
  },
  {
    id: 'save_knowledge',
    name: 'save_knowledge',
    description: 'Save article to Knowledge Vault.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `23. <save_knowledge title="..." category="..." summary="...">content</save_knowledge>
   - Save to Knowledge Vault.`,
  },
  {
    id: 'search_knowledge',
    name: 'search_knowledge',
    description: 'Search Knowledge Vault.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `24. <search_knowledge query="..." />
   - Search Knowledge Vault.`,
  },
  {
    id: 'list_knowledge',
    name: 'list_knowledge',
    description: 'List Knowledge Vault entries.',
    category: 'memory',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `25. <list_knowledge />
   - List Knowledge Vault.`,
  },
  {
    id: 'search_sessions',
    name: 'search_sessions',
    description: 'Search past chat sessions.',
    category: 'sessions',
    requiresApproval: false,
    enabled: true,
    xmlSpec: `26. <search_sessions query="..." />
   - Search past sessions.`,
  },
  {
    id: 'run_scratch_script',
    name: 'run_scratch_script',
    description: 'Run scratch script (Node, Python, PowerShell).',
    category: 'terminal',
    requiresApproval: true,
    enabled: true,
    xmlSpec: `27. <run_scratch_script language="...">code</run_scratch_script>
   - Run scratch test script.`,
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
