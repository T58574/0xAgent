import { v4 as uuidv4 } from 'uuid';

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: any;
  raw_content: string;
}

const TOOL_NAME_MAP: Record<string, string> = {
  read_file: 'read_file', readfile: 'read_file',
  write_file: 'write_file', writefile: 'write_file',
  patch_file: 'patch_file', patchfile: 'patch_file',
  list_dir: 'list_dir', listdir: 'list_dir', list_directory: 'list_dir',
  grep_search: 'grep_search', grepsearch: 'grep_search', search: 'grep_search',
  execute_command: 'execute_command', executecommand: 'execute_command', run_command: 'execute_command', runcommand: 'execute_command', shell: 'execute_command',
  create_directory: 'create_directory', createdirectory: 'create_directory',
  get_file_info: 'get_file_info', getfileinfo: 'get_file_info',
  remember_fact: 'remember_fact', recall_memories: 'recall_memories',
  ask_user: 'ask_user', ask_user_question: 'ask_user_question',
  todo_write: 'todo_write', todowrite: 'todo_write',
  code_run: 'code_run', coderun: 'code_run',
  fff_search: 'fff_search', fffsearch: 'fff_search', fff: 'fff_search', file_finder: 'fff_search',
  web_search: 'web_search', websearch: 'web_search', google_search: 'web_search',
  read_web_page: 'read_web_page', readwebpage: 'read_web_page', browse_url: 'read_web_page', read_url: 'read_web_page',
  save_knowledge: 'save_knowledge', saveknowledge: 'save_knowledge',
  search_knowledge: 'search_knowledge', searchknowledge: 'search_knowledge',
  list_knowledge: 'list_knowledge', listknowledge: 'list_knowledge',
  update_user_profile: 'update_user_profile', updateuserprofile: 'update_user_profile', user_profile: 'update_user_profile', update_profile: 'update_user_profile',
  update_persona_file: 'update_persona_file', updatepersonafile: 'update_persona_file', persona_file: 'update_persona_file',
};

function tryParseJson(text: string): any {
  try { return JSON.parse(text.trim()); } catch { return null; }
}

function parseAttrOrBody(body: string, key: string): string {
  const json = tryParseJson(body);
  if (json && json[key]) return String(json[key]);
  const match = new RegExp(`${key}\\s*[:=]\\s*["']([^"']+)["']`, 'i').exec(body);
  return match ? match[1] : '';
}

interface RuleResult {
  idPrefix: string;
  name: string;
  args: any;
  customCondition?: (calls: ParsedToolCall[], raw: string) => boolean;
}

interface ToolRule {
  regex: RegExp;
  handler: (match: RegExpExecArray, calls: ParsedToolCall[]) => RuleResult | null | void;
}

