import React from 'react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import { RefreshCw, Trash2 } from 'lucide-react';
import { ProxyItem } from '../../../types';

interface ProxyRowProps {
  proxy: ProxyItem;
  isChecking: boolean;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, currentActive: boolean) => void;
}

export const ProxyRow: React.FC<ProxyRowProps> = ({
  proxy: p,
  isChecking,
  onCheck,
  onDelete,
  onToggle,
}) => {
  const statusColor =
    p.status === 'online'
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : p.status === 'offline'
      ? 'text-red-400 border-red-500/30 bg-red-500/10'
      : p.status === 'checking'
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-[var(--theme-text-muted)] border-[var(--theme-border)] bg-[var(--theme-border-subtle)]';

  return (
    <div
      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        p.is_active
          ? 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] shadow-xs'
          : 'bg-[var(--theme-panel)]/50 border-[var(--theme-border)] opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="neutral" className="uppercase font-mono text-[10px] px-2 py-0.5">
          {p.protocol}
        </Badge>

        <div className="min-w-0">
          <div className="text-xs font-mono font-bold text-[var(--theme-text)] truncate flex items-center gap-2">
            <span>{p.host}:{p.port}</span>
            {p.auth?.username && (
              <span className="text-[10px] font-sans font-normal text-[var(--theme-text-muted)] bg-[var(--theme-border-subtle)] px-1.5 py-0.2 rounded">
                auth: {p.auth.username}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--theme-text-muted)] flex items-center gap-2 mt-0.5">
            {p.latency_ms !== null && p.latency_ms !== undefined && (
              <span className="font-mono text-emerald-400 font-semibold">{p.latency_ms} мс</span>
            )}
            {p.last_checked_at && (
              <span>
                проверен: {new Date(p.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {p.tag && <span className="text-[10px] text-indigo-400 font-medium">#{p.tag}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <div className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1.5 ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-emerald-400 animate-pulse' : p.status === 'offline' ? 'bg-red-400' : 'bg-amber-400'}`} />
          <span className="capitalize">{p.status}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onCheck(p.id)}
            disabled={isChecking}
            title="Проверить доступность"
            icon={<RefreshCw size={13} className={isChecking ? 'animate-spin text-amber-400' : ''} />}
          />
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onDelete(p.id)}
            title="Удалить прокси"
            icon={<Trash2 size={13} className="text-red-400 hover:text-red-300" />}
          />
        </div>

        <div className="pl-2 border-l border-[var(--theme-border)]" title={p.is_active ? 'Активен' : 'Отключен'}>
          <Toggle
            checked={p.is_active}
            onChange={() => onToggle(p.id, p.is_active)}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
};
