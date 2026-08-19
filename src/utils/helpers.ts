// List of zoomer IT developer slang statuses
export const ZOOMER_STATUSES = [
  "lowkey cooking fr fr...",
  "processing vibes...",
  "optimizing the vibe check...",
  "locking in...",
  "no cap, thinking...",
  "letting the code cook...",
  "brain cells assembling...",
  "compiling main character energy...",
  "debugging the matrix...",
  "calculating stonks...",
  "generating valid points...",
  "sheesh, thinking...",
  "glow up in progress...",
  "rizz dev working hard...",
  "waking up neurons..."
];

export function getRandomZoomerStatus(): string {
  const idx = Math.floor(Math.random() * ZOOMER_STATUSES.length);
  return ZOOMER_STATUSES[idx];
}

/**
 * Cleans tool execution XML tags and raw diff blocks from assistant responses so they don't render in the chat bubbles
 */
export function cleanContent(content: string): string {
  if (!content) return "";
  
  let cleaned = content;

  // 1. Strip markdown code block wrappers containing tool tags
  cleaned = cleaned.replace(/```(?:xml|bash|powershell|js|ts|python)?\s*<(?:write_file|patch_file|read_file|execute_command|run_scratch_script|update_?user_?profile|update_?persona_?file)[\s\S]*?```/gi, "");

  // 2. Strip closed & unclosed tool tags for all tools
  cleaned = cleaned.replace(/<write_file\s+path=["'][^"']*["']\s*>([\s\S]*?)(?:<\/write_file>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<patch_file\s+path=["'][^"']*["']\s*>([\s\S]*?)(?:<\/patch_file>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<execute_command\s*>([\s\S]*?)(?:<\/execute_command>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<run_scratch_script\s+language=["'][^"']*["']\s*>([\s\S]*?)(?:<\/run_scratch_script>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<save_knowledge[\s\S]*?(?:<\/save_knowledge>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<update_?persona_?file[\s\S]*?(?:<\/update_?persona_?file>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<update_?user_?profile[\s\S]*?(?:<\/update_?user_?profile>|\/>|>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<tool_?call[\s\S]*?(?:<\/tool_?call>|(?=<[a-z_]+|$))/gi, "");
  
  // Single self-closing tags
  cleaned = cleaned.replace(/<(?:read_file|create_directory|get_file_info|list_dir|grep_search|fff_search|web_search|read_web_page|remember_fact|recall_memories|list_skills|execute_skill|search_sessions|search_knowledge|list_knowledge|ask_user|spawn_subagent|update_?user_?profile)\s+[^>]*\/?>/gi, "");

  // Block-format grep_search: <grep_search>...</grep_search>
  cleaned = cleaned.replace(/<grep_search\s*>[\s\S]*?<\/grep_search>/gi, "");
  
  // 3. Strip any orphaned SEARCH / REPLACE diff blocks leaked outside XML tags
  cleaned = cleaned.replace(/<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE/gi, "");

  // 4. Remove orphaned standalone closing tags
  cleaned = cleaned.replace(/<\/(?:read_file|write_file|patch_file|list_dir|grep_search|fff_search|web_search|read_web_page|execute_command|save_knowledge|search_knowledge|list_knowledge|run_scratch_script|ask_user|ask_user_question|spawn_subagent|tool_?call|code_run|todo_write|update_?user_?profile|update_?persona_?file)\s*>/gi, "");

  // 5. Remove empty code fences and excess vertical spacing
  cleaned = cleaned.replace(/```[a-z]*\s*```/gi, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

/**
 * Format milliseconds timestamp into a local readable string
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Extracts the last folder name from a given workspace directory path
 */
export function getWorkspaceBaseName(dirPath?: string | null): string {
  if (!dirPath) return 'Без папки';
  const parts = dirPath.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || dirPath;
}

/**
 * Checks whether a workspace directory is an auto-generated isolated sandbox workspace
 */
export function isAutoWorkspace(dirPath?: string | null): boolean {
  if (!dirPath) return false;
  const normalized = dirPath.replace(/\\/g, '/').toLowerCase();
  return (normalized.includes('.0xagent') || normalized.includes('0xagent')) && normalized.includes('/workspaces');
}

/**
 * Generate a short unique ID for messages and transient components
 */
export function generateShortId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().substring(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Format timestamp into relative age string like '10m', '2h', '3d', '1mo'
 */
export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMin < 1) return '1m';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 30) return `${diffDay}d`;
  return `${diffMonth}mo`;
}

/**
 * Format timestamp with seconds for precise timeline tooltip
 */
export function formatTimeDetailed(timestamp?: number | string): string {
  if (!timestamp) return '';
  const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Format date for friendly chat section separators (e.g. "Сегодня", "Вчера", "14 авг.")
 */
export function formatDateSeparator(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  
  const isToday = d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
    
  if (isToday) return 'Сегодня';
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
    
  if (isYesterday) return 'Вчера';
  
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Robust extractor for thinking/reasoning blocks in raw LLM streams and completed messages.
 * Supports:
 * 1. Standard <think>...</think>, <thought>...</thought>, <|thought|>...</|thought|>, <|start_thought|>...</|end_thought|>
 * 2. Gemma 4 / Channel: <|channel>thought ... <|channel|>, <channel|thought ... channel|>, <channel>thought ... </channel>
 * 3. [THINK]...[/THINK], [THINKING]...[/THINKING]
 * 4. Unclosed streaming variants of all above
 */
export function extractThinkingFromContent(raw: string): { thinking: string; text: string; isStreamingThink: boolean } {
  if (!raw) return { thinking: '', text: '', isStreamingThink: false };

  // 1. Standard closed <think>...</think>, <thought>...</thought>
  const closedThinkMatch = raw.match(/<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/i);
  if (closedThinkMatch) {
    return {
      thinking: closedThinkMatch[1].trim(),
      text: raw.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '').trim(),
      isStreamingThink: false,
    };
  }

  // 2. Gemma 4 / Channel format: <|channel>thought\n...<channel|> / <|channel|> / </channel> / <channel|>
  const gemmaClosedMatch = raw.match(/<\|?channel\|?>?thought([\s\S]*?)(?:<\|?channel\|?>|<\/channel>|<channel\|>|<\|channel\|>)/i);
  if (gemmaClosedMatch) {
    return {
      thinking: gemmaClosedMatch[1].trim(),
      text: raw.replace(/<\|?channel\|?>?thought[\s\S]*?(?:<\|?channel\|?>|<\/channel>|<channel\|>|<\|channel\|>)/gi, '').trim(),
      isStreamingThink: false,
    };
  }

  // 3. Special tokens: <|start_thought|>...<|end_thought|>, <|thought|>...<|thought|>
  const specialClosedMatch = raw.match(/<(?:\|start_thought\||\|thought\|)>([\s\S]*?)<(?:\|end_thought\||\|thought\||\/\|thought\|)>/i);
  if (specialClosedMatch) {
    return {
      thinking: specialClosedMatch[1].trim(),
      text: raw.replace(/<(?:\|start_thought\||\|thought\|)>[\s\S]*?<(?:\|end_thought\||\|thought\||\/\|thought\|)>/gi, '').trim(),
      isStreamingThink: false,
    };
  }

  // 4. Bracket style [THINK]...[/THINK], [THINKING]...[/THINKING]
  const closedBracketMatch = raw.match(/\[(?:think|thinking)\]([\s\S]*?)\[\/(?:think|thinking)\]/i);
  if (closedBracketMatch) {
    return {
      thinking: closedBracketMatch[1].trim(),
      text: raw.replace(/\[(?:think|thinking)\][\s\S]*?\[\/(?:think|thinking)\]/gi, '').trim(),
      isStreamingThink: false,
    };
  }

  // 5. Unclosed streaming standard <think>, <thought>
  const openThinkMatch = raw.match(/<(?:think|thought)>/i);
  if (openThinkMatch && openThinkMatch.index !== undefined) {
    const startIdx = openThinkMatch.index;
    const tagLen = openThinkMatch[0].length;
    return {
      thinking: raw.substring(startIdx + tagLen).trim(),
      text: raw.substring(0, startIdx).trim(),
      isStreamingThink: true,
    };
  }

  // 6. Unclosed streaming Gemma 4 channel: <|channel>thought...
  const gemmaOpenMatch = raw.match(/<\|?channel\|?>?thought\s*/i);
  if (gemmaOpenMatch && gemmaOpenMatch.index !== undefined) {
    const startIdx = gemmaOpenMatch.index;
    const tagLen = gemmaOpenMatch[0].length;
    return {
      thinking: raw.substring(startIdx + tagLen).trim(),
      text: raw.substring(0, startIdx).trim(),
      isStreamingThink: true,
    };
  }

  // 7. Unclosed streaming special tokens: <|start_thought|>, <|thought|>, [THINK]
  const specialOpenMatch = raw.match(/<(?:\|start_thought\||\|thought\|)>|\[(?:think|thinking)\]/i);
  if (specialOpenMatch && specialOpenMatch.index !== undefined) {
    const startIdx = specialOpenMatch.index;
    const tagLen = specialOpenMatch[0].length;
    return {
      thinking: raw.substring(startIdx + tagLen).trim(),
      text: raw.substring(0, startIdx).trim(),
      isStreamingThink: true,
    };
  }

  return { thinking: '', text: raw, isStreamingThink: false };
}

export interface ThoughtStep {
  stepNumber: number;
  title: string;
  content: string;
}

/**
 * Intelligent parser that splits long chain-of-thought texts into structured steps / sections
 */
export function extractThoughtSteps(thinkingText: string): ThoughtStep[] {
  if (!thinkingText.trim()) return [];

  const raw = thinkingText.trim();

  // Try splitting by markdown headers e.g. "### Step 1", "## Step 1", "### Planning"
  const headerSplit = raw.split(/\n(?=#{1,4}\s+)/g);
  if (headerSplit.length > 1) {
    return headerSplit.map((chunk, idx) => {
      const firstLineBreak = chunk.indexOf('\n');
      let title = '';
      let content = chunk;
      if (firstLineBreak > 0) {
        title = chunk.substring(0, firstLineBreak).replace(/^#+\s*/, '').trim();
        content = chunk.substring(firstLineBreak + 1).trim();
      } else {
        title = chunk.replace(/^#+\s*/, '').trim();
        content = '';
      }
      return {
        stepNumber: idx + 1,
        title: title || `Этап ${idx + 1}`,
        content,
      };
    });
  }

  // Try splitting by numbered points e.g. "1.", "2." at start of lines
  const numberedSplit = raw.split(/\n(?=\d+[\.\)]\s+)/g);
  if (numberedSplit.length > 1) {
    return numberedSplit.map((chunk, idx) => {
      const match = chunk.match(/^(\d+)[\.\)]\s+([^\n]+)/);
      let title = '';
      let content = chunk;
      if (match) {
        title = match[2].trim();
        content = chunk.replace(/^\d+[\.\)]\s+[^\n]+\n?/, '').trim();
      }
      return {
        stepNumber: idx + 1,
        title: title || `Шаг ${idx + 1}`,
        content: content || title,
      };
    });
  }

  // If text has distinct double-newline paragraphs (> 3 paragraphs), group them into logical phases
  const paragraphs = raw.split(/\n{2,}/g).filter(Boolean);
  if (paragraphs.length > 2) {
    return paragraphs.map((p, idx) => {
      const firstLine = p.split('\n')[0].replace(/^[-*•]\s*/, '').trim();
      const title = firstLine.length < 60 ? firstLine : `Фаза ${idx + 1}`;
      const content = firstLine === title && p.includes('\n') ? p.substring(p.indexOf('\n') + 1).trim() : p;
      return {
        stepNumber: idx + 1,
        title,
        content,
      };
    });
  }

  // Default fallback: single structured thought
  return [
    {
      stepNumber: 1,
      title: 'Анализ и рассуждение',
      content: raw,
    },
  ];
}

/**
 * Formats a chat session into a comprehensive, readable Markdown log
 * suitable for debugging, AI review, and developer support.
 */
export function exportSessionLogAsText(session: any, modelName?: string): string {
  if (!session) return 'No active session data.';

  const s = session as any;
  const lines: string[] = [];
  lines.push(`==================================================`);
  lines.push(`0xAGENT SESSION LOG: "${s.title || 'Untitled Session'}"`);
  lines.push(`==================================================`);
  lines.push(`Session ID:  ${s.id}`);
  lines.push(`Model:       ${modelName || s.model_name || 'default'}`);
  lines.push(`Workspace:   ${s.workspace_dir || 'General (No folder bound)'}`);
  lines.push(`Created:     ${new Date(s.created_at || Date.now()).toLocaleString()}`);
  lines.push(`Updated:     ${new Date(s.updated_at || Date.now()).toLocaleString()}`);
  lines.push(`Messages:    ${(s.messages || []).length}`);

  if (s.active_todos && s.active_todos.length > 0) {
    lines.push(`\nActive Todos / Live Plan:`);
    for (const t of s.active_todos) {
      const statusMark = t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[>]' : '[ ]';
      lines.push(`  ${statusMark} ${t.task} (${t.status})`);
    }
  }

  lines.push(`\n=================== DIALOGUE TRANSCRIPT ===================\n`);

  for (let idx = 0; idx < (s.messages || []).length; idx++) {
    const msg = s.messages[idx];
    const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
    const roleUpper = (msg.role || 'unknown').toUpperCase();

    lines.push(`--------------------------------------------------`);
    lines.push(`[${idx + 1}] ${roleUpper} ${timestamp ? `(${timestamp})` : ''}`);
    lines.push(`--------------------------------------------------`);

    if (msg.role === 'assistant') {
      const { thinking, text } = extractThinkingFromContent(msg.content || '');
      if (thinking) {
        lines.push(`\n<THINKING>\n${thinking}\n</THINKING>\n`);
      }
      if (text) {
        lines.push(text);
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        lines.push(`\nTOOL CALLS (${msg.tool_calls.length}):`);
        for (const tc of msg.tool_calls) {
          lines.push(`  - Tool: [${tc.name}] (ID: ${tc.id}, Status: ${tc.status})`);
          lines.push(`    Arguments: ${tc.arguments}`);
          if (tc.output) {
            const preview = tc.output.length > 500 ? tc.output.slice(0, 500) + `\n    ... [truncated ${tc.output.length} chars]` : tc.output;
            lines.push(`    Output Preview:\n    ${preview.replace(/\n/g, '\n    ')}`);
          }
        }
      }

      if (msg.metrics) {
        lines.push(`\n[Metrics: ${msg.metrics.tokensPerSec || 0} tok/s | Total: ${msg.metrics.totalTokens || 0} tokens | Duration: ${msg.metrics.evalDurationMs || 0}ms]`);
      }
    } else if (msg.role === 'tool') {
      lines.push(`[TOOL RESPONSE]\n${msg.content || ''}`);
    } else {
      lines.push(msg.content || '');
      if (msg.images && msg.images.length > 0) {
        lines.push(`[Attached Images: ${msg.images.length}]`);
      }
    }

    lines.push('');
  }

  lines.push(`=================== END OF LOG ===================\n`);
  return lines.join('\n');
}

/**
 * Returns raw pretty-printed JSON of the session object
 */
export function exportSessionJson(session: any): string {
  if (!session) return '{}';
  return JSON.stringify(session, null, 2);
}




