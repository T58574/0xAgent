import { v4 as uuidv4 } from 'uuid';

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: any;
  raw_content: string;
}

function parseFileToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  let match: RegExpExecArray | null;

  // 1. Read File: <read_file path="..." />, <readfile path="..." />, <read_file path="..."></read_file>, <read_file>path</read_file>
  const reReadAttr = /<(?:read_file|readfile)\s+path=["']([^"']+)["']\s*(?:\/>|>([\s\S]*?)<\/(?:read_file|readfile)>|>)/gi;
  while ((match = reReadAttr.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `read_${uuidv4().substring(0, 8)}`,
        name: 'read_file',
        arguments: { path: match[1] },
        raw_content: raw,
      });
    }
  }

  const reReadBody = /<(?:read_file|readfile)\s*>([\s\S]*?)<\/(?:read_file|readfile)>/gi;
  while ((match = reReadBody.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const body = match[1].trim();
      let targetPath = body;
      try {
        const parsed = JSON.parse(body);
        if (parsed.path) targetPath = parsed.path;
      } catch {
        const pathMatch = /path\s*[:=]\s*["']([^"']+)["']/i.exec(body);
        if (pathMatch) targetPath = pathMatch[1];
      }
      if (targetPath) {
        toolCalls.push({
          id: `read_${uuidv4().substring(0, 8)}`,
          name: 'read_file',
          arguments: { path: targetPath },
          raw_content: raw,
        });
      }
    }
  }

  // 2. Write File: <write_file path="...">content</write_file>, <writefile path="...">content</writefile>
  const reWrite = /<(?:write_file|writefile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/(?:write_file|writefile)>/gi;
  while ((match = reWrite.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `write_${uuidv4().substring(0, 8)}`,
        name: 'write_file',
        arguments: { path: match[1], content: match[2] },
        raw_content: raw,
      });
    }
  }

  const reWriteFallback = /<(?:write_file|writefile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)(?:<\/(?:write_file|writefile)>|(?=<write_file|<writefile|<patch_file|<patchfile|<read_file|<readfile|<execute_command|<executecommand|$))/gi;
  while ((match = reWriteFallback.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw || (tc.name === 'write_file' && tc.arguments.path === match![1]))) {
      toolCalls.push({
        id: `write_${uuidv4().substring(0, 8)}`,
        name: 'write_file',
        arguments: { path: match[1], content: match[2].trim() },
        raw_content: raw,
      });
    }
  }

  // 3. Patch File: <patch_file path="...">...</patch_file>, <patchfile path="...">...</patchfile>
  const rePatch = /<(?:patch_file|patchfile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/(?:patch_file|patchfile)>/gi;
  while ((match = rePatch.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `patch_${uuidv4().substring(0, 8)}`,
        name: 'patch_file',
        arguments: { path: match[1], content: match[2] },
        raw_content: raw,
      });
    }
  }

  const rePatchFallback = /<(?:patch_file|patchfile)\s+path=["']([^"']+)["']\s*>([\s\S]*?)(?:<\/(?:patch_file|patchfile)>|(?=<patch_file|<patchfile|<write_file|<writefile|<read_file|<readfile|<execute_command|<executecommand|$))/gi;
  while ((match = rePatchFallback.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw || (tc.name === 'patch_file' && tc.arguments.path === match![1]))) {
      let content = match[2].trim();
      content = content.replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/i, '');
      if (content.includes('<<<<<<< SEARCH')) {
        toolCalls.push({
          id: `patch_${uuidv4().substring(0, 8)}`,
          name: 'patch_file',
          arguments: { path: match[1], content },
          raw_content: raw,
        });
      }
    }
  }
}

function parseSearchAndDirToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  let match: RegExpExecArray | null;

  // 1. List Dir: <list_dir path="..." />, <listdir path="..." />, <list_directory path="..." />, <list_dir>path</list_dir>, <list_dir />
  const reListAttr = /<(?:list_dir|listdir|list_directory)(?:\s+path=["']([^"']*)["'])?\s*(?:\/>|>([\s\S]*?)<\/(?:list_dir|listdir|list_directory)>|>)/gi;
  while ((match = reListAttr.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      let targetPath = match[1] || (match[2] ? match[2].trim() : '') || '.';
      targetPath = targetPath.replace(/^["']|["']$/g, '').trim() || '.';
      toolCalls.push({
        id: `list_${uuidv4().substring(0, 8)}`,
        name: 'list_dir',
        arguments: { path: targetPath },
        raw_content: raw,
      });
    }
  }

  // List Dir body format: <list_dir>path</list_dir> or <listdir>.</listdir>
  const reListBody = /<(?:list_dir|listdir|list_directory)\s*>([\s\S]*?)<\/(?:list_dir|listdir|list_directory)>/gi;
  while ((match = reListBody.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const body = match[1].trim();
      let targetPath = body || '.';
      try {
        const parsed = JSON.parse(body);
        if (parsed.path) targetPath = parsed.path;
      } catch {
        const pathMatch = /path\s*[:=]\s*["']([^"']+)["']/i.exec(body);
        if (pathMatch) targetPath = pathMatch[1];
      }
      toolCalls.push({
        id: `list_${uuidv4().substring(0, 8)}`,
        name: 'list_dir',
        arguments: { path: targetPath.trim() || '.' },
        raw_content: raw,
      });
    }
  }

  // 2. Grep Search: <grep_search pattern="..." path="..." />, <grepsearch ... />
  const reGrep1 = /<(?:grep_search|grepsearch)\s+pattern=["']([^"']+)["'](?:\s+path=["']([^"']*)["'])?\s*\/?>/gi;
  while ((match = reGrep1.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `grep_${uuidv4().substring(0, 8)}`,
        name: 'grep_search',
        arguments: { pattern: match[1], path: match[2] || '.' },
        raw_content: raw,
      });
    }
  }

  const reGrep2 = /<(?:grep_search|grepsearch)\s+path=["']([^"']*)["']\s+pattern=["']([^"']+)["']\s*\/?>/gi;
  while ((match = reGrep2.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `grep_${uuidv4().substring(0, 8)}`,
        name: 'grep_search',
        arguments: { pattern: match[2], path: match[1] || '.' },
        raw_content: raw,
      });
    }
  }

  // Grep Search (body format: <grep_search>...content...</grep_search>)
  const reGrepBody = /<(?:grep_search|grepsearch)\s*>([\s\S]*?)<\/(?:grep_search|grepsearch)>/gi;
  while ((match = reGrepBody.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const body = match[1].trim();
      let grepPattern = '';
      let grepPath = '.';

      try {
        const parsed = JSON.parse(body);
        grepPattern = parsed.pattern || '';
        grepPath = parsed.path || '.';
      } catch {
        const patternMatch = /pattern\s*[:=]\s*["']([^"']+)["']/i.exec(body);
        const pathMatch = /path\s*[:=]\s*["']([^"']+)["']/i.exec(body);
        grepPattern = patternMatch?.[1] || '';
        grepPath = pathMatch?.[1] || '.';

        if (!grepPattern && body && !body.includes('\n')) {
          grepPattern = body;
        }
      }

      if (grepPattern) {
        toolCalls.push({
          id: `grep_${uuidv4().substring(0, 8)}`,
          name: 'grep_search',
          arguments: { pattern: grepPattern, path: grepPath },
          raw_content: raw,
        });
      }
    }
  }

  // 3. Search Session History
  const reSearchHist = /<search_session_history\s+query=["']([^"']+)["']\s*\/?>/gi;
  while ((match = reSearchHist.exec(text)) !== null) {
    toolCalls.push({
      id: `search_hist_${uuidv4().substring(0, 8)}`,
      name: 'search_session_history',
      arguments: { query: match[1] },
      raw_content: match[0],
    });
  }

  // 4. FFF Fast File Search: <fff_search query="..." />, <fffsearch ... />
  const reFff = /<(?:fff_search|fffsearch)\s+query=["']([^"']+)["']\s*\/?>/gi;
  while ((match = reFff.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `fff_${uuidv4().substring(0, 8)}`,
        name: 'fff_search',
        arguments: { query: match[1] },
        raw_content: raw,
      });
    }
  }

  const reFffBody = /<(?:fff_search|fffsearch)\s*>([\s\S]*?)<\/(?:fff_search|fffsearch)>/gi;
  while ((match = reFffBody.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `fff_${uuidv4().substring(0, 8)}`,
        name: 'fff_search',
        arguments: { query: match[1].trim() },
        raw_content: raw,
      });
    }
  }

  // 5. Web Search: <web_search query="..." />, <websearch ... />
  const reWeb = /<(?:web_search|websearch)\s+query=["']([^"']+)["']\s*\/?>/gi;
  while ((match = reWeb.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `web_${uuidv4().substring(0, 8)}`,
        name: 'web_search',
        arguments: { query: match[1] },
        raw_content: raw,
      });
    }
  }

  // 6. Read Web Page: <read_web_page url="..." />, <readwebpage ... />
  const reReadWeb = /<(?:read_web_page|readwebpage)\s+url=["']([^"']+)["']\s*\/?>/gi;
  while ((match = reReadWeb.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `readweb_${uuidv4().substring(0, 8)}`,
        name: 'read_web_page',
        arguments: { url: match[1] },
        raw_content: raw,
      });
    }
  }

  // 7. Save Knowledge
  const reSaveKb = /<save_knowledge\s+title=["']([^"']+)["'](?:\s+category=["']([^"']+)["'])?(?:\s+tags=["']([^"']+)["'])?(?:\s+summary=["']([^"']+)["'])?\s*>([\s\S]*?)<\/save_knowledge>/gi;
  while ((match = reSaveKb.exec(text)) !== null) {
    toolCalls.push({
      id: `savekb_${uuidv4().substring(0, 8)}`,
      name: 'save_knowledge',
      arguments: {
        title: match[1],
        category: match[2] || 'general',
        tags: match[3] ? match[3].split(',').map((t) => t.trim()) : [],
        summary: match[4] || '',
        content: match[5].trim(),
      },
      raw_content: match[0],
    });
  }

  // 8. Search Knowledge
  const reSearchKb = /<search_knowledge(?:\s+query=["']([^"']+)["'])?(?:\s+category=["']([^"']+)["'])?(?:\s+tag=["']([^"']+)["'])?\s*\/?>/gi;
  while ((match = reSearchKb.exec(text)) !== null) {
    toolCalls.push({
      id: `searchkb_${uuidv4().substring(0, 8)}`,
      name: 'search_knowledge',
      arguments: {
        query: match[1] || '*',
        category: match[2] || undefined,
        tag: match[3] || undefined,
      },
      raw_content: match[0],
    });
  }

  // 9. List Knowledge
  const reListKb = /<list_knowledge(?:\s+category=["']([^"']+)["'])?\s*\/?>/gi;
  while ((match = reListKb.exec(text)) !== null) {
    toolCalls.push({
      id: `listkb_${uuidv4().substring(0, 8)}`,
      name: 'list_knowledge',
      arguments: {
        category: match[1] || undefined,
      },
      raw_content: match[0],
    });
  }
}

function parsePersonaAndProfileToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  let match: RegExpExecArray | null;

  // 1. update_user_profile / updateuserprofile
  const reProfile = /<update_?user_?profile\b([^>]*?)(?:\/>|>([\s\S]*?)<\/update_?user_?profile>|>)/gi;
  while ((match = reProfile.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const attrStr = match[1] || '';
      const bodyStr = match[2] || '';

      const traitMatch = /trait=["']([^"']*)["']/i.exec(attrStr);
      const catMatch = /category=["']([^"']*)["']/i.exec(attrStr);

      let trait = traitMatch ? traitMatch[1] : bodyStr.trim();
      let category = catMatch ? catMatch[1] : 'profile';

      if (trait !== undefined && trait !== null && trait.trim()) {
        toolCalls.push({
          id: `profile_${uuidv4().substring(0, 8)}`,
          name: 'update_user_profile',
          arguments: { trait: trait.trim(), category: category.trim() },
          raw_content: raw,
        });
      }
    }
  }

  // 2. update_persona_file / updatepersonafile
  const rePersona = /<update_?persona_?file\b(?:\s+file=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/update_?persona_?file>/gi;
  while ((match = rePersona.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const file = match[1] || 'SOUL.md';
      const content = match[2] ? match[2].trim() : '';
      toolCalls.push({
        id: `persona_${uuidv4().substring(0, 8)}`,
        name: 'update_persona_file',
        arguments: { file, content },
        raw_content: raw,
      });
    }
  }
}

function parseExecAndInteractiveToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  let match: RegExpExecArray | null;

  // 1. Execute Command: <execute_command command="..." />, <executecommand ... />, <run_command ... />, body format
  const reExec = /<(?:execute_command|executecommand|run_command|runcommand)\s+command=["']([^"']+)["']\s*\/?>/gi;
  while ((match = reExec.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `exec_${uuidv4().substring(0, 8)}`,
        name: 'execute_command',
        arguments: { command: match[1] },
        raw_content: raw,
      });
    }
  }

  const reExecBody = /<(?:execute_command|executecommand|run_command|runcommand)\s*>([\s\S]*?)<\/(?:execute_command|executecommand|run_command|runcommand)>/gi;
  while ((match = reExecBody.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `exec_${uuidv4().substring(0, 8)}`,
        name: 'execute_command',
        arguments: { command: match[1].trim() },
        raw_content: raw,
      });
    }
  }

  // 2. Ask User
  const reAsk = /<ask_user\s+question=["']([^"']+)["'](?:\s+options=["']([^"']+)["'])?\s*\/?>/gi;
  while ((match = reAsk.exec(text)) !== null) {
    let options: string[] | undefined = undefined;
    if (match[2]) {
      options = match[2].split(',').map((o) => o.trim()).filter(Boolean);
    }
    toolCalls.push({
      id: `ask_${uuidv4().substring(0, 8)}`,
      name: 'ask_user',
      arguments: { question: match[1], options },
      raw_content: match[0],
    });
  }

  // 3. Ask User Question (Interactive structured card: body JSON, attribute questions, or question/options attrs)
  const reAskQ = /<ask_?user_?questions?\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ask_?user_?questions?>|>)/gi;
  while ((match = reAskQ.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const attrStr = match[1] || '';
      const bodyStr = match[2] || '';

      let parsedArgs: any = null;

      // 3a. Body JSON
      if (bodyStr.trim()) {
        try {
          const bodyJson = JSON.parse(bodyStr.trim());
          parsedArgs = Array.isArray(bodyJson) ? { questions: bodyJson } : bodyJson;
        } catch {
          if (!attrStr.includes('questions=') && !attrStr.includes('question=')) {
            parsedArgs = { questions: [{ id: 'q1', question: bodyStr.trim() }] };
          }
        }
      }

      // 3b. Attribute: questions='[...]' or questions="[...]"
      if (!parsedArgs) {
        const questionsAttrMatch = /questions=(?:'([^']*)'|"([^"]*)")/i.exec(attrStr);
        const questionsRaw = questionsAttrMatch ? (questionsAttrMatch[1] || questionsAttrMatch[2]) : null;
        if (questionsRaw) {
          try {
            const parsed = JSON.parse(questionsRaw);
            parsedArgs = Array.isArray(parsed) ? { questions: parsed } : parsed;
          } catch {}
        }
      }

      // 3c. Attribute: question="..." and optional options="..."
      if (!parsedArgs) {
        const qMatch = /question=["']([^"']*)["']/i.exec(attrStr);
        const optMatch = /options=["']([^"']*)["']/i.exec(attrStr);
        if (qMatch) {
          let opts: any[] = [];
          if (optMatch) {
            try {
              const parsedOpts = JSON.parse(optMatch[1]);
              opts = Array.isArray(parsedOpts) ? parsedOpts : [parsedOpts];
            } catch {
              opts = optMatch[1].split(',').map((o) => ({ label: o.trim() })).filter((o) => o.label);
            }
          }
          parsedArgs = {
            questions: [
              {
                id: 'q1',
                question: qMatch[1],
                options: opts.length > 0 ? opts : undefined,
              },
            ],
          };
        }
      }

      if (parsedArgs) {
        toolCalls.push({
          id: `askq_${uuidv4().substring(0, 8)}`,
          name: 'ask_user_question',
          arguments: parsedArgs,
          raw_content: raw,
        });
      }
    }
  }

  // 4. Todo Write: body JSON or attribute todos='[...]'
  const reTodo = /<(?:todo_write|todowrite|todo_items)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:todo_write|todowrite|todo_items)>|>)/gi;
  while ((match = reTodo.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const attrStr = match[1] || '';
      const bodyStr = match[2] || '';
      let parsedTodos: any = null;

      if (bodyStr.trim()) {
        try {
          parsedTodos = JSON.parse(bodyStr.trim());
        } catch {}
      }

      if (!parsedTodos) {
        const todosAttrMatch = /todos=(?:'([^']*)'|"([^"]*)")/i.exec(attrStr);
        const todosRaw = todosAttrMatch ? (todosAttrMatch[1] || todosAttrMatch[2]) : null;
        if (todosRaw) {
          try {
            parsedTodos = JSON.parse(todosRaw);
          } catch {}
        }
      }

      if (parsedTodos) {
        toolCalls.push({
          id: `todo_${uuidv4().substring(0, 8)}`,
          name: 'todo_write',
          arguments: Array.isArray(parsedTodos) ? { todos: parsedTodos } : parsedTodos,
          raw_content: raw,
        });
      }
    }
  }

  // 5. Code Run (Sandbox VM): body or script attribute
  const reCode = /<(?:code_run|coderun)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:code_run|coderun)>|>)/gi;
  while ((match = reCode.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      const attrStr = match[1] || '';
      const bodyStr = match[2] || '';
      let script = bodyStr.trim();

      if (!script) {
        const scriptMatch = /script=(?:'([^']*)'|"([^"]*)")/i.exec(attrStr);
        if (scriptMatch) {
          script = (scriptMatch[1] || scriptMatch[2] || '').trim();
        }
      }

      if (script) {
        toolCalls.push({
          id: `code_${uuidv4().substring(0, 8)}`,
          name: 'code_run',
          arguments: { script },
          raw_content: raw,
        });
      }
    }
  }

  // 6. Run Scratch Script
  const reScratch = /<run_scratch_script\s+language=["']([^"']+)["']\s*>([\s\S]*?)<\/run_scratch_script>/gi;
  while ((match = reScratch.exec(text)) !== null) {
    toolCalls.push({
      id: `scratch_${uuidv4().substring(0, 8)}`,
      name: 'run_scratch_script',
      arguments: { language: match[1], code: match[2] },
      raw_content: match[0],
    });
  }

  // 7. Spawn Subagent
  const reSpawn = /<spawn_subagent\s+task=["']([^"']+)["'](?:\s+role=["']([^"']+)["'])?\s*\/?>/gi;
  while ((match = reSpawn.exec(text)) !== null) {
    toolCalls.push({
      id: `subagent_${uuidv4().substring(0, 8)}`,
      name: 'spawn_subagent',
      arguments: { task: match[1], role: match[2] || 'helper' },
      raw_content: match[0],
    });
  }
}

