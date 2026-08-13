import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn, execFile } from 'node:child_process';
import { FileNode } from '../src/types';
import { fffService } from './fffService';
import { searxngService } from './searxngService';
import { webReaderService } from './webReaderService';
import { saveKnowledgeEntry, queryKnowledgeEntries, listKnowledgeCategories } from './knowledgeBase';
import { julesService } from './julesService';
import { jarvisSupervisor } from './agent/jarvisSupervisor';
import { loadConfig } from './config';

export function resolvePath(workspaceDir: string | null | undefined, pathStr: string): string {
  const root = workspaceDir && workspaceDir.trim().length > 0 ? workspaceDir : process.cwd();
  const normalizedRoot = path.normalize(path.resolve(root));

  let targetPath: string;
  if (!pathStr) {
    targetPath = normalizedRoot;
  } else if (path.isAbsolute(pathStr)) {
    targetPath = path.normalize(path.resolve(pathStr));
  } else {
    targetPath = path.normalize(path.resolve(normalizedRoot, pathStr));
  }

  // Security Sandboxing: Enforce workspace boundary
  const isWindows = process.platform === 'win32';
  const rootCheck = isWindows ? normalizedRoot.toLowerCase() : normalizedRoot;
  const targetCheck = isWindows ? targetPath.toLowerCase() : targetPath;

  if (!targetCheck.startsWith(rootCheck)) {
    throw new Error(`Access Denied: Path "${targetPath}" is outside the active workspace directory "${normalizedRoot}"`);
  }

  return targetPath;
}

export function executeReadFile(workspaceDir: string | null | undefined, pathStr: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File does not exist: ${targetPath}`);
  }
  return fs.readFileSync(targetPath, 'utf-8');
}

export function executeWriteFile(workspaceDir: string | null | undefined, pathStr: string, content: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  const parent = path.dirname(targetPath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(targetPath, content, 'utf-8');
  return `Successfully wrote file: ${targetPath}`;
}

export function executeCreateDirectory(workspaceDir: string | null | undefined, pathStr: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return `Successfully created directory: ${targetPath}`;
  }
  return `Directory already exists: ${targetPath}`;
}

export function executeGetFileInfo(workspaceDir: string | null | undefined, pathStr: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Path does not exist: ${targetPath}`);
  }
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(targetPath);
    return `[Directory Info]\nPath: ${targetPath}\nTotal Items: ${entries.length}\nLast Modified: ${stat.mtime.toISOString()}`;
  }
  const content = fs.readFileSync(targetPath, 'utf-8');
  const lines = content.split(/\r?\n/).length;
  const sizeKb = (stat.size / 1024).toFixed(2);
  return `[File Info]\nPath: ${targetPath}\nSize: ${stat.size} bytes (${sizeKb} KB)\nTotal Lines: ${lines}\nLast Modified: ${stat.mtime.toISOString()}`;
}

