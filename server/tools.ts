import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { FileNode } from '../src/types';

export function resolvePath(workspaceDir: string | null | undefined, pathStr: string): string {
  if (!pathStr) return workspaceDir || process.cwd();
  if (path.isAbsolute(pathStr)) {
    return path.normalize(pathStr);
  }
  if (workspaceDir && workspaceDir.trim().length > 0) {
    return path.normalize(path.join(workspaceDir, pathStr));
  }
  return path.normalize(path.resolve(pathStr));
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

    if (!currentContentClean.includes(searchBlockClean)) {
      // Fallback 1: try normalized line matching (trimming trailing whitespace)
      const normSearch = searchBlockClean.split('\n').map((l) => l.trimEnd()).join('\n');
      const normCurrent = currentContentClean.split('\n').map((l) => l.trimEnd()).join('\n');

      if (normCurrent.includes(normSearch)) {
        currentContent = normCurrent.replace(normSearch, replaceBlock);
        remaining = afterDiv.substring(endIdx + replaceMarker.length);
        appliedCount++;
        continue;
      }

      // Fallback 2: try fully trimmed line matching
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

      throw new Error(
        `Could not find the SEARCH block in file: \n\`\`\`\n${searchBlock}\n\`\`\`\n\n` +
        `[SYSTEM HINT]: The exact SEARCH block was not found. Use <read_file path="${pathStr}" /> to inspect the file's current lines and whitespace before retrying <patch_file> or <write_file>.`
      );
    }

    currentContent = currentContentClean.replace(searchBlockClean, replaceBlock);
    remaining = afterDiv.substring(endIdx + replaceMarker.length);
    appliedCount++;
  }

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

  // Automatic Context Loading: If target directory contains 0xagent.md, load it into context immediately
  const localContext = find0xAgentContext(targetPath);
  if (localContext) {
    result += `\n\n📌 [AUTOMATIC CONTEXT LOADED FROM ${path.basename(localContext.filePath)} IN ${targetPath}]:\n${localContext.content}`;
  }

  return result;
}

export function executeGrepSearch(workspaceDir: string | null | undefined, patternStr: string, pathStr: string): string {
  const targetPath = resolvePath(workspaceDir, pathStr);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Search path does not exist: ${targetPath}`);
  }

  const regex = new RegExp(patternStr);
  const results: string[] = [];

  function walkDir(dir: string, depth: number) {
    if (depth > 8 || results.length > 100) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length > 100) return;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (['.git', 'node_modules', 'target', 'dist', 'build', '.idea', '.vscode'].includes(entry.name)) {
            continue;
          }
          walkDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
                if (results.length > 100) break;
              }
            }
          } catch {
            // Ignore binary / unreadable files
          }
        }
      }
    } catch {
      // Ignore directory access errors
    }
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    const content = fs.readFileSync(targetPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push(`${targetPath}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  } else {
    walkDir(targetPath, 0);
  }

  return results.length > 0 ? results.join('\n') : 'No matches found.';
}

export function executeShellCommand(workspaceDir: string | null | undefined, commandStr: string): Promise<string> {
  return new Promise((resolve) => {
    let cleanCmd = commandStr.trim();
    // Strip redundant powershell -Command "cd '...'; ..." wrapper if present
    const psWrapperRegex = /^powershell(?:\.exe)?\s+(?:-[a-zA-Z]+\s+)*-Command\s+["'](.*)["']$/is;
    const match = psWrapperRegex.exec(cleanCmd);
    if (match) {
      cleanCmd = match[1];
    }

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : 'sh';
    const args = isWindows ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cleanCmd] : ['-c', cleanCmd];
    const cwd = workspaceDir && fs.existsSync(workspaceDir) ? workspaceDir : process.cwd();

    const child = spawn(shell, args, { cwd });
    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    // 30-second timeout guard to prevent infinite process hangs
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
        `Полученный вывод до останова:\n${partialOutput || '(Вывод отсутствует)'}\n\n` +
        `[СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ ДЛЯ АГЕНТА]: Запрещено запускать фоновые бессрочные dev-серверы (например, 'npm run dev' или 'vite') через <execute_command>, так как они никогда не завершаются сами. Используйте одноразовые команды сборки или тестов (например 'npm run build' или 'npx tsc').`
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
    } catch (err) {
      console.error(`Error reading tree directory ${dir}:`, err);
    }

    nodes.sort((a, b) => {
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1;
      }
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return nodes;
  }

  return readDirRecursive(workspaceDir, 0);
}

export async function selectWorkspaceNative(): Promise<string | null> {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      try {
        const psScript = `
          Add-Type -AssemblyName System.Windows.Forms
          $app = New-Object -ComObject Shell.Application
          $folder = $app.BrowseForFolder(0, "Выберите папку Workspace для 0xAgent", 0, 0)
          if ($folder -ne $null) {
              Write-Output $folder.Self.Path
          } else {
              $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
              $dialog.Description = "Выберите папку Workspace для 0xAgent"
              $dialog.ShowNewFolderButton = $true
              $result = $dialog.ShowDialog()
              if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                  Write-Output $dialog.SelectedPath
              }
          }
        `;
        const buf = Buffer.from(psScript, 'utf-16le');
        const base64 = buf.toString('base64');
        const { exec } = require('node:child_process');
        exec(`powershell -Sta -NoProfile -EncodedCommand ${base64}`, { encoding: 'utf-8' }, (err: any, stdout: string) => {
          if (err) {
            console.error('Failed to open native Windows folder dialog:', err);
            resolve(null);
          } else {
            const folder = (stdout || '').trim();
            resolve(folder.length > 0 ? folder : null);
          }
        });
      } catch (err) {
        console.error('Failed to open native Windows folder dialog:', err);
        resolve(null);
      }
    });
  }
  return null;
}

export async function selectFileNative(filter?: string): Promise<string | null> {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      try {
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
        const buf = Buffer.from(psScript, 'utf-16le');
        const base64 = buf.toString('base64');
        const { exec } = require('node:child_process');
        exec(`powershell -Sta -NoProfile -EncodedCommand ${base64}`, { encoding: 'utf-8' }, (err: any, stdout: string) => {
          if (err) {
            console.error('Failed to open native Windows file dialog:', err);
            resolve(null);
          } else {
            const filePath = (stdout || '').trim();
            resolve(filePath.length > 0 ? filePath : null);
          }
        });
      } catch (err) {
        console.error('Failed to open native Windows file dialog:', err);
        resolve(null);
      }
    });
  }
  return null;
}

