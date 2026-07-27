import React, { useState } from 'react';
import {
  Check,
  X,
  Terminal,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { ToolCallInfo } from '../types';

interface ToolCardProps {
  tool: ToolCallInfo;
  onRespond: (toolId: string, approve: boolean | string) => void;
}

function calculateDiffStats(toolName: string, args: Record<string, any>): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  if (toolName === 'write_file' && args.content) {
    additions = (args.content as string).split(/\r?\n/).length;
  } else if (toolName === 'patch_file' && args.content) {
    const raw = args.content as string;
    const searchMatches = raw.match(/<<<<<<< SEARCH([\s\S]*?)=======/g) || [];
    for (const m of searchMatches) {
      deletions += Math.max(0, m.split(/\r?\n/).length - 2);
    }
    const replaceMatches = raw.match(/=======([\s\S]*?)>>>>>>> REPLACE/g) || [];
    for (const m of replaceMatches) {
      additions += Math.max(0, m.split(/\r?\n/).length - 2);
    }
  }

  return { additions, deletions };
}

function getFileTypeBadge(filePath: string): { label: string; color: string } {
  if (!filePath) return { label: 'FILE', color: 'bg-slate-800 text-slate-300 border-slate-700' };
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return { label: ext === 'tsx' ? 'TSX' : 'TS', color: 'bg-sky-950/80 text-sky-300 border-sky-500/40' };
    case 'js':
    case 'jsx':
      return { label: 'JS', color: 'bg-amber-950/80 text-amber-300 border-amber-500/40' };
    case 'md':
      return { label: 'M+', color: 'bg-purple-950/80 text-purple-300 border-purple-500/40' };
    case 'json':
    case 'yml':
    case 'yaml':
      return { label: 'CFG', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' };
    case 'css':
    case 'html':
      return { label: 'UI', color: 'bg-rose-950/80 text-rose-300 border-rose-500/40' };
    default:
      return { label: 'FILE', color: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onRespond }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [customAnswer, setCustomAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = (value: boolean | string) => {
    setIsSubmitting(true);
    onRespond(tool.id, value);
  };

  let parsedArgs: Record<string, any> = {};
  try {
    parsedArgs = JSON.parse(tool.arguments);
  } catch (e) {
    parsedArgs = { raw: tool.arguments };
  }

  const filePath = parsedArgs.path || '';
  const fileBadge = getFileTypeBadge(filePath);
  const diffStats = calculateDiffStats(tool.name, parsedArgs);

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

  const statusInfo = getStatusInfo();

  const renderPatchDiffFormatted = (patchText: string) => {
    if (!patchText) return null;
    const blocks: { search: string; replace: string }[] = [];
    const searchRegex = /<<<<<<< SEARCH([\s\S]*?)=======([\s\S]*?)>>>>>>> REPLACE/g;
    let match: RegExpExecArray | null;
    while ((match = searchRegex.exec(patchText)) !== null) {
      blocks.push({ search: match[1].trim(), replace: match[2].trim() });
    }

    if (blocks.length === 0) {
      return (
        <div className="text-slate-300 text-[11px] font-mono whitespace-pre-wrap p-2.5 bg-slate-950/80 rounded border border-white/10">
          {patchText}
        </div>
      );
    }

    return (
      <div className="space-y-2 font-mono text-[11px]">
        {blocks.map((b, idx) => (
          <div key={idx} className="rounded overflow-hidden border border-white/10 bg-slate-950/90">
            {b.search && (
              <div className="bg-rose-950/40 text-rose-300 p-2.5 border-b border-rose-500/20 whitespace-pre-wrap">
                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1 select-none flex items-center gap-1">
                  <span>- УДАЛЯЕМЫЕ СТРОКИ</span>
                </div>
                {b.search.split('\n').map((line, lIdx) => (
                  <div key={lIdx} className="flex gap-2">
                    <span className="text-rose-500/60 select-none">-</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}
            {b.replace && (
              <div className="bg-emerald-950/40 text-emerald-300 p-2.5 whitespace-pre-wrap">
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 select-none flex items-center gap-1">
                  <span>+ НОВЫЕ СТРОКИ</span>
                </div>
                {b.replace.split('\n').map((line, lIdx) => (
                  <div key={lIdx} className="flex gap-2">
                    <span className="text-emerald-500/60 select-none">+</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl p-3.5 my-2.5 bg-slate-900/90 border border-white/10 text-slate-100 font-sans shadow-lg backdrop-blur-md">
      {/* Header Bar in Antigravity / Claude Code style */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* File Extension Badge */}
          {filePath ? (
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border shrink-0 ${fileBadge.color}`}>
              {fileBadge.label}
            </span>
          ) : (
            <div className="w-7 h-7 rounded bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
              {tool.name === 'execute_command' ? <Terminal size={14} className="text-sky-400" /> : <FileText size={14} className="text-amber-400" />}
            </div>
          )}

          {/* File path or command description */}
          <div className="min-w-0">
            {filePath ? (
              <div className="text-xs font-mono font-medium text-slate-200 truncate" title={filePath}>
                {filePath}
              </div>
            ) : (
              <div className="text-xs font-mono font-medium text-slate-200 truncate">
                {tool.name} <span className="text-[10px] text-slate-500">[{tool.id}]</span>
              </div>
            )}
          </div>
        </div>

        {/* Diff line stats (+lines -lines) or status badge */}
        <div className="flex items-center gap-2 shrink-0">
          {(diffStats.additions > 0 || diffStats.deletions > 0) && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-white/10">
              {diffStats.additions > 0 && <span className="text-emerald-400">+{diffStats.additions}</span>}
              {diffStats.deletions > 0 && <span className="text-rose-400">-{diffStats.deletions}</span>}
            </div>
          )}

          <div className={`px-2 py-0.5 rounded text-[10px] border font-semibold flex items-center gap-1.5 ${statusInfo.color}`}>
            {statusInfo.icon}
            <span>{statusInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Action Content Preview */}
      <div className="mt-3 font-mono text-xs text-slate-200">
        {tool.name === 'execute_command' && (
          <div className="flat-input rounded-lg p-2.5 bg-slate-950 border border-white/10 flex items-start gap-2">
            <span className="text-emerald-400 font-bold select-none">PS &gt;</span>
            <span className="text-slate-100 break-all">{parsedArgs.command}</span>
          </div>
        )}

        {tool.name === 'write_file' && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>{showDetails ? 'Скрыть содержимое файла' : 'Показать создаваемый файл'}</span>
              {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showDetails && (
              <div className="text-[10px] whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-950 p-3 border border-white/10 rounded-lg text-slate-300">
                {parsedArgs.content}
              </div>
            )}
          </div>
        )}

        {tool.name === 'patch_file' && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>{showDetails ? 'Скрыть разницу строк (diff)' : 'Просмотреть изменения строк (diff)'}</span>
              {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showDetails && renderPatchDiffFormatted(parsedArgs.content)}
          </div>
        )}

        {tool.name === 'ask_user' && (
          <div className="space-y-2 font-sans">
            <div className="text-amber-300 font-semibold text-xs flex items-center gap-1.5">
              <span>Вопрос от Агента:</span>
            </div>
            <div className="text-slate-100 text-xs font-medium bg-slate-950 p-3 rounded-lg border border-white/10">
              {parsedArgs.question}
            </div>
            {tool.status === 'pending' && (
              <div className="space-y-2 pt-1">
                {Array.isArray(parsedArgs.options) && parsedArgs.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedArgs.options.map((opt: string) => (
                      <button
                        key={opt}
                        disabled={isSubmitting}
                        onClick={() => handleAction(opt)}
                        className="flat-btn px-3 py-1 rounded-lg text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer disabled:opacity-40"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customAnswer.trim() && !isSubmitting) {
                      handleAction(customAnswer.trim());
                      setCustomAnswer('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={customAnswer}
                    disabled={isSubmitting}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    placeholder="Введите ваш ответ..."
                    className="flex-1 px-3 py-1.5 rounded-lg flat-input text-xs text-slate-100 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!customAnswer.trim() || isSubmitting}
                    className="flat-btn px-3.5 py-1.5 rounded-lg text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting && <RefreshCw size={12} className="animate-spin text-emerald-400" />}
                    <span>{isSubmitting ? 'Отправка...' : 'Отправить'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {tool.name === 'run_scratch_script' && (
          <div className="space-y-1.5">
            <div className="text-slate-400 text-[11px]">Скрипт ({parsedArgs.language})</div>
            <div className="text-[10px] whitespace-pre-wrap max-h-36 overflow-y-auto bg-slate-950 p-2.5 border border-white/10 rounded-lg text-slate-300">
              {parsedArgs.code}
            </div>
          </div>
        )}
      </div>

      {/* Approve / Reject Controls */}
      {tool.status === 'pending' && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/10 pt-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction(false)}
            className="px-3.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 border border-rose-500/30"
          >
            <X size={13} />
            <span>Отклонить</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction(true)}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40"
          >
            {isSubmitting ? (
              <RefreshCw size={13} className="animate-spin text-white" />
            ) : (
              <Check size={13} />
            )}
            <span>{isSubmitting ? 'Выполняется...' : 'Подтвердить'}</span>
          </button>
        </div>
      )}

      {/* Execution Output Drawer */}
      {tool.output && (
        <div className="mt-2.5 border-t border-white/5 pt-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <span>{showDetails ? 'Скрыть лог выполнения' : 'Показать результат выполнения'}</span>
            {showDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {showDetails && (
            <div className="mt-2 bg-slate-950 rounded-lg p-3 border border-white/10 text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
              {tool.output}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
