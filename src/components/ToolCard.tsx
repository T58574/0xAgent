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
        return { label: 'УСПЕШНО', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: <CheckCircle2 size={12} className="text-emerald-400" /> };
      case 'error':
        return { label: 'ОШИБКА', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10', icon: <AlertTriangle size={12} className="text-rose-400" /> };
      case 'running':
        return { label: 'ВЫПОЛНЕНИЕ', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10 animate-pulse', icon: <Play size={12} className="text-sky-400 animate-spin" /> };
      case 'rejected':
        return { label: 'ОТКЛОНЕНО', color: 'text-slate-400 border-slate-500/30 bg-slate-500/10', icon: <X size={12} className="text-slate-400" /> };
      case 'pending':
        return { label: 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', icon: <AlertTriangle size={12} className="text-amber-400" /> };
      default:
        return { label: tool.status.toUpperCase(), color: 'text-slate-300 border-slate-500/30 bg-slate-500/10', icon: null };
    }
  };

  const getToolIcon = () => {
    switch (tool.name) {
      case 'execute_command': return <Terminal size={14} className="text-sky-400" />;
      case 'write_file': return <FileText size={14} className="text-emerald-400" />;
      case 'patch_file': return <Layers size={14} className="text-cyan-400" />;
      case 'read_file': return <FileText size={14} className="text-slate-300" />;
      case 'grep_search': return <Search size={14} className="text-amber-400" />;
      case 'list_dir': return <Folder size={14} className="text-emerald-400" />;
      default: return <Terminal size={14} className="text-slate-300" />;
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="glass-card rounded-md p-3.5 my-2.5 border border-white/10 text-slate-100 font-sans">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900/80 border border-white/10 flex items-center justify-center">
            {getToolIcon()}
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
              Запрос инструмента
            </div>
            <div className="text-xs font-mono font-medium text-white flex items-center gap-1.5">
              <span>{tool.name}</span>
              <span className="text-[10px] text-slate-500 font-normal">[{tool.id}]</span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-2 py-0.5 rounded text-[10px] border font-medium flex items-center gap-1.5 ${statusInfo.color}`}>
          {statusInfo.icon}
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Main Parameters */}
      <div className="mt-2.5 flat-input rounded-md p-2.5 text-xs font-mono text-slate-200 max-h-40 overflow-y-auto">
        {tool.name === 'execute_command' && (
          <div className="flex items-start gap-1.5">
            <span className="text-emerald-400 font-bold select-none">PS &gt;</span>
            <span className="text-slate-100 break-all">{parsedArgs.command}</span>
          </div>
        )}
        {tool.name === 'write_file' && (
          <div>
            <div className="text-slate-400 text-[11px] mb-1">Файл: <span className="text-emerald-300 font-medium">{parsedArgs.path}</span></div>
            <div className="mt-1 text-slate-300 text-[10px] whitespace-pre-wrap max-h-28 overflow-y-auto bg-slate-950/60 p-2 border border-white/5 rounded">
              {parsedArgs.content}
            </div>
          </div>
        )}
        {tool.name === 'patch_file' && (
          <div>
            <div className="text-slate-400 text-[11px] mb-1">Файл: <span className="text-cyan-300 font-medium">{parsedArgs.path}</span></div>
            <div className="mt-1 text-slate-300 text-[10px] whitespace-pre-wrap max-h-28 overflow-y-auto bg-slate-950/60 p-2 border border-white/5 rounded font-mono">
              {parsedArgs.content}
            </div>
          </div>
        )}
        {(tool.name === 'read_file' || tool.name === 'list_dir') && (
          <div>
            <span className="text-slate-400">Путь: </span>
            <span className="text-slate-100">{parsedArgs.path}</span>
          </div>
        )}
        {tool.name === 'grep_search' && (
          <div className="space-y-1">
            <div>
              <span className="text-slate-400">Шаблон: </span>
              <span className="text-amber-300 font-medium">"{parsedArgs.pattern}"</span>
            </div>
            <div>
              <span className="text-slate-400">Путь: </span>
              <span className="text-slate-100">{parsedArgs.path}</span>
            </div>
          </div>
        )}
        {tool.name === 'ask_user' && (
          <div className="space-y-2">
            <div className="text-amber-300 font-semibold text-xs flex items-center gap-1.5">
              <span>Уточняющий вопрос от Агента:</span>
            </div>
            <div className="text-slate-100 text-xs font-sans font-medium bg-slate-900/80 p-2.5 rounded border border-white/10">
              {parsedArgs.question}
            </div>
            {Array.isArray(parsedArgs.options) && parsedArgs.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsedArgs.options.map((opt: string) => (
                  <button
                    key={opt}
                    onClick={() => onRespond(tool.id, true)}
                    className="flat-btn px-3 py-1 rounded text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {tool.name === 'run_scratch_script' && (
          <div>
            <div className="text-slate-400 text-[11px] mb-1">Scratch Script (<span className="text-purple-300 font-mono">{parsedArgs.language}</span>)</div>
            <div className="text-slate-300 text-[10px] whitespace-pre-wrap max-h-28 overflow-y-auto bg-slate-950/60 p-2 border border-white/5 rounded font-mono">
              {parsedArgs.code}
            </div>
          </div>
        )}
        {tool.name === 'spawn_subagent' && (
          <div className="space-y-1 font-mono">
            <div><span className="text-slate-400">Суб-агент: </span><span className="text-purple-300 font-semibold">{parsedArgs.role}</span></div>
            <div><span className="text-slate-400">Задача: </span><span className="text-slate-200">{parsedArgs.goal}</span></div>
          </div>
        )}
      </div>

      {/* Interactive Approve / Reject buttons */}
      {tool.status === 'pending' && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/5 pt-2.5">
          <button
            onClick={() => onRespond(tool.id, false)}
            className="flat-btn px-3.5 py-1 rounded text-rose-400 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <X size={12} />
            <span>Отклонить</span>
          </button>
          <button
            onClick={() => onRespond(tool.id, true)}
            className="flat-btn px-4 py-1 rounded text-emerald-400 hover:text-emerald-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer border-emerald-500/30"
          >
            <Check size={12} />
            <span>Подтвердить</span>
          </button>
        </div>
      )}

      {/* Output Log Drawer */}
      {tool.output && (
        <div className="mt-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <span>{showDetails ? 'Скрыть лог выполнения' : 'Показать лог выполнения'}</span>
            {showDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {showDetails && (
            <div className="mt-1.5 bg-slate-950/80 rounded-md p-2.5 border border-white/10 text-[10px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
              {tool.output}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
