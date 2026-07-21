import React, { useState } from 'react';
import { Check, X, Terminal, FileText, Layers, Search, Folder, CheckCircle, AlertCircle } from 'lucide-react';
import { ToolCallInfo } from '../types';

interface ToolCardProps {
  tool: ToolCallInfo;
  onRespond: (toolId: string, approve: boolean) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onRespond }) => {
  const [showDetails, setShowDetails] = useState(false);

  // Parse arguments since they are serialized JSON from Rust backend
  let parsedArgs: Record<string, any> = {};
  try {
    parsedArgs = JSON.parse(tool.arguments);
  } catch (e) {
    parsedArgs = { raw: tool.arguments };
  }

  // Get status label
  const getStatusLabel = () => {
    switch (tool.status) {
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      case 'running': return 'Executing...';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Awaiting Approval';
      default: return tool.status;
    }
  };

  // Get Tool Icon
  const getToolIcon = () => {
    switch (tool.name) {
      case 'execute_command': return <Terminal size={14} className="text-black" />;
      case 'write_file': return <FileText size={14} className="text-black" />;
      case 'patch_file': return <Layers size={14} className="text-black" />;
      case 'read_file': return <FileText size={14} className="text-black" />;
      case 'grep_search': return <Search size={14} className="text-black" />;
      case 'list_dir': return <Folder size={14} className="text-black" />;
      default: return <Terminal size={14} className="text-black" />;
    }
  };

  return (
    <div className="p-4 rounded-xl border border-black bg-white transition-all my-3 text-black">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full border border-black bg-neutral-100 flex items-center justify-center">
            {getToolIcon()}
          </div>
          <div>
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              Tool Request
            </div>
            <div className="text-xs font-bold font-mono">
              {tool.name}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1">
          {tool.status === 'completed' && <CheckCircle size={12} className="text-black" />}
          {tool.status === 'error' && <AlertCircle size={12} className="text-black" />}
          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
            [ {getStatusLabel()} ]
          </span>
        </div>
      </div>

      {/* Main Arguments */}
      <div className="mt-3 bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs font-mono text-neutral-800 max-h-36 overflow-y-auto">
        {tool.name === 'execute_command' && (
          <div>
            <span className="text-neutral-500 font-bold">$ </span>
            {parsedArgs.command}
          </div>
        )}
        {tool.name === 'write_file' && (
          <div>
            <div className="text-neutral-500 mb-1">Path: <span className="text-black font-bold">{parsedArgs.path}</span></div>
            <div className="mt-1 text-neutral-700 text-[10px] whitespace-pre-wrap max-h-24 overflow-y-auto bg-white p-2 border border-neutral-200 rounded">
              {parsedArgs.content}
            </div>
          </div>
        )}
        {tool.name === 'patch_file' && (
          <div>
            <div className="text-neutral-500 mb-1">Path: <span className="text-black font-bold">{parsedArgs.path}</span></div>
            <div className="mt-1 text-neutral-700 text-[10px] whitespace-pre-wrap max-h-24 overflow-y-auto bg-white p-2 border border-neutral-200 rounded font-mono">
              {parsedArgs.content}
            </div>
          </div>
        )}
        {(tool.name === 'read_file' || tool.name === 'list_dir') && (
          <div>
            <span className="text-neutral-500">Path: </span>
            {parsedArgs.path}
          </div>
        )}
        {tool.name === 'grep_search' && (
          <div className="space-y-1">
            <div>
              <span className="text-neutral-500">Pattern: </span>
              <span className="text-black">"{parsedArgs.pattern}"</span>
            </div>
            <div>
              <span className="text-neutral-500">Path: </span>
              {parsedArgs.path}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons for Pending tools */}
      {tool.status === 'pending' && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => onRespond(tool.id, false)}
            className="flex items-center gap-1.5 px-4 py-1 rounded-full border border-black hover:bg-neutral-100 text-black text-xs font-bold cursor-pointer transition-all focus:outline-none"
          >
            <X size={12} />
            <span>Reject</span>
          </button>
          <button
            onClick={() => onRespond(tool.id, true)}
            className="flex items-center gap-1.5 px-4 py-1 rounded-full border border-black bg-[#86EFAC] hover:bg-green-400 text-black text-xs font-bold cursor-pointer transition-all focus:outline-none"
          >
            <Check size={12} />
            <span>Approve</span>
          </button>
        </div>
      )}

      {/* Output Drawer Toggle */}
      {tool.output && (
        <div className="mt-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[9px] font-bold text-neutral-500 hover:text-black uppercase tracking-wider cursor-pointer transition-all focus:outline-none"
          >
            <span>{showDetails ? 'Hide Output Log' : 'View Output Log'}</span>
          </button>

          {showDetails && (
            <div className="mt-1.5 bg-neutral-50 rounded-lg p-2 border border-neutral-200 text-[10px] font-mono text-neutral-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {tool.output}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
