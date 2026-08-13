import { v4 as uuidv4 } from 'uuid';

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: any;
  raw_content: string;
}

function parseFileToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  let match: RegExpExecArray | null;

  // 1. Read File
  const reRead = /<read_file\s+path=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reRead.exec(text)) !== null) {
    toolCalls.push({
      id: `read_${uuidv4().substring(0, 8)}`,
      name: 'read_file',
      arguments: { path: match[1] },
      raw_content: match[0],
    });
  }

  // 2. Write File
  const reWrite = /<write_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/write_file>/gs;
  while ((match = reWrite.exec(text)) !== null) {
    toolCalls.push({
      id: `write_${uuidv4().substring(0, 8)}`,
      name: 'write_file',
      arguments: { path: match[1], content: match[2] },
      raw_content: match[0],
    });
  }

  const reWriteFallback = /<write_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)(?:<\/write_file>|(?=<write_file|<patch_file|<read_file|<execute_command|$))/gi;
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

  // 3. Patch File
  const rePatch = /<patch_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/patch_file>/gs;
  while ((match = rePatch.exec(text)) !== null) {
    toolCalls.push({
      id: `patch_${uuidv4().substring(0, 8)}`,
      name: 'patch_file',
      arguments: { path: match[1], content: match[2] },
      raw_content: match[0],
    });
  }

  const rePatchFallback = /<patch_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)(?:<\/patch_file>|(?=<patch_file|<write_file|<read_file|<execute_command|$))/gi;
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

  // List Dir
  const reList = /<list_dir\s+path=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reList.exec(text)) !== null) {
    toolCalls.push({
      id: `list_${uuidv4().substring(0, 8)}`,
      name: 'list_dir',
      arguments: { path: match[1] },
      raw_content: match[0],
    });
  }

  // Grep Search
  const reGrep1 = /<grep_search\s+pattern=["']([^"']+)["']\s+path=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reGrep1.exec(text)) !== null) {
    toolCalls.push({
      id: `grep_${uuidv4().substring(0, 8)}`,
      name: 'grep_search',
      arguments: { pattern: match[1], path: match[2] },
      raw_content: match[0],
    });
  }

  const reGrep2 = /<grep_search\s+path=["']([^"']+)["']\s+pattern=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reGrep2.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `grep_${uuidv4().substring(0, 8)}`,
        name: 'grep_search',
        arguments: { pattern: match[2], path: match[1] },
        raw_content: raw,
      });
    }
  }

  // Search Session History
  const reSearchHist = /<search_session_history\s+query=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reSearchHist.exec(text)) !== null) {
    toolCalls.push({
      id: `search_hist_${uuidv4().substring(0, 8)}`,
      name: 'search_session_history',
      arguments: { query: match[1] },
      raw_content: match[0],
    });
  }

  // FFF Fast File Search
  const reFff = /<fff_search\s+query=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reFff.exec(text)) !== null) {
    toolCalls.push({
      id: `fff_${uuidv4().substring(0, 8)}`,
      name: 'fff_search',
      arguments: { query: match[1] },
      raw_content: match[0],
    });
  }

  // Web Search
  const reWeb = /<web_search\s+query=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reWeb.exec(text)) !== null) {
    toolCalls.push({
      id: `web_${uuidv4().substring(0, 8)}`,
      name: 'web_search',
      arguments: { query: match[1] },
      raw_content: match[0],
    });
  }

  // Read Web Page
  const reReadWeb = /<read_web_page\s+url=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reReadWeb.exec(text)) !== null) {
    toolCalls.push({
      id: `readweb_${uuidv4().substring(0, 8)}`,
      name: 'read_web_page',
      arguments: { url: match[1] },
      raw_content: match[0],
    });
  }

  // Save Knowledge
  const reSaveKb = /<save_knowledge\s+title=["']([^"']+)["'](?:\s+category=["']([^"']+)["'])?(?:\s+tags=["']([^"']+)["'])?(?:\s+summary=["']([^"']+)["'])?\s*>([\s\S]*?)<\/save_knowledge>/gs;
  while ((match = reSaveKb.exec(text)) !== null) {
    toolCalls.push({
      id: `savekb_${uuidv4().substring(0, 8)}`,
      name: 'save_knowledge',
      arguments: {
        title: match[1],
        category: match[2] || 'general',
        tags: match[3] ? match[3].split(',').map(t => t.trim()) : [],
        summary: match[4] || '',
        content: match[5].trim(),
      },
      raw_content: match[0],
    });
  }

  // Search Knowledge
  const reSearchKb = /<search_knowledge(?:\s+query=["']([^"']+)["'])?(?:\s+category=["']([^"']+)["'])?(?:\s+tag=["']([^"']+)["'])?\s*\/?>/gs;
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

  // List Knowledge
  const reListKb = /<list_knowledge(?:\s+category=["']([^"']+)["'])?\s*\/?>/gs;
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

function parseExecAndInteractiveToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  let match: RegExpExecArray | null;

  // Execute Command
  const reExec = /<execute_command\s+command=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reExec.exec(text)) !== null) {
    toolCalls.push({
      id: `exec_${uuidv4().substring(0, 8)}`,
      name: 'execute_command',
      arguments: { command: match[1] },
      raw_content: match[0],
    });
  }

  const reExecBody = /<execute_command\s*>([\s\S]*?)<\/execute_command>/gs;
  while ((match = reExecBody.exec(text)) !== null) {
    toolCalls.push({
      id: `exec_${uuidv4().substring(0, 8)}`,
      name: 'execute_command',
      arguments: { command: match[1].trim() },
      raw_content: match[0],
    });
  }

  // Ask User
  const reAsk = /<ask_user\s+question=["']([^"']+)["'](?:\s+options=["']([^"']+)["'])?\s*\/?>/gs;
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

  // Run Scratch Script
  const reScratch = /<run_scratch_script\s+language=["']([^"']+)["']\s*>([\s\S]*?)<\/run_scratch_script>/gs;
  while ((match = reScratch.exec(text)) !== null) {
    toolCalls.push({
      id: `scratch_${uuidv4().substring(0, 8)}`,
      name: 'run_scratch_script',
      arguments: { language: match[1], code: match[2] },
      raw_content: match[0],
    });
  }

  // Spawn Subagent
  const reSpawn = /<spawn_subagent\s+task=["']([^"']+)["'](?:\s+role=["']([^"']+)["'])?\s*\/?>/gs;
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
      // 2. Fallback: Parse malformed JSON mixed with XML attributes (e.g. {"name": "readfile" path="src/ChatArea.tsx"} or {"readfile path="..."})
      const nameMatch = /["']?name["']?\s*[:=]\s*["']([^"']+)["']/i.exec(raw);
      if (nameMatch) {
        name = nameMatch[1];
      } else {
        // Scan raw string for known tool names (e.g. readfile, patchfile, writefile, fffsearch, etc.)
        for (const candidateKey of Object.keys(toolNameMap)) {
          if (new RegExp(`\\b${candidateKey}\\b`, 'i').test(raw)) {
            name = candidateKey;
            break;
          }
        }
      }

      // Extract attributes: path="...", query="...", command="...", url="..."
      const pathMatch = /path=["']([^"']+)["']/i.exec(raw);
      const queryMatch = /query=["']([^"']+)["']/i.exec(raw);
      const urlMatch = /url=["']([^"']+)["']/i.exec(raw);
      const commandMatch = /command=["']([^"']+)["']/i.exec(raw);
      const contentMatch = /content=["']([^"']+)["']/i.exec(raw);

      if (pathMatch) args.path = pathMatch[1];
      if (queryMatch) args.query = queryMatch[1];
      if (urlMatch) args.url = urlMatch[1];
      if (commandMatch) args.command = commandMatch[1];
      if (contentMatch) args.content = contentMatch[1];
    }

    // Secondary fallback: if name is still empty after JSON parse, check toolNameMap against raw string
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
  parseExecAndInteractiveToolCalls(sanitizedText, toolCalls);
  parseGemmaToolCalls(sanitizedText, toolCalls);
  return toolCalls;
}
