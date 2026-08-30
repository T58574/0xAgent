import React from 'react';
import { Terminal, Check, Copy, FileText, Trash2 } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';

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
  const { t } = useI18n();

  return (
    <div className="bento-card border border-[var(--theme-border)] rounded-2xl overflow-hidden flex flex-col h-[680px] max-h-[calc(100vh-140px)] shadow-2xl font-sans bg-[var(--theme-panel)]">
      {/* Terminal Header Bar */}
      <div className="px-4 py-3 border-b border-[var(--theme-border)] flex flex-wrap items-center justify-between gap-2 select-none bg-[var(--theme-card-bg)]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[var(--theme-border-subtle)] border border-[var(--theme-border)]">
            <Terminal size={14} className="text-[var(--theme-text)]" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-2">
              <span>{t.settings.localServer.logs.title}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            {logFilePath && (
              <div
                className="text-[10px] text-[var(--theme-text-muted)] font-mono truncate max-w-[200px]"
                title={logFilePath}
              >
                ~/.0xagent/logs
              </div>
            )}
          </div>
        </div>

        {/* Console Action Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <Toggle
            checked={serverLogsAutoScroll}
            onChange={(val) => setServerLogsAutoScroll(val)}
            label={t.settings.localServer.logs.autoScroll}
            size="sm"
            className="mr-1"
          />

          <Button
            variant="secondary"
            size="xs"
            onClick={onCopyLogs}
            icon={isCopiedLogs ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            title="Copy logs"
          >
            {isCopiedLogs ? t.settings.localServer.logs.copied : t.settings.localServer.logs.copy}
          </Button>

          <Button
            variant="secondary"
            size="xs"
            onClick={onDownloadLogs}
            icon={<FileText size={12} />}
            title="Download log file"
          >
            {t.settings.localServer.logs.file}
          </Button>

          <Button
            variant="danger"
            size="xs"
            onClick={onClearLogs}
            icon={<Trash2 size={12} />}
            title="Clear console logs"
          >
            {t.settings.localServer.logs.clear}
          </Button>
        </div>
      </div>

      {/* Terminal Body with Pure Dark Contrast CLI Surface */}
      <div
        ref={logsContainerRef}
        className="flex-1 p-4 font-mono text-[11.5px] bg-[#09090b] text-[#f4f4f5] overflow-y-auto space-y-1 select-text scrollbar-thin rounded-b-2xl leading-relaxed border-t border-[var(--theme-border)]"
      >
        {serverLogs.length > 0 ? (
          serverLogs.map((log, index) => {
            const isError =
              log.includes('[ERROR]') ||
              log.includes('error') ||
              log.includes('FAILED') ||
              log.includes('exiting due to');
            const isWarning = log.includes('[WARNING]') || log.includes('[WATCHDOG]');
            const isDiagnostic = log.includes('[FASTMTP') || log.includes('[CMD]');
            const isSuccess =
              log.includes('HTTP server listening') ||
              log.includes('model loaded') ||
              log.includes('all slots are idle');

            return (
              <div
                key={index}
                className={`break-all py-0.5 px-1.5 rounded ${
                  isError
                    ? 'text-rose-300 font-medium bg-rose-950/40 border-l-2 border-rose-500'
                    : isWarning
                    ? 'text-amber-300 bg-amber-950/30 border-l-2 border-amber-500'
                    : isDiagnostic
                    ? 'text-sky-300 font-semibold bg-sky-950/30 border-l-2 border-sky-400'
                    : isSuccess
                    ? 'text-emerald-300 bg-emerald-950/30'
                    : 'text-[#e4e4e7]'
                }`}
              >
                {log}
              </div>
            );
          })
        ) : (
          <div className="text-zinc-400 italic p-6 text-center text-xs flex flex-col items-center justify-center h-full gap-2 select-none">
            <Terminal size={24} className="opacity-30 mb-1" />
            <span>{t.settings.localServer.logs.emptyLogs}</span>
          </div>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