export function executePatchFile(workspaceDir: string | null | undefined, pathStr: string, patchContent: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File to patch does not exist: ${targetPath}`);
  }

  const original = fs.readFileSync(targetPath, 'utf-8');
  const searchMarker = '<<<<<<< SEARCH';
  const dividerMarker = '=======';
  const replaceMarker = '>>>>>>> REPLACE';

  if (!patchContent.includes(searchMarker)) {
    throw new Error('Patch content does not contain <<<<<<< SEARCH marker');
  }

  let currentContent = original;
  let remaining = patchContent;
  let appliedCount = 0;

  while (remaining.includes(searchMarker)) {
    const startIdx = remaining.indexOf(searchMarker);
    const afterSearch = remaining.substring(startIdx + searchMarker.length);

    const divIdx = afterSearch.indexOf(dividerMarker);
    if (divIdx === -1) {
      throw new Error('Missing ======= separator in patch');
    }
    const searchBlock = afterSearch.substring(0, divIdx).replace(/^\r?\n|\r?\n$/g, '');

    const afterDiv = afterSearch.substring(divIdx + dividerMarker.length);
    const endIdx = afterDiv.indexOf(replaceMarker);
    if (endIdx === -1) {
      throw new Error('Missing >>>>>>> REPLACE marker in patch');
    }
    const replaceBlock = afterDiv.substring(0, endIdx).replace(/^\r?\n|\r?\n$/g, '');

    const searchBlockClean = searchBlock.replace(/\r\n/g, '\n');
    const currentContentClean = currentContent.replace(/\r\n/g, '\n');

    if (!searchBlockClean.trim()) {
      throw new Error(
        `[SYSTEM ERROR]: SEARCH block is empty or contains only whitespace!\n` +
        `[SYSTEM DIRECTIVE]: Provide exact non-empty lines in SEARCH block, or use <write_file path="${pathStr}"> to rewrite the file.`
      );
    }

    if (!currentContentClean.includes(searchBlockClean)) {
      // 1. Try trailing whitespace normalization
      const normSearch = searchBlockClean.split('\n').map((l) => l.trimEnd()).join('\n');
      const normCurrent = currentContentClean.split('\n').map((l) => l.trimEnd()).join('\n');

      if (normCurrent.includes(normSearch)) {
        currentContent = normCurrent.replace(normSearch, replaceBlock);
        remaining = afterDiv.substring(endIdx + replaceMarker.length);
        appliedCount++;
        continue;
      }

      // 2. Try trimmed line comparison
      const trimSearch = searchBlockClean.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
      const currentLines = currentContentClean.split('\n');
      let foundIndex = -1;

      for (let i = 0; i <= currentLines.length - searchBlockClean.split('\n').length; i++) {
        const sliceTrimmed = currentLines.slice(i, i + searchBlockClean.split('\n').length).map((l) => l.trim()).filter(Boolean).join('\n');
        if (sliceTrimmed === trimSearch) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        const searchLinesCount = searchBlockClean.split('\n').length;
        currentLines.splice(foundIndex, searchLinesCount, replaceBlock);
        currentContent = currentLines.join('\n');
        remaining = afterDiv.substring(endIdx + replaceMarker.length);
        appliedCount++;
        continue;
      }

      // 3. Try flexible whitespace-collapse matching
      const collapseSpaces = (s: string) => s.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean).join('\n');
      const collapsedSearch = collapseSpaces(searchBlockClean);
      
      for (let i = 0; i <= currentLines.length - searchBlockClean.split('\n').length; i++) {
        const sliceCollapsed = collapseSpaces(currentLines.slice(i, i + searchBlockClean.split('\n').length).join('\n'));
        if (sliceCollapsed === collapsedSearch) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        const searchLinesCount = searchBlockClean.split('\n').length;
        currentLines.splice(foundIndex, searchLinesCount, replaceBlock);
        currentContent = currentLines.join('\n');
        remaining = afterDiv.substring(endIdx + replaceMarker.length);
        appliedCount++;
        continue;
      }

      // 4. Try Core Lines Anchoring (ignoring loose closing brackets on edges)
      const coreLines = searchBlockClean.split('\n').map((l) => l.trim()).filter((l) => l.length > 8 && !/^<\/(?:div|span|p|section|header|footer|aside)>$/i.test(l) && !/^[}\]);,]+$/.test(l));
      if (coreLines.length > 0) {
        const coreSearch = coreLines.join('\n');
        let coreMatchIdx = -1;
        let matchCount = 0;

        for (let i = 0; i <= currentLines.length - coreLines.length; i++) {
          const sliceCore = currentLines.slice(i, i + coreLines.length).map((l) => l.trim()).join('\n');
          if (sliceCore === coreSearch) {
            matchCount++;
            coreMatchIdx = i;
          }
        }

        // If core is unique in file, perform replace on core range
        if (matchCount === 1 && coreMatchIdx !== -1) {
          currentLines.splice(coreMatchIdx, coreLines.length, replaceBlock);
          currentContent = currentLines.join('\n');
          remaining = afterDiv.substring(endIdx + replaceMarker.length);
          appliedCount++;
          continue;
        }
      }

      throw new Error(
        `Could not find the SEARCH block in file: \n\`\`\`\n${searchBlock}\n\`\`\`\n\n` +
        `[SYSTEM DIRECTIVE FOR MODEL]: The exact SEARCH block was not found. Do NOT repeat the identical <patch_file> call!\n` +
        `First use <read_file path="${pathStr}" /> to inspect line numbers and content. If patch_file continues to fail, IMMEDIATELY use <write_file path="${pathStr}"> to write the updated file content directly.`
      );
    }

    currentContent = currentContentClean.replace(searchBlockClean, replaceBlock);
    remaining = afterDiv.substring(endIdx + replaceMarker.length);
    appliedCount++;
  }

  // Clean up accidental duplicate adjacent declaration lines (e.g. repeated useState/useRef lines created by fuzzy patch)
  const lines = currentContent.split(/\r?\n/);
  const cleanedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';

    if (
      trimmed &&
      trimmed.length > 12 &&
      trimmed === prevTrimmed &&
      (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ') || trimmed.startsWith('import '))
    ) {
      // Skip accidental duplicate declaration line created by small model patch
      continue;
    }
    cleanedLines.push(line);
  }
  currentContent = cleanedLines.join('\n');

  fs.writeFileSync(targetPath, currentContent, 'utf-8');
  return `Successfully applied ${appliedCount} patch block(s) to ${targetPath}`;
}

