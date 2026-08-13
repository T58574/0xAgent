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
 * Parse Gemma 4 style tool calls: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
 * Maps Gemma 4 function names to 0xAgent tool names.
 */
function parseGemmaToolCalls(text: string, toolCalls: ParsedToolCall[]): void {
  const reToolCall = /<tool_call>([\s\S]*?)<\/tool_call>/gs;
  let match: RegExpExecArray | null;

  while ((match = reToolCall.exec(text)) !== null) {
    try {
      const raw = match[1].trim();
      const parsed = JSON.parse(raw);
      const name = parsed.name || parsed.function || '';
      const args = parsed.arguments || parsed.parameters || {};

      // Map Gemma 4 function names to 0xAgent tool names
      const toolNameMap: Record<string, string> = {
        'read_file': 'read_file',
        'write_file': 'write_file',
        'patch_file': 'patch_file',
        'list_dir': 'list_dir',
        'list_directory': 'list_dir',
        'grep_search': 'grep_search',
        'search': 'grep_search',
        'execute_command': 'execute_command',
        'run_command': 'execute_command',
        'shell': 'execute_command',
        'create_directory': 'create_directory',
        'get_file_info': 'get_file_info',
        'remember_fact': 'remember_fact',
        'recall_memories': 'recall_memories',
        'ask_user': 'ask_user',
      };

      const mappedName = toolNameMap[name] || name;
      if (mappedName) {
        // Don't add duplicate calls
        if (!toolCalls.some((tc) => tc.raw_content === match![0])) {
          toolCalls.push({
            id: `gemma_${uuidv4().substring(0, 8)}`,
            name: mappedName,
            arguments: args,
            raw_content: match[0],
          });
        }
      }
    } catch {
      // Ignore malformed JSON in tool_call blocks
    }
  }
}

export function parseToolCalls(text: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];
  parseFileToolCalls(text, toolCalls);
  parseSearchAndDirToolCalls(text, toolCalls);
  parseExecAndInteractiveToolCalls(text, toolCalls);
  parseGemmaToolCalls(text, toolCalls);
  return toolCalls;
}
