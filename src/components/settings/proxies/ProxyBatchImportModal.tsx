import React from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProxyProtocol } from '../../../types';

interface ProxyBatchImportModalProps {
  batchInput: string;
  setBatchInput: (val: string) => void;
  selectedProtocol: ProxyProtocol | '';
  setSelectedProtocol: (val: ProxyProtocol | '') => void;
  importMessage: { type: 'success' | 'error'; text: string } | null;
  onImport: () => void;
  onClose: () => void;
}

export const ProxyBatchImportModal: React.FC<ProxyBatchImportModalProps> = ({
  batchInput,
  setBatchInput,
  selectedProtocol,
  setSelectedProtocol,
  importMessage,
  onImport,
  onClose,
}) => {
  return (
    <Card className="p-4 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
          <Plus size={16} className="text-[var(--theme-accent)]" />
          Добавление прокси (пакетный импорт)
        </h3>
        <span className="text-xs text-[var(--theme-text-muted)] font-mono">
          Поддерживаются: ip:port, ip:port:user:pass, socks5://user:pass@ip:port
        </span>
      </div>

      <div className="space-y-2">
        <textarea
          rows={4}
          value={batchInput}
          onChange={(e) => setBatchInput(e.target.value)}
          placeholder={"192.168.1.100:1080\nsocks5://admin:secret@10.0.0.1:9050\n185.220.101.5:8080:user:password"}
          className="w-full p-3 text-xs font-mono bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--theme-text-muted)]">Принудительный протокол:</span>
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value as any)}
            className="px-2 py-1 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text)] focus:outline-none"
          >
            <option value="">Автоопределение</option>
            <option value="socks5">SOCKS5</option>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" size="xs" onClick={onImport} disabled={!batchInput.trim()}>
            Импортировать
          </Button>
        </div>
      </div>

      {importMessage && (
        <div
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
            importMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {importMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{importMessage.text}</span>
        </div>
      )}
    </Card>
  );
};
