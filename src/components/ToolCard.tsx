import React, { useState } from 'react';
import { Check, X, Terminal, FileText, Layers, Search, Folder, CheckCircle2, AlertTriangle, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { ToolCallInfo } from '../types';

interface ToolCardProps {
  tool: ToolCallInfo;
  onRespond: (toolId: string, approve: boolean) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onRespond }) => {
  const [showDetails, setShowDetails] = useState(false);

  let parsedArgs: Record<string, any> = {};
  try {
    parsedArgs = JSON.parse(tool.arguments);
  } catch (e) {
    parsedArgs = { raw: tool.arguments };
  }

  const getStatusInfo = () => {
    switch (tool.status) {
      case 'completed':
        return { label: 'SUCCESS', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: <CheckCircle2 size={12} className="text-emerald-400" /> };
      case 'error':
        return { label: 'ERROR', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10', icon: <AlertTriangle size={12} className="text-rose-400" /> };
      case 'running':
        return { label: 'EXECUTING', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10 animate-pulse', icon: <Play size={12} className="text-sky-400 animate-spin" /> };
      case 'rejected':
        return { label: 'REJECTED', color: 'text-slate-400 border-slate-500/30 bg-slate-500/10', icon: <X size={12} className="text-slate-400" /> };
      case 'pending':
        return { label: 'AWAITING APPROVAL', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', icon: <AlertTriangle size={12} className="text-amber-400" /> };
      default:
        return { label: tool.status.toUpperCase(), color: 'text-slate-300 border-slate-500/30 bg-slate-500/10', icon: null };
    }
  };

  const getToolIcon = () => {
    switch (tool.name) {
      case 'execute_command': return <Terminal size={14} className="text-sky-400" />;
      case 'write_file': return <FileText size={14} className="text-emerald-400" />;
      case 'patch_file': return <Layers size={14} className="text-indigo-400" />;
      case 'read_file': return <FileText size={14} className="text-slate-300" />;
      case 'grep_search': return <Search size={14} className="text-amber-400" />;
      case 'list_dir': return <Folder size={14} className="text-cyan-400" />;
      default: return <Terminal size={14} className="text-slate-300" />;
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="glass-card rounded-2xl p-4 my-3 border border-white/10 text-slate-100 shadow-xl transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center shadow-inner">
            {getToolIcon()}
          </div>
          <div>
            <div className="text-[9px] font-hud uppercase tracking-widest text-slate-400">
              TOOL ACTION REQUEST
            </div>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <span>{tool.name}</span>
              <span className="text-[10px] text-slate-500 font-normal">[{tool.id}]</span>
            </div>
          </div>
        </div>

        {/* HUD Status Badge */}
        <div className={`px-2.5 py-1 rounded-lg border font-hud text-[10px] tracking-wider flex items-center gap-1.5 uppercase ${statusInfo.color}`}>
          {statusInfo.icon}
          <span>[ {statusInfo.label} ]</span>
        </div>
      </div>

      {/* Main Command / File Target Parameters */}
      <div className="mt-3 skeuo-input rounded-xl p-3 text-xs font-mono text-slate-200 max-h-40 overflow-y-auto">
        {tool.name === 'execute_command' && (
          <div className="flex items-start gap-1.5">
            <span className="text-emerald-400 font-bold select-none">PS &gt;</span>
            <span className="text-slate-100 break-all">{parsedArgs.command}</span>
          </div>
        )}
        {tool.name === 'write_file' && (
          <div>
            <div className="text-slate-400 text-[11px] mb-1">Path: <span className="text-emerald-300 font-bold">{parsedArgs.path}</span></div>
            <div className="mt-1 text-slate-300 text-[10px] whitespace-pre-wrap max-h-28 overflow-y-auto bg-slate-950/60 p-2.5 border border-white/5 rounded-lg">
              {parsedArgs.content}
            </div>
          </div>
        )}
        {tool.name === 'patch_file' && (
          <div>
            <div className="text-slate-400 text-[11px] mb-1">Path: <span className="text-indigo-300 font-bold">{parsedArgs.path}</span></div>
            <div className="mt-1 text-slate-300 text-[10px] whitespace-pre-wrap max-h-28 overflow-y-auto bg-slate-950/60 p-2.5 border border-white/5 rounded-lg font-mono">
              {parsedArgs.content}
            </div>
          </div>
        )}
        {(tool.name === 'read_file' || tool.name === 'list_dir') && (
          <div>
            <span className="text-slate-400">Path: </span>
            <span className="text-slate-100">{parsedArgs.path}</span>
          </div>
        )}
        {tool.name === 'grep_search' && (
          <div className="space-y-1">
            <div>
              <span className="text-slate-400">Pattern: </span>
              <span className="text-amber-300 font-semibold">"{parsedArgs.pattern}"</span>
            </div>
            <div>
              <span className="text-slate-400">Path: </span>
              <span className="text-slate-100">{parsedArgs.path}</span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Approve / Reject buttons for pending actions */}
      {tool.status === 'pending' && (
        <div className="mt-3.5 flex items-center justify-end gap-2.5 border-t border-white/5 pt-3">
          <button
            onClick={() => onRespond(tool.id, false)}
            className="skeuo-btn px-4 py-1.5 rounded-xl text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <X size={13} />
            <span className="font-hud uppercase tracking-wider text-[11px]">Отклонить</span>
          </button>
          <button
            onClick={() => onRespond(tool.id, true)}
            className="skeuo-btn px-5 py-1.5 rounded-xl text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-emerald-500/30"
          >
            <Check size={13} />
            <span className="font-hud uppercase tracking-wider text-[11px]">Подтвердить</span>
          </button>
        </div>
      )}

      {/* Output Log Toggle Drawer */}
      {tool.output && (
        <div className="mt-2.5">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[10px] font-hud text-slate-400 hover:text-white uppercase tracking-wider cursor-pointer transition-colors"
          >
            <span>{showDetails ? 'Скрыть Лог Выполнения' : 'Показать Лог Выполнения'}</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showDetails && (
            <div className="mt-2 bg-slate-950/80 rounded-xl p-3 border border-white/10 text-[10px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-inner">
              {tool.output}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
