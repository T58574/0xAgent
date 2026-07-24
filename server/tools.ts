import fs from 'node:fs';
import path from 'node:path';
import { exec, execSync } from 'node:child_process';
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
      throw new Error(`Could not find the SEARCH block in file: \n\`\`\`\n${searchBlock}\n\`\`\``);
    }

    currentContent = currentContentClean.replace(searchBlockClean, replaceBlock);
    remaining = afterDiv.substring(endIdx + replaceMarker.length);
    appliedCount++;
  }

  fs.writeFileSync(targetPath, currentContent, 'utf-8');
  return `Successfully applied ${appliedCount} patch block(s) to ${targetPath}`;
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

  return list.join('\n');
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
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : 'sh';
    const args = isWindows ? ['-NoProfile', '-Command', commandStr] : ['-c', commandStr];
    const cwd = workspaceDir && fs.existsSync(workspaceDir) ? workspaceDir : process.cwd();

    exec(`${shell} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, { cwd }, (error, stdout, stderr) => {
      let result = '';
      if (stdout && stdout.trim().length > 0) {
        result += stdout;
      }
      if (stderr && stderr.trim().length > 0) {
        if (result.length > 0) result += '\n--- STDERR ---\n';
        result += stderr;
      }
      if (result.length === 0) {
        result = error ? `Error: ${error.message}` : 'Command executed successfully with no output.';
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

export function selectWorkspaceNative(): string | null {
  if (process.platform === 'win32') {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Select Workspace Folder for 0xAgent"
        $result = $dialog.ShowDialog()
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $dialog.SelectedPath
        }
      `;
      const stdout = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
      const folder = stdout.trim();
      return folder.length > 0 ? folder : null;
    } catch (err) {
      console.error('Failed to open native Windows folder dialog:', err);
      return null;
    }
  }
  return null;
}

export function selectFileNative(filter?: string): string | null {
  if (process.platform === 'win32') {
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
      const stdout = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
      const filePath = stdout.trim();
      return filePath.length > 0 ? filePath : null;
    } catch (err) {
      console.error('Failed to open native Windows file dialog:', err);
      return null;
    }
  }
  return null;
}
