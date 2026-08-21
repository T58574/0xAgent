import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  Code2,
  ChevronDown,
  ChevronRight,
  FolderSearch,
  Search,
  X,
} from 'lucide-react';
import { FileNode } from '../types';

interface WorkspaceTreeProps {
  workspaceDir: string | null | undefined;
  treeNodes: FileNode[];
  onSelectWorkspace: () => void;
  onFileClick: (path: string, name: string) => void;
}



// Get colored icon for specific file extension
const getFileIcon = (fileName: string) => {
  const lower = fileName.toLowerCase();
  const ext = lower.split('.').pop() || '';

  if (lower === 'dockerfile' || lower.startsWith('.docker')) {
    return <FileCode size={13} className="text-sky-400" />;
  }
  if (lower === 'makefile' || lower === 'cmakelists.txt') {
    return <FileCode size={13} className="text-amber-500" />;
  }
  if (lower.startsWith('.env')) {
    return <FileText size={13} className="text-emerald-400" />;
  }

  switch (ext) {
    case 'ts':
    case 'tsx':
      return <Code2 size={13} className="text-sky-400" />;
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <FileCode size={13} className="text-amber-400" />;
    case 'json':
    case 'jsonc':
      return <FileJson size={13} className="text-yellow-300" />;
    case 'md':
    case 'markdown':
    case 'mdx':
      return <FileText size={13} className="text-purple-400" />;
    case 'txt':
    case 'log':
    case 'cfg':
    case 'conf':
    case 'ini':
      return <FileText size={13} className="text-zinc-400" />;
    case 'py':
    case 'ipynb':
      return <FileCode size={13} className="text-emerald-400" />;
    case 'rs':
      return <FileCode size={13} className="text-orange-400" />;
    case 'go':
      return <FileCode size={13} className="text-cyan-400" />;
    case 'c':
    case 'cpp':
    case 'cc':
    case 'h':
    case 'hpp':
    case 'cs':
    case 'java':
    case 'kt':
      return <FileCode size={13} className="text-blue-400" />;
    case 'html':
    case 'htm':
    case 'svg':
    case 'xml':
      return <FileCode size={13} className="text-orange-500" />;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <FileCode size={13} className="text-pink-400" />;
    case 'yaml':
    case 'yml':
    case 'toml':
      return <FileJson size={13} className="text-teal-400" />;
    case 'sql':
    case 'db':
    case 'sqlite':
      return <FileText size={13} className="text-indigo-400" />;
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'ps1':
    case 'bat':
    case 'cmd':
      return <FileCode size={13} className="text-lime-400" />;
    case 'gguf':
    case 'bin':
      return <FileCode size={13} className="text-rose-400" />;
    default:
      return <FileText size={13} className="text-[var(--theme-text-muted)]" />;
  }
};

import { useI18n } from '../i18n';

