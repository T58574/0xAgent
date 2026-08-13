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

export const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  workspaceDir,
  treeNodes,
  onSelectWorkspace,
  onFileClick,
}) => {
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
    <div className="h-full flex flex-col select-none text-slate-100 font-sans glass-panel border-r border-white/10 rounded-none">
      
      {/* Directory Path Selector Header */}
      <div className="p-2 bg-slate-900/60 border-b border-white/10 text-xs space-y-1.5">
        <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider flex items-center justify-between">
          <span>Воркспейс</span>
          <FolderSearch size={12} className="text-emerald-400" />
        </div>

        <button 
          onClick={onSelectWorkspace}
          className="w-full flat-btn px-2 py-1 rounded text-slate-200 hover:text-white cursor-pointer transition-all text-left flex items-center gap-2 group"
          title={workspaceDir || "Выбрать рабочую папку"}
        >
          <Folder size={13} className="text-emerald-400 shrink-0 group-hover:scale-105 transition-transform" />
          <span className="truncate text-xs font-mono flex-1">
            {workspaceDir ? workspaceDir.split('\\').pop() || workspaceDir.split('/').pop() : "Выбрать папку..."}
          </span>
        </button>

        {/* Quick Filter Input */}
        <div className="relative pt-0.5">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Фильтр файлов..."
            className="w-full pl-6 pr-5 py-1 rounded bg-black/40 border border-white/10 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
          <Search size={11} className="absolute left-2 top-2.5 text-slate-500" />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="absolute right-1.5 top-2 text-slate-400 hover:text-white p-0.5"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-1 py-1.5 font-mono text-xs scrollbar-none">
        {filteredNodes.length > 0 ? (
          <TreeNodeList 
            nodes={filteredNodes} 
            depth={0} 
            onFileClick={onFileClick} 
            isFiltering={Boolean(filterText.trim())}
          />
        ) : (
          <div className="text-center py-8 px-3 text-xs text-slate-500 font-sans leading-relaxed">
            {workspaceDir
              ? filterText
                ? 'Файлы не найдены'
                : 'Папка пуста'
              : 'Выберите папку для чтения файлов.'}
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

// Get colored icon for specific file extension
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <Code2 size={13} className="text-sky-400" />;
    case 'js':
    case 'jsx':
      return <FileCode size={13} className="text-amber-400" />;
    case 'json':
      return <FileJson size={13} className="text-yellow-300" />;
    case 'md':
    case 'txt':
      return <FileText size={13} className="text-purple-400" />;
    case 'py':
      return <FileCode size={13} className="text-emerald-400" />;
    case 'rs':
      return <FileCode size={13} className="text-orange-400" />;
    case 'css':
    case 'html':
      return <FileCode size={13} className="text-cyan-400" />;
    case 'gguf':
      return <FileCode size={13} className="text-rose-400" />;
    default:
      return <FileCode size={13} className="text-slate-400" />;
  }
};

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
        className="flex items-center py-1 px-1.5 rounded hover:bg-white/10 cursor-pointer text-slate-300 hover:text-white transition-colors text-xs select-none group"
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
      >
        <span className="mr-1 text-slate-500 group-hover:text-slate-300 transition-colors">
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
