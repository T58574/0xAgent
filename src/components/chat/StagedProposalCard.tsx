import React, { useState } from 'react';
import { StagedProposal } from '../../types';
import * as api from '../../services/api';
import { MaterialIcon } from '../common/MaterialIcon';

interface StagedProposalCardProps {
  proposal: StagedProposal;
  onApplied?: () => void;
}

export const StagedProposalCard: React.FC<StagedProposalCardProps> = ({ proposal: initialProposal, onApplied }) => {
  const [proposal, setProposal] = useState<StagedProposal>(initialProposal);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    setMessage(null);
    try {
      const res = await api.verify_proposal(proposal.id);
      if (res.proposal) {
        setProposal(res.proposal);
        setMessage(res.proposal.verificationResult?.passed ? '[OK] Проверка TypeScript и сборки успешно пройдена!' : '[ERR] Обнаружены ошибки типизации при проверке');
      }
    } catch (err: any) {
      setMessage(`[ERR] Ошибка проверки: ${err?.message || err}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    setMessage(null);
    try {
      const res = await api.apply_proposal(proposal.id);
      if (res.success) {
        setProposal((prev) => ({ ...prev, status: 'applied' }));
        setMessage(res.message);
        onApplied?.();
      }
    } catch (err: any) {
      setMessage(`[ERR] Ошибка применения: ${err?.message || err}`);
    } finally {
      setIsApplying(false);
    }
  };

  const statusColor =
    proposal.status === 'applied'
      ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
      : proposal.status === 'verified'
      ? 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30'
      : proposal.status === 'failed'
      ? 'text-rose-400 bg-rose-950/40 border-rose-500/30'
      : 'text-amber-400 bg-amber-950/40 border-amber-500/30';

  const statusLabel =
    proposal.status === 'applied'
      ? '[APPLIED]'
      : proposal.status === 'verified'
      ? '[VERIFIED]'
      : proposal.status === 'failed'
      ? '[FAILED]'
      : '[PENDING REVIEW]';

  return (
    <div className="w-full my-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] shadow-md overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--theme-panel)]/80 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-2">
          <MaterialIcon name="call_merge" className="text-[var(--theme-accent)] text-sm" />
          <span className="font-bold text-[var(--theme-text)]">PULL REQUEST :: {proposal.id}</span>
          <span className={`px-2 py-0.5 rounded-md border text-[10px] ${statusColor}`}>{statusLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors p-1"
        >
          <MaterialIcon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-sm" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <div className="font-bold text-sm text-[var(--theme-text)] mb-1">{proposal.title}</div>
          {proposal.description && (
            <p className="text-[var(--theme-text-muted)] text-[11px] leading-relaxed">{proposal.description}</p>
          )}
        </div>

        {/* Files list */}
        <div className="space-y-1 bg-[var(--theme-panel)]/50 rounded-xl p-2.5 border border-[var(--theme-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--theme-text-muted)] mb-1">
            Изменяемые файлы ({proposal.files.length}):
          </div>
          {proposal.files.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] text-[var(--theme-text)]">
              <span className="truncate">{f.path}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded ${
                  f.changeType === 'created'
                    ? 'text-emerald-400 bg-emerald-950/40'
                    : f.changeType === 'deleted'
                    ? 'text-rose-400 bg-rose-950/40'
                    : 'text-amber-400 bg-amber-950/40'
                }`}
              >
                {f.changeType === 'created' ? '[+] new' : f.changeType === 'deleted' ? '[-] del' : '[~] edit'}
              </span>
            </div>
          ))}
        </div>

        {/* Verification Report */}
        {proposal.verificationResult && (
          <div
            className={`p-2.5 rounded-xl border text-[11px] ${
              proposal.verificationResult.passed
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="font-bold mb-1">
              {proposal.verificationResult.passed ? '[OK] Проверка сборки пройдена' : '[ERR] Ошибки при проверке'}
            </div>
            {proposal.verificationResult.typecheckOutput && (
              <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap max-h-32 opacity-80">
                {proposal.verificationResult.typecheckOutput}
              </pre>
            )}
          </div>
        )}

        {message && (
          <div className="text-[11px] text-[var(--theme-accent)] px-1">{message}</div>
        )}

        {/* Action Controls */}
        {proposal.status !== 'applied' && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying || isApplying}
              className="px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <MaterialIcon name="verified" className="text-xs" />
              <span>{isVerifying ? 'Проверка...' : 'Проверить (tsc)'}</span>
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isVerifying || isApplying}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-accent)] text-black font-bold hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-[var(--theme-accent)]/20"
            >
              <MaterialIcon name="publish" className="text-xs" />
              <span>{isApplying ? 'Применение...' : 'Применить изменения'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