export const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  workspaceDir,
  treeNodes,
  onSelectWorkspace,
  onFileClick,
}) => {
  const { t } = useI18n();
  const [filterText, setFilterText] = useState('');

  // Recursively filter tree nodes by name
  const filteredNodes = useMemo(() => {
    if (!filterText.trim()) return treeNodes;

    const filterRecursive = (nodes: FileNode[]): FileNode[] => {
      const result: FileNode[] = [];
      for (const node of nodes) {
        if (node.is_dir && node.children) {
          const matchingChildren = filterRecursive(node.children);
          if (matchingChildren.length > 0 || node.name.toLowerCase().includes(filterText.toLowerCase())) {
            result.push({
              ...node,
              children: matchingChildren,
            });
          }
        } else if (node.name.toLowerCase().includes(filterText.toLowerCase())) {
          result.push(node);
        }
      }
      return result;
    };

    return filterRecursive(treeNodes);
  }, [treeNodes, filterText]);

  return (
    <div className="h-full flex flex-col select-none text-[var(--theme-text)] font-sans bg-[var(--theme-panel)] border-r border-[var(--theme-border)] rounded-none">
      
      {/* Directory Path Selector Header */}
      <div className="p-2.5 bg-[var(--theme-panel)] border-b border-[var(--theme-border)] text-xs space-y-2">
        <div className="text-[var(--theme-text-muted)] text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
          <span>{t.nav.workspace}</span>
          <FolderSearch size={12} className="text-[var(--theme-accent)]" />
        </div>

        <button 
          onClick={onSelectWorkspace}
          className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] cursor-pointer transition-all text-left flex items-center gap-2 group shadow-sm"
          title={workspaceDir || t.sidebar.openWorkspace}
        >
          <Folder size={14} className="text-amber-400 shrink-0 group-hover:scale-105 transition-transform" />
          <span className="truncate text-xs font-mono font-medium flex-1">
            {workspaceDir ? workspaceDir.split('\\').pop() || workspaceDir.split('/').pop() : `${t.sidebar.openWorkspace}...`}
          </span>
        </button>

        {/* Quick Filter Input */}
        <div className="relative pt-0.5">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t.sidebar.searchPlaceholder}
            className="w-full pl-6 pr-5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-accent)] font-mono transition-colors"
          />
          <Search size={11} className="absolute left-2 top-3 text-[var(--theme-text-muted)]" />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="absolute right-1.5 top-2.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] p-0.5 cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 font-mono text-xs scrollbar-thin">
        {filteredNodes.length > 0 ? (
          <TreeNodeList 
            nodes={filteredNodes} 
            depth={0} 
            onFileClick={onFileClick} 
            isFiltering={Boolean(filterText.trim())}
          />
        ) : (
          <div className="text-center py-8 px-3 text-xs text-[var(--theme-text-muted)] font-sans leading-relaxed">
            {workspaceDir
              ? filterText
                ? t.sidebar.noSessionsFound
                : t.sidebar.noSessionsFound
              : `${t.sidebar.openWorkspace}...`}
          </div>
        )}
      </div>

    </div>
  );
};

interface TreeNodeListProps {
  nodes: FileNode[];
  depth: number;
  onFileClick: (path: string, name: string) => void;
  isFiltering?: boolean;
}

const TreeNodeList: React.FC<TreeNodeListProps> = ({ nodes, depth, onFileClick, isFiltering }) => {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNodeItem 
          key={node.path} 
          node={node} 
          depth={depth} 
          onFileClick={onFileClick} 
          isFiltering={isFiltering}
        />
      ))}
    </div>
  );
};

interface TreeNodeItemProps {
  node: FileNode;
  depth: number;
  onFileClick: (path: string, name: string) => void;
  isFiltering?: boolean;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({ node, depth, onFileClick, isFiltering }) => {
  const [isOpen, setIsOpen] = useState(false);
  const effectivelyOpen = isFiltering || isOpen;

  const handleToggle = () => {
    if (node.is_dir) {
      setIsOpen(!isOpen);
    } else {
      onFileClick(node.path, node.name);
    }
  };

  return (
    <div>
      <div
        onClick={handleToggle}
        className="flex items-center py-1 px-1.5 rounded-lg hover:bg-[var(--theme-border-subtle)] cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors text-xs select-none group"
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
      >
        <span className="mr-1 text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] transition-colors">
          {node.is_dir ? (
            effectivelyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="w-[12px] inline-block" />
          )}
        </span>

        <span className="mr-1.5 shrink-0">
          {node.is_dir ? (
            effectivelyOpen ? (
              <FolderOpen size={13} className="text-amber-400" />
            ) : (
              <Folder size={13} className="text-amber-400/80" />
            )
          ) : (
            getFileIcon(node.name)
          )}
        </span>

        <span className="truncate text-[11px] font-mono">{node.name}</span>
      </div>

      {node.is_dir && effectivelyOpen && node.children && (
        <TreeNodeList 
          nodes={node.children} 
          depth={depth + 1} 
          onFileClick={onFileClick} 
          isFiltering={isFiltering}
        />
      )}
    </div>
  );
};