export interface ContextLoadResult {
  filePath: string;
  content: string;
}

export function find0xAgentContext(dirPath: string): ContextLoadResult | null {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const candidates = ['0xagent.md', '.0xagent.md', '0XAGENT.MD', '0xAgent.md', '0xAGENT.md'];
  for (const candidate of candidates) {
    const fullPath = path.join(dirPath, candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return { filePath: fullPath, content };
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getWorkspace0xAgentMdContext(workspaceDir?: string | null): string {
  const rootDir = workspaceDir && fs.existsSync(workspaceDir) ? workspaceDir : process.cwd();
  const found = find0xAgentContext(rootDir);
  if (!found) return '';

  return `\n\n# 📄 WORKSPACE AUTOMATIC CONTEXT INSTRUCTIONS (Loaded from ${path.basename(found.filePath)})
[Loaded automatically from: ${found.filePath}]

--- BEGIN 0xagent.md DIRECTIVES ---
${found.content}
--- END 0xagent.md DIRECTIVES ---`;
}

export function executeListDir(workspaceDir: string | null | undefined, pathStr: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Directory does not exist: ${targetPath}`);
  }
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${targetPath}`);
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  const list: string[] = [];

  for (const entry of entries) {
    const type = entry.isDirectory() ? 'Dir' : 'File';
    list.push(`- [${type}] ${entry.name}`);
  }

  let result = list.join('\n');
  const localContext = find0xAgentContext(targetPath);
  if (localContext) {
    result += `\n\n📌 [AUTOMATIC CONTEXT LOADED FROM ${path.basename(localContext.filePath)} IN ${targetPath}]:\n${localContext.content}`;
  }

  return result;
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'target', 'dist', 'build', '.idea', '.vscode']);

function searchSingleFile(filePath: string, regex: RegExp, results: string[], maxResults = 100): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push(`${filePath}:${i + 1}: ${lines[i].trim()}`);
        if (results.length >= maxResults) break;
      }
    }
  } catch {
    // Ignore binary / unreadable files
  }
}