/**
 * Parse Gemma 4 / Local LLM style tool calls: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
 * Handles malformed JSON, mixed XML attributes (e.g. {"name": "readfile" path="..."}), and variations in tag names (<toolcall>).
 */
function parseGemmaToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  const reToolCall = /<tool_?call>([\s\S]*?)<\/tool_?call>/gi;
  let match: RegExpExecArray | null;

  const toolNameMap: Record<string, string> = {
    'read_file': 'read_file',
    'readfile': 'read_file',
    'write_file': 'write_file',
    'writefile': 'write_file',
    'patch_file': 'patch_file',
    'patchfile': 'patch_file',
    'list_dir': 'list_dir',
    'listdir': 'list_dir',
    'list_directory': 'list_dir',
    'grep_search': 'grep_search',
    'grepsearch': 'grep_search',
    'search': 'grep_search',
    'execute_command': 'execute_command',
    'executecommand': 'execute_command',
    'run_command': 'execute_command',
    'runcommand': 'execute_command',
    'shell': 'execute_command',
    'create_directory': 'create_directory',
    'createdirectory': 'create_directory',
    'get_file_info': 'get_file_info',
    'getfileinfo': 'get_file_info',
    'remember_fact': 'remember_fact',
    'recall_memories': 'recall_memories',
    'ask_user': 'ask_user',
    'ask_user_question': 'ask_user_question',
    'todo_write': 'todo_write',
    'todowrite': 'todo_write',
    'code_run': 'code_run',
    'coderun': 'code_run',
    'fff_search': 'fff_search',
    'fffsearch': 'fff_search',
    'fff': 'fff_search',
    'file_finder': 'fff_search',
    'web_search': 'web_search',
    'websearch': 'web_search',
    'google_search': 'web_search',
    'read_web_page': 'read_web_page',
    'readwebpage': 'read_web_page',
    'browse_url': 'read_web_page',
    'read_url': 'read_web_page',
    'save_knowledge': 'save_knowledge',
    'saveknowledge': 'save_knowledge',
    'search_knowledge': 'search_knowledge',
    'searchknowledge': 'search_knowledge',
    'list_knowledge': 'list_knowledge',
    'listknowledge': 'list_knowledge',
    'update_user_profile': 'update_user_profile',
    'updateuserprofile': 'update_user_profile',
    'user_profile': 'update_user_profile',
    'update_profile': 'update_user_profile',
    'update_persona_file': 'update_persona_file',
    'updatepersonafile': 'update_persona_file',
    'persona_file': 'update_persona_file',
  };

  while ((match = reToolCall.exec(text)) !== null) {
    const raw = match[1].trim();
    let name = '';
    let args: any = {};

    // 1. Try standard JSON parse first
    try {
      const parsed = JSON.parse(raw);
      name = parsed.name || parsed.function || '';
      args = parsed.arguments || parsed.parameters || {};
    } catch {
      // 2. Fallback: Parse malformed JSON mixed with XML attributes
      const nameMatch = /["']?name["']?\s*[:=]\s*["']([^"']+)["']/i.exec(raw);
      if (nameMatch) {
        name = nameMatch[1];
      } else {
        for (const candidateKey of Object.keys(toolNameMap)) {
          if (new RegExp(`\\b${candidateKey}\\b`, 'i').test(raw)) {
            name = candidateKey;
            break;
          }
        }
      }

      const pathMatch = /path=["']([^"']+)["']/i.exec(raw);
      const patternMatch = /pattern=["']([^"']+)["']/i.exec(raw);
      const queryMatch = /query=["']([^"']+)["']/i.exec(raw);
      const urlMatch = /url=["']([^"']+)["']/i.exec(raw);
      const commandMatch = /command=["']([^"']+)["']/i.exec(raw);
      const contentMatch = /content=["']([^"']+)["']/i.exec(raw);
      const traitMatch = /trait=["']([^"']*)["']/i.exec(raw);
      const categoryMatch = /category=["']([^"']*)["']/i.exec(raw);
      const fileMatch = /file=["']([^"']+)["']/i.exec(raw);

      if (pathMatch) args.path = pathMatch[1];
      if (patternMatch) args.pattern = patternMatch[1];
      if (queryMatch) args.query = queryMatch[1];
      if (urlMatch) args.url = urlMatch[1];
      if (commandMatch) args.command = commandMatch[1];
      if (contentMatch) args.content = contentMatch[1];
      if (traitMatch) args.trait = traitMatch[1];
      if (categoryMatch) args.category = categoryMatch[1];
      if (fileMatch) args.file = fileMatch[1];
    }

    if (!name) {
      for (const candidateKey of Object.keys(toolNameMap)) {
        if (new RegExp(`\\b${candidateKey}\\b`, 'i').test(raw)) {
          name = candidateKey;
          break;
        }
      }
    }

    const mappedName = toolNameMap[name.toLowerCase()] || toolNameMap[name] || name;
    if (mappedName) {
      if (!toolCalls.some((tc) => tc.raw_content === match![0])) {
        toolCalls.push({
          id: `gemma_${uuidv4().substring(0, 8)}`,
          name: mappedName,
          arguments: args,
          raw_content: match[0],
        });
      }
    }
  }
}

export function parseToolCalls(text: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];
  // Strip markdown code fences around tool calls (e.g. ```xml <patch_file> ... ```)
  const sanitizedText = (text || '').replace(/```(?:xml|html|json|tsx|ts)?/gi, '').replace(/```$/gm, '');

  parseFileToolCalls(sanitizedText, toolCalls);
  parseSearchAndDirToolCalls(sanitizedText, toolCalls);
  parsePersonaAndProfileToolCalls(sanitizedText, toolCalls);
  parseExecAndInteractiveToolCalls(sanitizedText, toolCalls);
  parseGemmaToolCalls(sanitizedText, toolCalls);
  return toolCalls;
}

