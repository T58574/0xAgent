import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, ChevronDown, ChevronRight } from 'lucide-react';
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
    <div className="h-full flex flex-col select-none text-theme-text font-sans bg-theme-bg border-r border-theme-border">
      {/* Directory Path Selector */}
      <div className="px-4 py-3 bg-theme-bg border-b border-theme-border text-xs">
        <div className="text-theme-text opacity-60 font-semibold mb-1 uppercase tracking-wider text-[9px]">Active Directory</div>
        <div 
          onClick={onSelectWorkspace}
          className="truncate font-mono p-2 rounded-full border border-theme-border text-theme-text cursor-pointer bg-theme-bg hover:bg-theme-active text-center transition-all"
          title={workspaceDir || "Click to select a directory"}
        >
          {workspaceDir ? workspaceDir.split('\\').pop() : "No folder selected"}
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 font-mono text-xs">
        {treeNodes.length > 0 ? (
          <TreeNodeList 
            nodes={treeNodes} 
            depth={0} 
            onFileClick={onFileClick} 
          />
        ) : (
          <div className="text-center py-8 px-4 text-xs text-theme-text opacity-50 font-sans">
            {workspaceDir ? "Empty workspace folder" : "Select a folder to view files and allow the AI to write code locally."}
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
        className="flex items-center py-1 px-2 rounded hover:bg-theme-active cursor-pointer text-theme-text transition-all text-xs select-none"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="mr-1 text-theme-text opacity-60">
          {node.is_dir ? (
            isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="w-[12px] inline-block" />
          )}
        </span>

        <span className="mr-2 shrink-0">
          {node.is_dir ? (
            isOpen ? (
              <FolderOpen size={12} className="text-theme-text opacity-80" />
            ) : (
              <Folder size={12} className="text-theme-text opacity-85" />
            )
          ) : (
            <FileCode size={12} className="text-theme-text opacity-70" />
          )}
        </span>

        <span className="truncate">{node.name}</span>
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