export function executeGrepSearch(workspaceDir: string | null | undefined, patternStr: string, pathStr: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Search path does not exist: ${targetPath}`);
  }

  let regex: RegExp;
  try {
    regex = new RegExp(patternStr, 'i');
  } catch {
    const escaped = patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(escaped, 'i');
  }
  const results: string[] = [];

  function walkDir(dir: string, depth: number) {
    if (depth > 8 || results.length >= 100) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= 100) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walkDir(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        searchSingleFile(fullPath, regex, results);
      }
    }
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    searchSingleFile(targetPath, regex, results);
  } else {
    walkDir(targetPath, 0);
  }

  return results.length > 0 ? results.join('\n') : 'No matches found.';
}

export function executeShellCommand(workspaceDir: string | null | undefined, commandStr: string): Promise<string> {
  return new Promise((resolve) => {
    let cleanCmd = commandStr.trim();
    const psWrapperRegex = /^powershell(?:\.exe)?\s+(?:-[a-zA-Z]+\s+)*-Command\s+["'](.*)["']$/is;
    const match = psWrapperRegex.exec(cleanCmd);
    if (match) {
      cleanCmd = match[1];
    }

    // System Safety Protection Guard
    const dangerousPatterns = [/system32/i, /windows\\system/i, /rmdir\s+\/[sS]\s+\/[qQ]\s+c:\\/i, /remove-item\s+.*-[rR]ecurse\s+[cC]:\\/i, /format\s+[cC]:/i];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleanCmd)) {
        return Promise.resolve(`[SECURITY BLOCK]: Выполнение команды остановлено защитной системой 0xAgent. Обнаружен потенциально опасный системный паттерн: "${cleanCmd}".`);
      }
    }

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : 'sh';
    const args = isWindows ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cleanCmd] : ['-c', cleanCmd];
    const cwd = workspaceDir && fs.existsSync(workspaceDir) ? workspaceDir : process.cwd();

    const child = spawn(shell, args, { cwd });
    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    const timeoutTimer = setTimeout(() => {
      isTimedOut = true;
      try {
        if (isWindows && child.pid) {
          execSync(`taskkill /pid ${child.pid} /T /F`);
        } else {
          child.kill('SIGKILL');
        }
      } catch {}

      const partialOutput = (stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '')).trim();
      resolve(
        `⚠️ Ошибка: Команда превысила 30-секундный лимит и была принудительно остановлена.\n` +
        `Полученный вывод до останова:\n${partialOutput || '(Вывод отсутствует)'}\n`
      );
    }, 30000);

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('error', (err) => {
      clearTimeout(timeoutTimer);
      if (!isTimedOut) {
        resolve(`Error launching process: ${err.message}`);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      if (isTimedOut) return;

      let result = '';
      if (stdout && stdout.trim().length > 0) {
        result += stdout;
      }
      if (stderr && stderr.trim().length > 0) {
        if (result.length > 0) result += '\n--- STDERR ---\n';
        result += stderr;
      }
      if (result.length === 0) {
        result = code === 0 ? 'Command executed successfully with no output.' : `Command exited with code ${code}.`;
      }
      resolve(result);
    });
  });
}

export function getWorkspaceTree(workspaceDir?: string | null): FileNode[] {
  if (!workspaceDir || !workspaceDir.trim() || !fs.existsSync(workspaceDir)) {
    return [];
  }

  function readDirRecursive(dir: string, depth: number): FileNode[] {
    if (depth > 4) return [];
    const nodes: FileNode[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['.git', 'node_modules', 'target', 'dist', 'build', '.idea', '.vscode'].includes(entry.name)) {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        const isDir = entry.isDirectory();
        nodes.push({
          name: entry.name,
          path: fullPath,
          is_dir: isDir,
          children: isDir ? readDirRecursive(fullPath, depth + 1) : null,
        });
      }
    } catch {}

    nodes.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return nodes;
  }

  return readDirRecursive(workspaceDir, 0);
}

async function runPowerShellDialogScript(psScript: string): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  return new Promise((resolve) => {
    try {
      const buf = Buffer.from(psScript, 'utf-16le');
      const base64 = buf.toString('base64');
      execFile('powershell', ['-Sta', '-NoProfile', '-EncodedCommand', base64], { encoding: 'utf-8' }, (err: any, stdout: string) => {
        if (err) {
          console.error('Failed to open native Windows dialog:', err);
          resolve(null);
        } else {
          const res = (stdout || '').trim();
          resolve(res.length > 0 ? res : null);
        }
      });
    } catch (err) {
      console.error('Failed to open native Windows dialog:', err);
      resolve(null);
    }
  });
}

export async function selectWorkspaceNative(): Promise<string | null> {
  const psScript = `
    [System.Reflection.Assembly]::LoadWithPartialName("System.windows.forms") | Out-Null
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Выберите папку Workspace для 0xAgent"
    $dialog.ShowNewFolderButton = $true
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dialog.SelectedPath
    }
  `;
  return runPowerShellDialogScript(psScript);
}

export async function selectFileNative(filter?: string): Promise<string | null> {
  const filterStr = filter || "All Files (*.*)|*.*|Executables (*.exe)|*.exe|GGUF Models (*.gguf)|*.gguf";
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "Select File"
    $dialog.Filter = "${filterStr}"
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dialog.FileName
    }
  `;
  return runPowerShellDialogScript(psScript);
}