const DECLARATIVE_RULES: ToolRule[] = [
  // 1. read_file
  { regex: /<(?:read_file|readfile)\s+path=["']([^"']+)["']\s*(?:\/>|>([\s\S]*?)<\/(?:read_file|readfile)>|>)/gi, handler: (m) => ({ idPrefix: 'read', name: 'read_file', args: { path: m[1] } }) },
  {
    regex: /<(?:read_file|readfile)\s*>([\s\S]*?)<\/(?:read_file|readfile)>/gi,
    handler: (m) => {
      const targetPath = parseAttrOrBody(m[1].trim(), 'path') || m[1].trim();
      return targetPath ? { idPrefix: 'read', name: 'read_file', args: { path: targetPath } } : null;
    },
  },
  // 2. write_file
  { regex: /<(?:write_file|writefile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/(?:write_file|writefile)>/gi, handler: (m) => ({ idPrefix: 'write', name: 'write_file', args: { path: m[1], content: m[2] } }) },
  {
    regex: /<(?:write_file|writefile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)(?:<\/(?:write_file|writefile)>|(?=<write_file|<writefile|<patch_file|<patchfile|<read_file|<readfile|<execute_command|<executecommand|$))/gi,
    handler: (m) => ({
      idPrefix: 'write', name: 'write_file', args: { path: m[1], content: m[2].trim() },
      customCondition: (calls, raw) => !calls.some((tc) => tc.raw_content === raw || (tc.name === 'write_file' && tc.arguments.path === m[1])),
    }),
  },
  // 3. patch_file
  { regex: /<(?:patch_file|patchfile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/(?:patch_file|patchfile)>/gi, handler: (m) => ({ idPrefix: 'patch', name: 'patch_file', args: { path: m[1], content: m[2] } }) },
  {
    regex: /<(?:patch_file|patchfile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)(?:<\/(?:patch_file|patchfile)>|(?=<patch_file|<patchfile|<write_file|<writefile|<read_file|<readfile|<execute_command|<executecommand|$))/gi,
    handler: (m) => {
      const content = m[2].trim().replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/i, '');
      return content.includes('<<<<<<< SEARCH') ? {
        idPrefix: 'patch', name: 'patch_file', args: { path: m[1], content },
        customCondition: (calls, raw) => !calls.some((tc) => tc.raw_content === raw || (tc.name === 'patch_file' && tc.arguments.path === m[1])),
      } : null;
    },
  },
  // 4. list_dir
  { regex: /<(?:list_dir|listdir|list_directory)(?:\s+path=["']([^"']*)["'])?\s*(?:\/>|>([\s\S]*?)<\/(?:list_dir|listdir|list_directory)>|>)/gi, handler: (m) => ({ idPrefix: 'list', name: 'list_dir', args: { path: (m[1] || (m[2] ? m[2].trim() : '') || '.').replace(/^["']|["']$/g, '').trim() || '.' } }) },
  { regex: /<(?:list_dir|listdir|list_directory)\s*>([\s\S]*?)<\/(?:list_dir|listdir|list_directory)>/gi, handler: (m) => ({ idPrefix: 'list', name: 'list_dir', args: { path: (parseAttrOrBody(m[1].trim(), 'path') || m[1].trim() || '.').trim() || '.' } }) },
  // 5. grep_search
  { regex: /<(?:grep_search|grepsearch)\s+pattern=["']([^"']+)["'](?:\s+path=["']([^"']*)["'])?\s*\/?>/gi, handler: (m) => ({ idPrefix: 'grep', name: 'grep_search', args: { pattern: m[1], path: m[2] || '.' } }) },
  { regex: /<(?:grep_search|grepsearch)\s+path=["']([^"']*)["']\s+pattern=["']([^"']+)["']\s*\/?>/gi, handler: (m) => ({ idPrefix: 'grep', name: 'grep_search', args: { pattern: m[2], path: m[1] || '.' } }) },
  {
    regex: /<(?:grep_search|grepsearch)\s*>([\s\S]*?)<\/(?:grep_search|grepsearch)>/gi,
    handler: (m) => {
      const body = m[1].trim();
      const json = tryParseJson(body);
      const pattern = json?.pattern || parseAttrOrBody(body, 'pattern') || (!body.includes('\n') ? body : '');
      const grepPath = json?.path || parseAttrOrBody(body, 'path') || '.';
      return pattern ? { idPrefix: 'grep', name: 'grep_search', args: { pattern, path: grepPath } } : null;
    },
  },
  // 6. search_session_history, fff_search, web_search, read_web_page
  { regex: /<search_session_history\s+query=["']([^"']+)["']\s*\/?>/gi, handler: (m) => ({ idPrefix: 'search_hist', name: 'search_session_history', args: { query: m[1] } }) },
  { regex: /<(?:fff_search|fffsearch)\s+query=["']([^"']+)["']\s*\/?>/gi, handler: (m) => ({ idPrefix: 'fff', name: 'fff_search', args: { query: m[1] } }) },
  { regex: /<(?:fff_search|fffsearch)\s*>([\s\S]*?)<\/(?:fff_search|fffsearch)>/gi, handler: (m) => ({ idPrefix: 'fff', name: 'fff_search', args: { query: m[1].trim() } }) },
  { regex: /<(?:web_search|websearch)\s+query=["']([^"']+)["']\s*\/?>/gi, handler: (m) => ({ idPrefix: 'web', name: 'web_search', args: { query: m[1] } }) },
  { regex: /<(?:read_web_page|readwebpage)\s+url=["']([^"']+)["']\s*\/?>/gi, handler: (m) => ({ idPrefix: 'readweb', name: 'read_web_page', args: { url: m[1] } }) },
  // 7. Knowledge base tools
  {
    regex: /<save_knowledge\s+title=["']([^"']+)["'](?:\s+category=["']([^"']+)["'])?(?:\s+tags=["']([^"']+)["'])?(?:\s+summary=["']([^"']+)["'])?\s*>([\s\S]*?)<\/save_knowledge>/gi,
    handler: (m) => ({ idPrefix: 'savekb', name: 'save_knowledge', args: { title: m[1], category: m[2] || 'general', tags: m[3] ? m[3].split(',').map((t) => t.trim()) : [], summary: m[4] || '', content: m[5].trim() } }),
  },
  { regex: /<search_knowledge(?:\s+query=["']([^"']+)["'])?(?:\s+category=["']([^"']+)["'])?(?:\s+tag=["']([^"']+)["'])?\s*\/?>/gi, handler: (m) => ({ idPrefix: 'searchkb', name: 'search_knowledge', args: { query: m[1] || '*', category: m[2] || undefined, tag: m[3] || undefined } }) },
  { regex: /<list_knowledge(?:\s+category=["']([^"']+)["'])?\s*\/?>/gi, handler: (m) => ({ idPrefix: 'listkb', name: 'list_knowledge', args: { category: m[1] || undefined } }) },
  // 8. Persona & Profile
  {
    regex: /<update_?user_?profile\b([^>]*?)(?:\/>|>([\s\S]*?)<\/update_?user_?profile>|>)/gi,
    handler: (m) => {
      const trait = (/trait=["']([^"']*)["']/i.exec(m[1] || '')?.[1] || (m[2] || '')).trim();
      const category = (/category=["']([^"']*)["']/i.exec(m[1] || '')?.[1] || 'profile').trim();
      return trait ? { idPrefix: 'profile', name: 'update_user_profile', args: { trait, category } } : null;
    },
  },
  { regex: /<update_?persona_?file\b(?:\s+file=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/update_?persona_?file>/gi, handler: (m) => ({ idPrefix: 'persona', name: 'update_persona_file', args: { file: m[1] || 'SOUL.md', content: m[2] ? m[2].trim() : '' } }) },
  // 9. Exec & Interactive tools
  { regex: /<(?:execute_command|executecommand|run_command|runcommand)\s+command=["']([^"']+)["']\s*\/?>/gi, handler: (m) => ({ idPrefix: 'exec', name: 'execute_command', args: { command: m[1] } }) },
  { regex: /<(?:execute_command|executecommand|run_command|runcommand)\s*>([\s\S]*?)<\/(?:execute_command|executecommand|run_command|runcommand)>/gi, handler: (m) => ({ idPrefix: 'exec', name: 'execute_command', args: { command: m[1].trim() } }) },
  { regex: /<ask_user\s+question=["']([^"']+)["'](?:\s+options=["']([^"']+)["'])?\s*\/?>/gi, handler: (m) => ({ idPrefix: 'ask', name: 'ask_user', args: { question: m[1], options: m[2] ? m[2].split(',').map((o) => o.trim()).filter(Boolean) : undefined } }) },
  {
    regex: /<ask_?user_?questions?\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ask_?user_?questions?>|>)/gi,
    handler: (m) => {
      const attrStr = m[1] || '', bodyStr = (m[2] || '').trim();
      let parsedArgs: any = bodyStr ? tryParseJson(bodyStr) : null;
      if (parsedArgs && Array.isArray(parsedArgs)) parsedArgs = { questions: parsedArgs };
      if (!parsedArgs && bodyStr && !attrStr.includes('questions=') && !attrStr.includes('question=')) {
        parsedArgs = { questions: [{ id: 'q1', question: bodyStr }] };
      }
      if (!parsedArgs) {
        const qAttr = /questions=(?:'([^']*)'|"([^"]*)")/i.exec(attrStr);
        const p = qAttr ? tryParseJson(qAttr[1] || qAttr[2]) : null;
        if (p) parsedArgs = Array.isArray(p) ? { questions: p } : p;
      }
      if (!parsedArgs) {
        const qMatch = /question=["']([^"']*)["']/i.exec(attrStr);
        const optMatch = /options=["']([^"']*)["']/i.exec(attrStr);
        if (qMatch) {
          let opts: any[] = [];
          if (optMatch) {
            const pOpts = tryParseJson(optMatch[1]);
            opts = Array.isArray(pOpts) ? pOpts : (pOpts ? [pOpts] : optMatch[1].split(',').map((o) => ({ label: o.trim() })).filter((o) => o.label));
          }
          parsedArgs = { questions: [{ id: 'q1', question: qMatch[1], options: opts.length > 0 ? opts : undefined }] };
        }
      }
      return parsedArgs ? { idPrefix: 'askq', name: 'ask_user_question', args: parsedArgs } : null;
    },
  },
  {
    regex: /<(?:todo_write|todowrite|todo_items)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:todo_write|todowrite|todo_items)>|>)/gi,
    handler: (m) => {
      const bodyStr = (m[2] || '').trim();
      const todos = (bodyStr ? tryParseJson(bodyStr) : null) || tryParseJson(/todos=(?:'([^']*)'|"([^"]*)")/i.exec(m[1] || '')?.[1] || /todos=(?:'([^']*)'|"([^"]*)")/i.exec(m[1] || '')?.[2] || '');
      return todos ? { idPrefix: 'todo', name: 'todo_write', args: Array.isArray(todos) ? { todos } : todos } : null;
    },
  },
  {
    regex: /<(?:code_run|coderun)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:code_run|coderun)>|>)/gi,
    handler: (m) => {
      const script = (m[2] || '').trim() || (/script=(?:'([^']*)'|"([^"]*)")/i.exec(m[1] || '')?.[1] || /script=(?:'([^']*)'|"([^"]*)")/i.exec(m[1] || '')?.[2] || '').trim();
      return script ? { idPrefix: 'code', name: 'code_run', args: { script } } : null;
    },
  },
  { regex: /<run_scratch_script\s+language=["']([^"']+)["']\s*>([\s\S]*?)<\/run_scratch_script>/gi, handler: (m) => ({ idPrefix: 'scratch', name: 'run_scratch_script', args: { language: m[1], code: m[2] } }) },
  { regex: /<spawn_subagent\s+task=["']([^"']+)["'](?:\s+role=["']([^"']+)["'])?\s*\/?>/gi, handler: (m) => ({ idPrefix: 'subagent', name: 'spawn_subagent', args: { task: m[1], role: m[2] || 'helper' } }) },
];

function parseGemmaToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  const reToolCall = /<tool_?call>([\s\S]*?)<\/tool_?call>/gi;
  let match: RegExpExecArray | null;

  while ((match = reToolCall.exec(text)) !== null) {
    const raw = match[1].trim();
    let name = '', args: any = {};
    const parsed = tryParseJson(raw);
    if (parsed && typeof parsed === 'object') {
      name = parsed.name || parsed.function || '';
      args = parsed.arguments || parsed.parameters || {};
    } else {
      name = /["']?name["']?\s*[:=]\s*["']([^"']+)["']/i.exec(raw)?.[1] || '';
      if (!name) {
        for (const candidateKey of Object.keys(TOOL_NAME_MAP)) {
          if (new RegExp(`\\b${candidateKey}\\b`, 'i').test(raw)) { name = candidateKey; break; }
        }
      }
      for (const k of ['path', 'pattern', 'query', 'url', 'command', 'content', 'trait', 'category', 'file']) {
        const valMatch = new RegExp(`${k}=["']([^"']*)["']`, 'i').exec(raw);
        if (valMatch) args[k] = valMatch[1];
      }
    }

    if (!name) {
      for (const candidateKey of Object.keys(TOOL_NAME_MAP)) {
        if (new RegExp(`\\b${candidateKey}\\b`, 'i').test(raw)) { name = candidateKey; break; }
      }
    }

    const mappedName = TOOL_NAME_MAP[name.toLowerCase()] || TOOL_NAME_MAP[name] || name;
    if (mappedName && !toolCalls.some((tc) => tc.raw_content === match![0])) {
      toolCalls.push({ id: `gemma_${uuidv4().substring(0, 8)}`, name: mappedName, arguments: args, raw_content: match[0] });
    }
  }
}

export function parseToolCalls(text: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];
  const sanitizedText = (text || '').replace(/```(?:xml|html|json|tsx|ts)?/gi, '').replace(/```$/gm, '');

  for (const rule of DECLARATIVE_RULES) {
    const re = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(sanitizedText)) !== null) {
      const raw = match[0];
      const res = rule.handler(match, toolCalls);
      if (!res) continue;
      const isAllowed = res.customCondition ? res.customCondition(toolCalls, raw) : !toolCalls.some((tc) => tc.raw_content === raw);
      if (isAllowed) {
        toolCalls.push({ id: `${res.idPrefix}_${uuidv4().substring(0, 8)}`, name: res.name, arguments: res.args, raw_content: raw });
      }
    }
  }

  parseGemmaToolCalls(sanitizedText, toolCalls);
  return toolCalls;
}

export function detectToolOutputHallucination(text: string): boolean {
  if (!text) return false;
  return /(?:\[Tool\s+[a-z_]+\s*(?:\[[^\]]*\])?\s*output:|<tool_response\b|\[TOOL_RESULT\b|Tool\s+[a-z_]+\s*\[[a-z0-9_-]+\]\s*output:)/i.test(text);
}

export function stripHallucinatedToolOutput(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[Tool\s+[a-z_]+[\s\S]*?(?:\](?=\s*(?:\[Tool|<|$))|(?=\[Tool|<|$))/gi, '')
    .replace(/<tool_response\b[\s\S]*?(?:<\/tool_response>|$)/gi, '')
    .replace(/\[TOOL_RESULT\b[\s\S]*?(?:\[\/TOOL_RESULT\]|$)/gi, '')
    .replace(/Tool\s+[a-z_]+\s*\[[a-z0-9_-]+\]\s*output:[\s\S]*?(?=(?:Tool\s+[a-z_]+\s*\[|<|$))/gi, '')
    .trim();
}
