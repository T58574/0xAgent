import { useState } from 'react';
import * as api from '../services/api';
import { FileNode } from '../types';
import { EditorTabItem } from '../components/CodeEditor';

interface UseWorkspaceManagerOptions {
  addLog: (msg: string) => void;
  activeWorkspaceDir?: string | null;
}

export function useWorkspaceManager({ addLog, activeWorkspaceDir }: UseWorkspaceManagerOptions) {
  const [workspaceTree, setWorkspaceTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [has0xAgentMd, setHas0xAgentMd] = useState<boolean>(false);
  const [splitLeftWidthPercent, setSplitLeftWidthPercent] = useState<number>(45);
  const [openTabs, setOpenTabs] = useState<EditorTabItem[]>([]);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'files' | 'editor'>('editor');

  const loadWorkspaceTree = async (dirPath: string) => {
    try {
      const tree = await api.get_workspace_tree(dirPath);
      setWorkspaceTree(tree);
      const ctx = await api.get_workspace_context(dirPath);
      setHas0xAgentMd(ctx.loaded);
      if (ctx.loaded) {
        addLog(`Auto-loaded workspace context from ${ctx.filename}`);
      }
    } catch (err: any) {
      addLog(`Failed to load file tree: ${err.message || err}`);
    }
  };

  const handleSelectTab = (path: string) => {
    const tab = openTabs.find((t) => t.path === path);
    if (tab) {
      setSelectedFile(tab);
      setMobileWorkspaceTab('editor');
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = openTabs.filter((t) => t.path !== path);
    setOpenTabs(updated);
    if (selectedFile && selectedFile.path === path) {
      if (updated.length > 0) {
        setSelectedFile(updated[updated.length - 1]);
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleFileSaved = (filePath: string, newContent: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === filePath ? { ...t, content: newContent, isDirty: false } : t))
    );
    if (selectedFile && selectedFile.path === filePath) {
      setSelectedFile({ ...selectedFile, content: newContent });
    }
    addLog(`File saved: ${filePath}`);
  };

  const handleFileClick = async (filePath: string, fileName: string) => {
    try {
      const content = await api.read_file_raw(filePath, activeWorkspaceDir);
      const newFile = {
        path: filePath,
        name: fileName,
        content,
      };

      setOpenTabs((prev) => {
        const exists = prev.some((t) => t.path === filePath);
        if (!exists) {
          return [...prev, newFile];
        }
        return prev;
      });

      setSelectedFile(newFile);
      setMobileWorkspaceTab('editor');
      addLog(`Opened file: ${fileName}`);
    } catch (err: any) {
      addLog(`Failed to read file contents: ${err.message || err}`);
    }
  };

  return {
    workspaceTree,
    setWorkspaceTree,
    selectedFile,
    setSelectedFile,
    has0xAgentMd,
    setHas0xAgentMd,
    splitLeftWidthPercent,
    setSplitLeftWidthPercent,
    openTabs,
    setOpenTabs,
    mobileWorkspaceTab,
    setMobileWorkspaceTab,
    loadWorkspaceTree,
    handleSelectTab,
    handleCloseTab,
    handleFileSaved,
    handleFileClick,
  };
}