export async function executeFffSearch(workspaceDir: string | null | undefined, query: string): Promise<string> {
  const rootDir = workspaceDir && fs.existsSync(workspaceDir) ? workspaceDir : process.cwd();
  const results = await fffService.searchFiles(rootDir, query, 30);

  if (results.length === 0) {
    return `[FFF Search] No matching files found for query: "${query}"`;
  }

  const lines = results.map((r, i) => `${i + 1}. ${r.relativePath}`);
  return `[FFF Search Results for "${query}"] (Found ${results.length} files):\n${lines.join('\n')}`;
}

export async function executeWebSearch(query: string): Promise<string> {
  if (!query || !query.trim()) {
    return '[Web Search Error]: Query string is empty.';
  }

  const results = await searxngService.search(query, 5);
  if (results.length === 0) {
    return `[Web Search]: No results found online for "${query}".`;
  }

  const formatted = results.map((r, i) => {
    return `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\n`;
  });

  return `[Web Search Results for "${query}"]:\n\n${formatted.join('\n')}`;
}

export async function executeReadWebPage(urlStr: string): Promise<string> {
  if (!urlStr || !urlStr.trim()) {
    return '[Read Web Page Error]: URL string is empty.';
  }

  try {
    return await webReaderService.readPage(urlStr, 6000);
  } catch (err: any) {
    return `[Read Web Page Error]: Failed to read page ${urlStr}: ${err?.message || err}`;
  }
}

export async function executeSaveKnowledge(params: {
  title: string;
  category?: string;
  content: string;
  summary?: string;
  tags?: string[];
  source?: string;
}): Promise<string> {
  if (!params.title || !params.content) {
    return '[Save Knowledge Error]: Title and content are required.';
  }
  const entry = await saveKnowledgeEntry({
    title: params.title,
    category: params.category || 'general',
    content: params.content,
    summary: params.summary,
    tags: params.tags,
    source: params.source || '0xAgent LLM',
  });

  return `Successfully saved entry to Knowledge Vault:\nID: ${entry.id}\nTitle: "${entry.title}"\nCategory: [${entry.category.toUpperCase()}]\nTags: ${entry.tags.join(', ') || 'none'}`;
}

export async function executeSearchKnowledge(query?: string, category?: string, tag?: string): Promise<string> {
  const results = await queryKnowledgeEntries({ query, category, tag });
  if (results.length === 0) {
    return `[Search Knowledge]: No entries found matching criteria (query: "${query || '*'}", category: "${category || 'all'}").`;
  }

  const lines = results.slice(0, 15).map((e, i) =>
    `[${i + 1}] ${e.title} (ID: ${e.id})\n    Category: ${e.category} | Tags: ${e.tags.join(', ') || 'none'}\n    Summary: ${e.summary}`
  );

  return `[Knowledge Vault Search Results (${results.length} found)]:\n\n${lines.join('\n\n')}`;
}

