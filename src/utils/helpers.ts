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
  cleaned = cleaned.replace(/```(?:xml|bash|powershell|js|ts|python)?\s*<(?:write_file|patch_file|read_file|execute_command|run_scratch_script)[\s\S]*?```/gi, "");

  // 2. Strip closed & unclosed tool tags for all tools
  cleaned = cleaned.replace(/<write_file\s+path=["'][^"']*["']\s*>([\s\S]*?)(?:<\/write_file>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<patch_file\s+path=["'][^"']*["']\s*>([\s\S]*?)(?:<\/patch_file>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<execute_command\s*>([\s\S]*?)(?:<\/execute_command>|(?=<[a-z_]+|$))/gi, "");
  cleaned = cleaned.replace(/<run_scratch_script\s+language=["'][^"']*["']\s*>([\s\S]*?)(?:<\/run_scratch_script>|(?=<[a-z_]+|$))/gi, "");
  
  // Single self-closing tags
  cleaned = cleaned.replace(/<(?:read_file|create_directory|get_file_info|list_dir|grep_search|remember_fact|recall_memories|list_skills|execute_skill|search_sessions|ask_user|spawn_subagent)\s+[^>]*\/?>/gi, "");
  
  // 3. Strip any orphaned SEARCH / REPLACE diff blocks leaked outside XML tags
  cleaned = cleaned.replace(/<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE/gi, "");

  // 4. Remove empty code fences and excess vertical spacing
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



