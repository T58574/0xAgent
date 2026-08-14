import React, { useState } from 'react';
import { ToolCallInfo } from '../types';
import { MaterialIcon } from './common/MaterialIcon';

interface ToolCardProps {
  tool: ToolCallInfo;
  onRespond: (toolId: string, approve: boolean | string) => void;
  onOpenFileInEditor?: (filePath: string) => void;
}

const DetailToggle: React.FC<{ isOpen: boolean; onToggle: () => void; labelOpen: string; labelClosed: string }> = ({
  isOpen,
  onToggle,
  labelOpen,
  labelClosed,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex items-center gap-1.5 text-xs text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
  >
    <span>{isOpen ? labelOpen : labelClosed}</span>
    <MaterialIcon name={isOpen ? 'expand_less' : 'expand_more'} size={16} />
  </button>
);

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

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onRespond, onOpenFileInEditor }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<'unified' | 'split'>('unified');
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
        return { label: 'УСПЕШНО', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', iconName: 'check_circle' };
      case 'error':
        return { label: 'ОШИБКА', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10', iconName: 'error' };
      case 'running':
        return { label: 'ВЫПОЛНЕНИЕ', color: 'text-theme-accent border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/10 animate-pulse', iconName: 'progress_activity' };
      case 'rejected':
        return { label: 'ОТКЛОНЕНО', color: 'text-theme-muted border-theme-border bg-white/5', iconName: 'cancel' };
      case 'pending':
        return { label: 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', iconName: 'warning' };
      default:
        return { label: tool.status.toUpperCase(), color: 'text-theme-muted border-theme-border bg-white/5', iconName: 'info' };
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
        <div className="text-theme-text text-[11px] font-mono whitespace-pre-wrap p-2.5 bg-slate-950/80 rounded border border-theme-border">
          {patchText}
        </div>
      );
    }

    return (
      <div className="space-y-3 font-mono text-[11px] mt-2">
        {/* Toggle Mode Control Bar */}
        <div className="flex items-center justify-between pb-1 border-b border-theme-border text-[10px]">
          <span className="text-theme-muted font-sans font-medium">Просмотр изменений патча:</span>
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-theme-border">
            <button
              type="button"
              onClick={() => setDiffViewMode('unified')}
              className={`px-2 py-0.5 rounded font-sans font-semibold cursor-pointer transition-colors ${
                diffViewMode === 'unified' ? 'bg-theme-accent text-slate-950' : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Unified
            </button>
            <button
              type="button"
              onClick={() => setDiffViewMode('split')}
              className={`px-2 py-0.5 rounded font-sans font-semibold cursor-pointer transition-colors ${
                diffViewMode === 'split' ? 'bg-theme-accent text-slate-950' : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Side-by-Side
            </button>
          </div>
        </div>

        {blocks.map((b, idx) => {
          const searchLines = b.search ? b.search.split('\n') : [];
          const replaceLines = b.replace ? b.replace.split('\n') : [];
          const maxLines = Math.max(searchLines.length, replaceLines.length);

          if (diffViewMode === 'split') {
            return (
              <div key={idx} className="rounded-lg overflow-hidden border border-theme-border bg-slate-950/90">
                <div className="grid grid-cols-2 divide-x divide-white/10 text-[11px]">
                  {/* Left Column: SEARCH (Deletions) */}
                  <div className="bg-rose-950/30 text-rose-300 p-2 overflow-x-auto">
                    <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1 select-none flex items-center gap-1 border-b border-rose-500/20 pb-1">
                      <span>- УДАЛЯЕМЫЕ СТРОКИ</span>
                    </div>
                    {Array.from({ length: maxLines }).map((_, lIdx) => {
                      const line = searchLines[lIdx];
                      return (
                        <div key={lIdx} className="flex gap-2 min-h-[1.35rem]">
                          <span className="text-rose-500/60 select-none w-4 text-right shrink-0">{line !== undefined ? lIdx + 1 : ''}</span>
                          <span className="truncate">{line !== undefined ? line : ''}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Column: REPLACE (Additions) */}
                  <div className="bg-emerald-950/30 text-emerald-300 p-2 overflow-x-auto">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 select-none flex items-center gap-1 border-b border-emerald-500/20 pb-1">
                      <span>+ НОВЫЕ СТРОКИ</span>
                    </div>
                    {Array.from({ length: maxLines }).map((_, lIdx) => {
                      const line = replaceLines[lIdx];
                      return (
                        <div key={lIdx} className="flex gap-2 min-h-[1.35rem]">
                          <span className="text-emerald-500/60 select-none w-4 text-right shrink-0">{line !== undefined ? lIdx + 1 : ''}</span>
                          <span className="truncate">{line !== undefined ? line : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Unified View Mode
          return (
            <div key={idx} className="rounded-lg overflow-hidden border border-theme-border bg-slate-950/90">
              {b.search && (
                <div className="bg-rose-950/40 text-rose-300 p-2.5 border-b border-rose-500/20 whitespace-pre-wrap">
                  <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1 select-none flex items-center gap-1">
                    <span>- УДАЛЯЕМЫЕ СТРОКИ</span>
                  </div>
                  {searchLines.map((line, lIdx) => (
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
                  {replaceLines.map((line, lIdx) => (
                    <div key={lIdx} className="flex gap-2">
                      <span className="text-emerald-500/60 select-none">+</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-lg p-3 my-2 glass-panel border border-theme-border text-theme-text font-sans shadow-md">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* File Extension Badge */}
          {filePath ? (
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border shrink-0 ${fileBadge.color}`}>
              {fileBadge.label}
            </span>
          ) : (
            <div className="w-6 h-6 rounded bg-slate-800 border border-theme-border flex items-center justify-center shrink-0">
              <MaterialIcon name={tool.name === 'execute_command' ? 'terminal' : 'description'} size={14} className="text-theme-accent" />
            </div>
          )}

          {/* File path or command description */}
          <div className="min-w-0">
            {filePath ? (
              <div
                className={`text-xs font-mono font-medium truncate ${
                  onOpenFileInEditor ? 'hover:underline cursor-pointer text-theme-accent' : 'text-theme-text'
                }`}
                title={filePath}
                onClick={() => onOpenFileInEditor && onOpenFileInEditor(filePath)}
              >
                {filePath}
              </div>
            ) : (
              <div className="text-xs font-mono font-medium text-theme-text truncate">
                {tool.name} <span className="text-[10px] text-theme-muted">[{tool.id}]</span>
              </div>
            )}
          </div>
        </div>

        {/* Diff line stats (+lines -lines) or status badge */}
        <div className="flex items-center gap-2 shrink-0">
          {(diffStats.additions > 0 || diffStats.deletions > 0) && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-theme-border">
              {diffStats.additions > 0 && <span className="text-emerald-400">+{diffStats.additions}</span>}
              {diffStats.deletions > 0 && <span className="text-rose-400">-{diffStats.deletions}</span>}
            </div>
          )}

          <div className={`px-2 py-0.5 rounded text-[10px] border font-semibold flex items-center gap-1.5 ${statusInfo.color}`}>
            <MaterialIcon name={statusInfo.iconName} size={13} />
            <span>{statusInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Action Content Preview */}
      <div className="mt-2.5 font-mono text-xs text-theme-text">
        {tool.name === 'execute_command' && (
          <div className="flat-input rounded-md p-2.5 bg-slate-950 border border-theme-border flex items-start gap-2">
            <span className="text-emerald-400 font-bold select-none">PS &gt;</span>
            <span className="text-theme-text break-all">{parsedArgs.command}</span>
          </div>
        )}

        {tool.name === 'write_file' && (
          <div className="space-y-1.5">
            <DetailToggle
              isOpen={showDetails}
              onToggle={() => setShowDetails(!showDetails)}
              labelOpen="Скрыть содержимое файла"
              labelClosed="Показать создаваемый файл"
            />
            {showDetails && (
              <div className="text-[10px] whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-950 p-3 border border-theme-border rounded-md text-theme-text">
                {parsedArgs.content}
              </div>
            )}
          </div>
        )}

        {tool.name === 'patch_file' && (
          <div className="space-y-1.5">
            <DetailToggle
              isOpen={showDetails}
              onToggle={() => setShowDetails(!showDetails)}
              labelOpen="Скрыть разницу строк (diff)"
              labelClosed="Просмотреть изменения строк (diff)"
            />
            {showDetails && renderPatchDiffFormatted(parsedArgs.content)}
          </div>
        )}

        {tool.name === 'ask_user' && (
          <div className="space-y-2 font-sans">
            <div className="text-amber-300 font-semibold text-xs flex items-center gap-1.5">
              <span>Вопрос от Агента:</span>
            </div>
            <div className="text-theme-text text-xs font-medium bg-slate-950 p-3 rounded-md border border-theme-border">
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
                        className="flat-btn px-3 py-1 rounded-md text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer disabled:opacity-40"
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
                    className="flex-1 px-3 py-1.5 rounded-md flat-input text-xs text-theme-text focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!customAnswer.trim() || isSubmitting}
                    className="flat-btn px-3.5 py-1.5 rounded-md text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting && <MaterialIcon name="progress_activity" size={13} className="animate-spin text-emerald-400" />}
                    <span>{isSubmitting ? 'Отправка...' : 'Отправить'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {tool.name === 'update_user_profile' && (
          <div className="rounded-md p-2.5 bg-black/40 border border-theme-border flex items-start gap-2.5 text-xs">
            <MaterialIcon name="person" size={16} className="text-theme-accent shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1 font-sans">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-theme-text text-[11.5px]">Обновление профиля пользователя:</span>
                <span className="px-1.5 py-0.2 rounded bg-white/5 border border-theme-border text-[10px] font-mono text-theme-muted uppercase">
                  {parsedArgs.category || 'profile'}
                </span>
              </div>
              <div className="text-[12px] text-theme-text font-mono bg-black/30 p-1.5 rounded border border-white/5">
                {parsedArgs.trait || parsedArgs.content || '(пусто)'}
              </div>
            </div>
          </div>
        )}

        {tool.name === 'update_persona_file' && (
          <div className="rounded-md p-2.5 bg-black/40 border border-theme-border flex items-start gap-2.5 text-xs">
            <MaterialIcon name="psychology" size={16} className="text-theme-accent shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1 font-sans">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-theme-text text-[11.5px]">Обновление файла персоны:</span>
                <span className="px-1.5 py-0.2 rounded bg-white/5 border border-theme-border text-[10px] font-mono text-theme-muted">
                  {parsedArgs.file || 'SOUL.md'}
                </span>
              </div>
              {parsedArgs.content && (
                <div className="text-[10.5px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto bg-black/30 p-2 rounded border border-white/5 text-theme-muted">
                  {parsedArgs.content}
                </div>
              )}
            </div>
          </div>
        )}

        {tool.name === 'run_scratch_script' && (
          <div className="space-y-1.5">
            <div className="text-theme-muted text-[11px]">Скрипт ({parsedArgs.language})</div>
            <div className="text-[10px] whitespace-pre-wrap max-h-36 overflow-y-auto bg-slate-950 p-2.5 border border-theme-border rounded-md text-theme-text">
              {parsedArgs.code}
            </div>
          </div>
        )}
      </div>

      {/* Approve / Reject Controls */}
      {tool.status === 'pending' && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-theme-border pt-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction(false)}
            className="px-3.5 py-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 border border-rose-500/30"
          >
            <MaterialIcon name="close" size={14} />
            <span>Отклонить</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction(true)}
            className="px-4 py-1.5 rounded-md btn-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40"
          >
            {isSubmitting ? (
              <MaterialIcon name="progress_activity" size={14} className="animate-spin" />
            ) : (
              <MaterialIcon name="check" size={14} />
            )}
            <span>{isSubmitting ? 'Выполняется...' : 'Подтвердить'}</span>
          </button>
        </div>
      )}

      {/* Execution Output Drawer */}
      {tool.output && (
        <div className="mt-2.5 border-t border-theme-border pt-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-[11px] text-theme-muted hover:text-theme-text cursor-pointer transition-colors"
          >
            <span>{showDetails ? 'Скрыть лог выполнения' : 'Показать результат выполнения'}</span>
            <MaterialIcon name={showDetails ? 'expand_less' : 'expand_more'} size={14} />
          </button>

          {showDetails && (
            <div className="mt-2 bg-slate-950 rounded-md p-2.5 border border-theme-border text-[11px] font-mono text-theme-text whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
              {tool.output}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