/**
 * Detects if the LLM hallucinated/simulated tool outputs directly in its text response
 * e.g., "[Tool list_dir output: ...]" or "<tool_response name=..." or "Tool listdir [...] output:"
 */
export function detectToolOutputHallucination(text: string): boolean {
  if (!text) return false;
  const pattern = /(?:\[Tool\s+[a-z_]+\s*(?:\[[^\]]*\])?\s*output:|<tool_response\b|\[TOOL_RESULT\b|Tool\s+[a-z_]+\s*\[[a-z0-9_-]+\]\s*output:)/i;
  return pattern.test(text);
}

/**
 * Strips hallucinated tool output blocks from the text so they don't pollute the conversation
 */
export function stripHallucinatedToolOutput(text: string): string {
  if (!text) return text;
  let cleaned = text;
  cleaned = cleaned.replace(/\[Tool\s+[a-z_]+[\s\S]*?(?:\](?=\s*(?:\[Tool|<|$))|(?=\[Tool|<|$))/gi, '');
  cleaned = cleaned.replace(/<tool_response\b[\s\S]*?(?:<\/tool_response>|$)/gi, '');
  cleaned = cleaned.replace(/\[TOOL_RESULT\b[\s\S]*?(?:\[\/TOOL_RESULT\]|$)/gi, '');
  cleaned = cleaned.replace(/Tool\s+[a-z_]+\s*\[[a-z0-9_-]+\]\s*output:[\s\S]*?(?=(?:Tool\s+[a-z_]+\s*\[|<|$))/gi, '');
  return cleaned.trim();
}