export async function executeListKnowledge(category?: string): Promise<string> {
  const results = await queryKnowledgeEntries({ category });
  const categories = await listKnowledgeCategories();

  const catSummary = categories.map(c => `- ${c.category}: ${c.count} entry(ies)`).join('\n');
  const entriesList = results.slice(0, 20).map(e => `- [${e.category.toUpperCase()}] ${e.title} (ID: ${e.id})`).join('\n');

  return `[Knowledge Vault Overview]\n\nCategories:\n${catSummary}\n\nEntries (${results.length}):\n${entriesList || 'No entries yet.'}`;
}

export async function executeJulesDelegateTask(params: {
  prompt: string;
  repo?: string;
  startingBranch?: string;
}): Promise<string> {
  if (!params.prompt) {
    return '[Jules Error]: Task prompt is required.';
  }

  const config = loadConfig();
  const repo = params.repo || config.jules_default_repo;
  if (!repo) {
    return '[Jules Error]: Target repository is required. Specify repo parameter or set jules_default_repo in Settings.';
  }

  try {
    const session = await julesService.createSession({
      prompt: params.prompt,
      source: repo,
      startingBranch: params.startingBranch || 'main',
      autoCreatePR: true,
    });

    jarvisSupervisor.logActivity(
      'Local Agent',
      `Delegated cloud task to Jules: "${params.prompt.slice(0, 60)}..." (Session ID: ${session.id})`,
      'info'
    );

    return `[Jules Cloud Task Started Successfully]
Session ID: ${session.id}
Title: ${session.title}
Repository: ${repo}
Branch: ${params.startingBranch || 'main'}
Status: ${session.status}

Jules is now executing this task asynchronously in Google Cloud and will automatically create a Pull Request upon completion. Track progress in the Jarvis Widget.`;
  } catch (err: any) {
    return `[Jules Error]: Failed to delegate task: ${err.message || err}`;
  }
}

export async function executeJulesListSessions(): Promise<string> {
  try {
    const sessions = julesService.getCachedSessions();
    if (sessions.length === 0) {
      return '[Jules Sessions]: No active or recent Jules cloud sessions found.';
    }

    const lines = sessions.map((s, i) => {
      const pr = s.outputs?.find((o) => o.pullRequest)?.pullRequest;
      return `[${i + 1}] "${s.title}" (ID: ${s.id})
    Status: ${s.status}
    Prompt: ${s.prompt}
    ${pr ? `Pull Request: ${pr.url}` : 'Pull Request: Pending completion'}`;
    });

    return `[Jules Active Cloud Sessions (${sessions.length})]:\n\n${lines.join('\n\n')}`;
  } catch (err: any) {
    return `[Jules Error]: Failed to list sessions: ${err.message || err}`;
  }
}

export async function executeJulesApprovePlan(sessionId: string): Promise<string> {
  if (!sessionId) return '[Jules Error]: sessionId is required.';
  try {
    await julesService.approvePlan(sessionId);
    jarvisSupervisor.logActivity(
      'Local Agent',
      `Approved Jules plan for session ID ${sessionId}`,
      'success'
    );
    return `[Jules]: Plan approved successfully for session ${sessionId}. Jules has resumed execution.`;
  } catch (err: any) {
    return `[Jules Error]: Failed to approve plan: ${err.message || err}`;
  }
}

export async function executeJulesSendFeedback(sessionId: string, prompt: string): Promise<string> {
  if (!sessionId || !prompt) return '[Jules Error]: sessionId and prompt are required.';
  try {
    await julesService.sendMessage(sessionId, prompt);
    jarvisSupervisor.logActivity(
      'Local Agent',
      `Sent feedback to Jules for session ID ${sessionId}: "${prompt.slice(0, 50)}..."`,
      'info'
    );
    return `[Jules]: Feedback sent successfully to Jules session ${sessionId}.`;
  } catch (err: any) {
    return `[Jules Error]: Failed to send feedback: ${err.message || err}`;
  }
}




