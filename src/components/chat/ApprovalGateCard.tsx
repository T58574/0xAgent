import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldX, Check, X, FileCode, AlertTriangle, Key, Hash } from 'lucide-react';
import { RequestApprovalPayload, ToolCallInfo } from '../../types';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';

interface ApprovalGateCardProps {
  tool: ToolCallInfo;
  onResolved?: (status: 'approved' | 'rejected') => void;
  showToast?: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
}

export const ApprovalGateCard: React.FC<ApprovalGateCardProps> = ({
  tool,
  onResolved,
  showToast,
}) => {
  const { language } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overrideText, setOverrideText] = useState('');

  let payload: RequestApprovalPayload = {
    action_type: 'execute_command',
    target_artifacts: [],
    risk_level: 'high',
    preview_summary: 'Destructive confirmation requested',
  };

  try {
    const parsed = typeof tool.arguments === 'string' ? JSON.parse(tool.arguments) : tool.arguments;
    if (parsed) {
      payload = {
        action_type: parsed.action_type || 'execute_command',
        target_artifacts: Array.isArray(parsed.target_artifacts)
          ? parsed.target_artifacts
          : (typeof parsed.target_artifacts === 'string' ? [parsed.target_artifacts] : []),
        risk_level: parsed.risk_level || 'high',
        preview_summary: parsed.preview_summary || parsed.summary || 'Confirmation required',
        content_to_verify: parsed.content_to_verify || parsed.content || parsed.command || '',
        content_hash: parsed.content_hash,
        nonce: parsed.nonce,
        allow_override: Boolean(parsed.allow_override),
      };
    }
  } catch {}

  const isPending = tool.status === 'pending';
  const isApproved = tool.status === 'completed' || (tool.output && tool.output.includes('"status": "approved"'));
  const isRejected = tool.status === 'error' || (tool.output && tool.output.includes('"status": "rejected"'));

  const handleRespond = async (approve: boolean) => {
    if (!isPending || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const ticketId = payload.nonce || tool.id;
      const res = await api.respond_to_approval(ticketId, approve, overrideText || undefined);
      if (res.status === 'approved') {
        showToast?.(language === 'ru' ? 'Действие подтверждено' : 'Action approved', 'success');
        onResolved?.('approved');
      } else if (res.status === 'rejected') {
        showToast?.(language === 'ru' ? 'Действие отклонено' : 'Action rejected', 'info');
        onResolved?.('rejected');
      } else {
        showToast?.(res.reason || (language === 'ru' ? 'Истек срок подтверждения' : 'Approval expired'), 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Error resolving approval', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle size={11} /> CRITICAL RISK
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle size={11} /> HIGH RISK
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            MEDIUM RISK
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            LOW RISK
          </span>
        );
    }
  };

  return (
    <div className="w-full rounded-2xl bento-card border border-[var(--theme-border)] bg-[var(--theme-panel)] p-3.5 space-y-3 font-sans shadow-lg select-text animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--theme-border)]/60 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-[var(--theme-card-bg)] border border-[var(--theme-border)] shrink-0">
            {isApproved ? (
              <ShieldCheck size={16} className="text-emerald-400" />
            ) : isRejected ? (
              <ShieldX size={16} className="text-rose-400" />
            ) : (
              <ShieldAlert size={16} className="text-amber-400 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--theme-text)]">
                {language === 'ru' ? 'Tier-2 Approval Gate' : 'Tier-2 Approval Gate'}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                {payload.action_type}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
              {isPending
                ? (language === 'ru' ? 'Ожидается подтверждение пользователя' : 'Awaiting explicit confirmation')
                : isApproved
                ? (language === 'ru' ? 'Подтверждено пользователем' : 'Confirmed by user')
                : (language === 'ru' ? 'Отклонено' : 'Rejected')}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          {getRiskBadge(payload.risk_level)}
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1.5 text-xs text-[var(--theme-text)]">
        <div className="font-semibold text-xs leading-relaxed">
          {payload.preview_summary}
        </div>

        {/* Target artifacts */}
        {payload.target_artifacts.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] text-[var(--theme-text-muted)]">
              {language === 'ru' ? 'Цели:' : 'Targets:'}
            </span>
            {payload.target_artifacts.map((target, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-text)]"
              >
                <FileCode size={11} className="text-[var(--theme-text-muted)]" />
                {target}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Code / Command Preview */}
      {payload.content_to_verify && (
        <div className="rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] p-2.5 font-mono text-[11.5px] leading-relaxed max-h-48 overflow-y-auto scrollbar-thin text-[var(--theme-text)] whitespace-pre-wrap select-text">
          {payload.content_to_verify}
        </div>
      )}

      {/* Security Telemetry (Nonce & Hash) */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--theme-text-muted)] pt-0.5 border-t border-[var(--theme-border)]/40">
        {payload.nonce && (
          <span className="inline-flex items-center gap-1">
            <Key size={10} className="opacity-60" />
            <span>NONCE: {payload.nonce.substring(0, 8)}...</span>
          </span>
        )}
        {payload.content_hash && (
          <span className="inline-flex items-center gap-1">
            <Hash size={10} className="opacity-60" />
            <span>SHA256: {payload.content_hash.substring(0, 10)}...</span>
          </span>
        )}
      </div>

      {/* Override Input (if allowed) */}
      {isPending && payload.allow_override && (
        <div className="pt-1">
          <input
            type="text"
            value={overrideText}
            onChange={(e) => setOverrideText(e.target.value)}
            placeholder={language === 'ru' ? 'Дополнительные указания / комментарий (опционально)' : 'Override instructions (optional)'}
            className="w-full px-3 py-1.5 text-xs bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] outline-none focus:border-[var(--theme-accent)] transition-colors"
          />
        </div>
      )}

      {/* Action Buttons */}
      {isPending ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleRespond(false)}
            className="px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <X size={13} />
            <span>{language === 'ru' ? 'Отклонить' : 'Reject'}</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleRespond(true)}
            className="px-4 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Check size={13} />
            <span>{language === 'ru' ? 'Подтвердить и выполнить' : 'Approve & Execute'}</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end text-[11px] font-mono font-bold">
          {isApproved ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check size={12} /> [APPROVED]
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1">
              <X size={12} /> [REJECTED]
            </span>
          )}
        </div>
      )}
    </div>
  );
};
