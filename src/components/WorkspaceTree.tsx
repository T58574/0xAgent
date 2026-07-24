import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, ChevronDown, ChevronRight, FolderSearch } from 'lucide-react';
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
  return (
    <div className="h-full flex flex-col select-none text-slate-100 font-sans glass-panel border-r border-white/10 rounded-none">
      {/* Directory Path Selector Header */}
      <div className="p-2.5 bg-slate-900/60 border-b border-white/10 text-xs">
        <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Воркспейс</span>
          <FolderSearch size={12} className="text-emerald-400" />
        </div>
        <button 
          onClick={onSelectWorkspace}
          className="w-full flat-btn px-2.5 py-1.5 rounded text-slate-200 hover:text-white cursor-pointer transition-all text-left flex items-center gap-2 group"
          title={workspaceDir || "Выбрать рабочую папку"}
        >
          <Folder size={13} className="text-emerald-400 shrink-0 group-hover:scale-105 transition-transform" />
          <span className="truncate text-xs font-mono flex-1">
            {workspaceDir ? workspaceDir.split('\\').pop() || workspaceDir.split('/').pop() : "Выбрать папку..."}
          </span>
        </button>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 font-mono text-xs scrollbar-none">
        {treeNodes.length > 0 ? (
          <TreeNodeList 
            nodes={treeNodes} 
            depth={0} 
            onFileClick={onFileClick} 
          />
        ) : (
          <div className="text-center py-10 px-4 text-xs text-slate-400 font-sans leading-relaxed">
            {workspaceDir ? "Папка пуста" : "Выберите папку для чтения файлов."}
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
}

const TreeNodeList: React.FC<TreeNodeListProps> = ({ nodes, depth, onFileClick }) => {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNodeItem 
          key={node.path} 
          node={node} 
          depth={depth} 
          onFileClick={onFileClick} 
        />
      ))}
    </div>
  );
};

interface TreeNodeItemProps {
  node: FileNode;
  depth: number;
  onFileClick: (path: string, name: string) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({ node, depth, onFileClick }) => {
  const [isOpen, setIsOpen] = useState(false);

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
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        <span className="mr-1 text-slate-500 group-hover:text-slate-300 transition-colors">
          {node.is_dir ? (
            isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="w-[12px] inline-block" />
          )}
        </span>

        <span className="mr-2 shrink-0">
          {node.is_dir ? (
            isOpen ? (
              <FolderOpen size={13} className="text-amber-400" />
            ) : (
              <Folder size={13} className="text-amber-400/80" />
            )
          ) : (
            <FileCode size={13} className="text-emerald-400" />
          )}
        </span>

        <span className="truncate text-xs font-mono">{node.name}</span>
      </div>

      {node.is_dir && isOpen && node.children && (
        <TreeNodeList 
          nodes={node.children} 
          depth={depth + 1} 
          onFileClick={onFileClick} 
        />
      )}
    </div>
  );
};
