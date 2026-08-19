import fs from 'node:fs';
import path from 'node:path';
import { FileNode } from '../../src/types';
import { getAppDir, loadConfig } from '../config';

export function resolvePath(workspaceDir: string | null | undefined, pathStr: string): string {
  let cfgWorkspace: string | null = null;
  try {
    const cfg = loadConfig();
    if (cfg?.workspace_dir) cfgWorkspace = cfg.workspace_dir;
  } catch {}

  const root = (workspaceDir && workspaceDir.trim().length > 0)
    ? workspaceDir
    : (cfgWorkspace && cfgWorkspace.trim().length > 0 ? cfgWorkspace : process.cwd());
  const normalizedRoot = path.normalize(path.resolve(root));

  let targetPath: string;
  if (!pathStr) {
    targetPath = normalizedRoot;
  } else if (path.isAbsolute(pathStr)) {
    targetPath = path.normalize(path.resolve(pathStr));
  } else {
    targetPath = path.normalize(path.resolve(normalizedRoot, pathStr));
  }

  // Security Sandboxing: Enforce workspace & app directory boundary
  const isWindows = process.platform === 'win32';
  const rootCheck = isWindows ? normalizedRoot.toLowerCase() : normalizedRoot;
  const targetCheck = isWindows ? targetPath.toLowerCase() : targetPath;
  const appDir = path.normalize(path.resolve(getAppDir()));
  const appDirCheck = isWindows ? appDir.toLowerCase() : appDir;
  const globalWsCheck = cfgWorkspace ? (isWindows ? path.normalize(path.resolve(cfgWorkspace)).toLowerCase() : path.normalize(path.resolve(cfgWorkspace))) : null;

  const isWithinRoot = targetCheck.startsWith(rootCheck);
  const isWithinAppDir = targetCheck.startsWith(appDirCheck);
  const isWithinGlobalWs = globalWsCheck ? targetCheck.startsWith(globalWsCheck) : false;

  if (!isWithinRoot && !isWithinAppDir && !isWithinGlobalWs) {
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

  return `\n\n# [WORKSPACE] AUTOMATIC CONTEXT INSTRUCTIONS (Loaded from ${path.basename(found.filePath)})
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
    result += `\n\n[INFO: AUTOMATIC CONTEXT LOADED FROM ${path.basename(localContext.filePath)} IN ${targetPath}]:\n${localContext.content}`;
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
        if (results.length >= maxResults) return;
      }
    }
  } catch {}
}

export function executeGrepSearch(
  workspaceDir: string | null | undefined,
  pattern: string,
  pathStr?: string,
  isRegex = true,
  caseSensitive = false
): string {
  const targetPath = resolvePath(workspaceDir, pathStr || '');
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Search path does not exist: ${targetPath}`);
  }

  let regex: RegExp;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    regex = isRegex ? new RegExp(pattern, flags) : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch (err: any) {
    throw new Error(`Invalid search pattern: ${err.message}`);
  }

  const results: string[] = [];
  const stat = fs.statSync(targetPath);

  if (!stat.isDirectory()) {
    searchSingleFile(targetPath, regex, results);
  } else {
    function walk(dir: string) {
      if (results.length >= 100) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= 100) return;
          if (IGNORED_DIRS.has(entry.name)) continue;

          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile()) {
            searchSingleFile(full, regex, results);
          }
        }
      } catch {}
    }
    walk(targetPath);
  }

  if (results.length === 0) {
    return `No matches found for pattern "${pattern}" in ${targetPath}`;
  }

  const header = results.length >= 100 ? `Found 100+ matches (capped at 100):\n` : `Found ${results.length} matches:\n`;
  return header + results.join('\n');
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
