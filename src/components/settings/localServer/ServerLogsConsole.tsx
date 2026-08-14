import React from 'react';
import { Terminal, Check, Copy, FileText } from 'lucide-react';

interface ServerLogsConsoleProps {
  serverLogs: string[];
  logFilePath: string;
  serverLogsAutoScroll: boolean;
  setServerLogsAutoScroll: (val: boolean) => void;
  isCopiedLogs: boolean;
  onCopyLogs: () => void;
  onDownloadLogs: () => void;
  onClearLogs: () => void;
  logsContainerRef: React.RefObject<HTMLDivElement | null>;
  logsEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ServerLogsConsole: React.FC<ServerLogsConsoleProps> = ({
  serverLogs,
  logFilePath,
  serverLogsAutoScroll,
  setServerLogsAutoScroll,
  isCopiedLogs,
  onCopyLogs,
  onDownloadLogs,
  onClearLogs,
  logsContainerRef,
  logsEndRef,
}) => {
  return (
    <div className="bento-card border border-[var(--theme-border)] rounded-xl overflow-hidden flex flex-col h-[650px] max-h-[calc(100vh-140px)] shadow-2xl font-sans bg-[var(--theme-panel)]">
      {/* Terminal Header Bar */}
      <div className="bg-black/40 px-3.5 py-2.5 border-b border-[var(--theme-border)] flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[var(--theme-text-muted)]" />
          <span className="text-xs font-semibold text-[var(--theme-text)]">Логи Сервера (llama-server.log)</span>
          {logFilePath && (
            <span className="text-[10px] text-[var(--theme-text-muted)] font-mono hidden xl:inline" title={logFilePath}>
              (~/.0xagent/logs)
            </span>
          )}
        </div>

        {/* Console Action Buttons */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] select-none">
            <input
              type="checkbox"
              checked={serverLogsAutoScroll}
              onChange={(e) => setServerLogsAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span>Auto-scroll</span>
          </label>

          <button
            type="button"
            onClick={onCopyLogs}
            className="px-2 py-1 rounded-md bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-all cursor-pointer"
            title="Копировать все логи"
          >
            {isCopiedLogs ? <Check size={12} className="text-[var(--theme-text)]" /> : <Copy size={12} />}
            <span>{isCopiedLogs ? 'Скопировано!' : 'Копия'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadLogs}
            className="px-2 py-1 rounded-md bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-all cursor-pointer"
            title="Скачать файл логов"
          >
            <FileText size={12} />
            <span>Файл</span>
          </button>

          <button
            type="button"
            onClick={onClearLogs}
            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/15 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer transition-all border border-[var(--theme-border)]"
            title="Очистить экран логов"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={logsContainerRef} className="flex-1 p-3.5 font-mono text-[11px] bg-black/50 text-[var(--theme-text)] overflow-y-auto space-y-1 select-text scrollbar-thin rounded-b-xl leading-relaxed">
        {serverLogs.length > 0 ? (
          serverLogs.map((log, index) => {
            const isError = log.includes('[ERROR]') || log.includes('error') || log.includes('FAILED');
            const isCmd = log.includes('[CMD]');
            return (
              <div
                key={index}
                className={`break-all ${
                  isError
                    ? 'text-rose-300 font-semibold bg-rose-950/20 p-1 rounded border border-rose-500/20'
                    : isCmd
                    ? 'text-white font-semibold'
                    : 'text-[var(--theme-text)]/90'
                }`}
              >
                {log}
              </div>
            );
          })
        ) : (
          <div className="text-[var(--theme-text-muted)] italic p-4 text-center text-xs">
            Логи сервера будут автоматически сохранены и отображены в этом окне при запуске llama-server.exe.
          </div>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
