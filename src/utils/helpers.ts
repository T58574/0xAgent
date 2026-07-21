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
 * Cleans tool execution XML tags from assistant responses so they don't render in the chat bubbles
 */
export function cleanContent(content: string): string {
  if (!content) return "";
  
  let cleaned = content;
  // Strip write_file
  cleaned = cleaned.replace(/<write_file\s+path=["'][^"']*["']\s*>([\s\S]*?)<\/write_file>/gi, "");
  // Strip patch_file
  cleaned = cleaned.replace(/<patch_file\s+path=["'][^"']*["']\s*>([\s\S]*?)<\/patch_file>/gi, "");
  // Strip execute_command
  cleaned = cleaned.replace(/<execute_command\s*>([\s\S]*?)<\/execute_command>/gi, "");
  // Strip read_file
  cleaned = cleaned.replace(/<read_file\s+path=["'][^"']*["']\s*\/?>/gi, "");
  // Strip list_dir
  cleaned = cleaned.replace(/<list_dir\s+path=["'][^"']*["']\s*\/?>/gi, "");
  // Strip grep_search
  cleaned = cleaned.replace(/<grep_search\s+[^>]*\/?>/gi, "");
  
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
