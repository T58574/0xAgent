import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  CheckCircle,
  XCircle,
  RotateCcw,
  Shield,
  Activity,
  History,
  Check,
  Play,
  Sparkles,
  Info,
} from 'lucide-react';
import { PersonaMetadata, PersonaChangeProposalRecord, PersonaFileVersionRecord } from '../../types';
import {
  get_persona_proposals,
  approve_persona_proposal,
  reject_persona_proposal,
  apply_persona_proposal,
  get_persona_history,
  rollback_persona_file,
  get_eval_benchmark,
  trigger_memory_decay_cycle,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useI18n } from '../../i18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface PersonaProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaMetadata;
  onPersonaUpdated?: () => void;
}

export const PersonaProposalsModal: React.FC<PersonaProposalsModalProps> = ({
  isOpen,
  onClose,
  persona,
  onPersonaUpdated,
}) => {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [tab, setTab] = useState<'proposals' | 'history' | 'benchmark'>('proposals');

  // Proposals state
  const [proposals, setProposals] = useState<PersonaChangeProposalRecord[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<PersonaChangeProposalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forceOverride, setForceOverride] = useState(false);

  // History state
  const [history, setHistory] = useState<PersonaFileVersionRecord[]>([]);
  const [selectedFileFilter, setSelectedFileFilter] = useState<'ALL' | 'SOUL.md' | 'TOOLS.md' | 'USER.md'>('ALL');

  // Benchmark state
  const [benchmarkResult, setBenchmarkResult] = useState<any | null>(null);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);
  const [isDecayRunning, setIsDecayRunning] = useState(false);

  const loadProposals = async () => {
    setIsLoading(true);
    try {
      const list = await get_persona_proposals(persona.id);
      setProposals(list);
      if (list.length > 0 && !selectedProposal) {
        setSelectedProposal(list[0]);
      }
    } catch (err) {
      console.error('Failed to load proposals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const file = selectedFileFilter === 'ALL' ? undefined : selectedFileFilter;
      const list = await get_persona_history(persona.id, file);
      setHistory(list);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProposals();
      loadHistory();
    }
  }, [isOpen, persona.id, selectedFileFilter]);

  const handleApprove = async (id: string) => {
    try {
      await approve_persona_proposal(persona.id, id);
      showToast(t.settings.personas.saved || 'Предложение утверждено', 'success');
      loadProposals();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve', 'error');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await reject_persona_proposal(persona.id, id, 'Rejected via Studio');
      showToast('Предложение отклонено', 'info');
      loadProposals();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject', 'error');
    }
  };

  const handleApply = async (id: string) => {
    try {
      const res = await apply_persona_proposal(persona.id, id, forceOverride);
      if (res.blocked) {
        showToast(res.error || 'Pre-Apply Regression Guard заблокировал применение', 'error');
      } else {
        showToast('Изменения успешно применены к личности', 'success');
        loadProposals();
        loadHistory();
        if (onPersonaUpdated) onPersonaUpdated();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to apply', 'error');
    }
  };

  const handleTriggerDecay = async () => {
    setIsDecayRunning(true);
    try {
      const stats = await trigger_memory_decay_cycle();
      showToast(`Цикл гигиены выполнен: архивировано ${stats.archived_count}, разрешено конфликтов ${stats.conflicts_resolved}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Ошибка запуска цикла гигиены', 'error');
    } finally {
      setIsDecayRunning(false);
    }
  };

  const handleRollback = async (file: string, versionId: string) => {
    try {
      await rollback_persona_file(persona.id, file, versionId);
      showToast(`Откат файла ${file} к версии ${versionId} выполнен`, 'success');
      loadHistory();
      if (onPersonaUpdated) onPersonaUpdated();
    } catch (err: any) {
      showToast(err.message || 'Rollback failed', 'error');
    }
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarkRunning(true);
    try {
      const res = await get_eval_benchmark();
      setBenchmarkResult(res);
      showToast(`Бенчмарк завершен: Оценка ${res.overallScore}%`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Benchmark error', 'error');
    } finally {
      setIsBenchmarkRunning(false);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'critical':
        return <Badge variant="danger">CRITICAL</Badge>;
      case 'high':
        return <Badge variant="warning">HIGH RISK</Badge>;
      case 'medium':
        return <Badge variant="neutral">MEDIUM</Badge>;
      default:
        return <Badge variant="success">LOW RISK</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${persona.name} — ${t.settings.personas.evolutionTitle}`}
      maxWidth="xl"
    >
      <div className="flex flex-col gap-4 text-[var(--theme-text)] font-sans">
        {/* Informative Studio Intro Banner */}
        <div className="p-3.5 rounded-2xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] flex items-start gap-3 text-xs leading-relaxed">
          <Sparkles size={16} className="text-[var(--theme-accent)] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-[var(--theme-text)]">
              {t.settings.personas.evolutionTitle}
            </div>
            <p className="text-[11.5px] text-[var(--theme-text-muted)]">
              {t.settings.personas.evolutionIntro}
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex gap-1.5 border-b border-[var(--theme-border)] pb-2 flex-wrap">
          <button
            type="button"
            onClick={() => setTab('proposals')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              tab === 'proposals'
                ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs font-bold ring-1 ring-[var(--theme-accent)]/30'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
            <span>{t.settings.personas.evolutionTabProposals}</span>
            <Badge variant="neutral" size="xs">
              {proposals.filter((p) => p.status === 'pending').length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              tab === 'history'
                ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs font-bold ring-1 ring-[var(--theme-accent)]/30'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t.settings.personas.evolutionTabHistory}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('benchmark')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              tab === 'benchmark'
                ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs font-bold ring-1 ring-[var(--theme-accent)]/30'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.settings.personas.evolutionTabBenchmark}</span>
          </button>
        </div>

        {/* Tab 1: Proposals */}
        {tab === 'proposals' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--theme-text-muted)] px-1">
              {t.settings.personas.evolutionProposalsDesc}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[340px]">
              {/* List */}
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px] pr-1">
                {isLoading ? (
                  <div className="text-xs text-[var(--theme-text-muted)] p-4 text-center">
                    Загрузка предложений...
                  </div>
                ) : proposals.length === 0 ? (
                  <Card className="text-xs text-[var(--theme-text-muted)] p-6 text-center rounded-2xl">
                    <Info size={16} className="mx-auto mb-1.5 text-[var(--theme-text-muted)] opacity-60" />
                    Предложений по эволюции персоны пока нет.
                  </Card>
                ) : (
                  proposals.map((p) => (
                    <Card
                      key={p.id}
                      variant="interactive"
                      selected={selectedProposal?.id === p.id}
                      className="p-3 cursor-pointer transition-all rounded-xl"
                      onClick={() => setSelectedProposal(p)}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-xs font-semibold text-[var(--theme-text)]">{p.target_file}</span>
                        {getRiskBadge(p.risk_level)}
                      </div>
                      <div className="text-[11px] text-[var(--theme-text-muted)] truncate mb-1">
                        {p.operation.toUpperCase()}: {p.target_section || 'Root'}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--theme-text-muted)]">
                        <span className="font-mono">ID: {p.id.slice(0, 8)}</span>
                        <span className={`font-semibold capitalize ${
                          p.status === 'applied' ? 'text-emerald-400' :
                          p.status === 'approved' ? 'text-sky-400' :
                          p.status === 'rejected' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Proposal Details & Diff */}
              <div className="md:col-span-2 flex flex-col gap-3 border border-[var(--theme-border)] rounded-2xl p-4 bg-[var(--theme-card-bg)]">
                {selectedProposal ? (
                  <>
                    <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
                      <div>
                        <div className="font-mono text-xs font-bold text-[var(--theme-text)]">
                          {selectedProposal.target_file} ({selectedProposal.operation})
                        </div>
                        <div className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
                          {selectedProposal.rationale || 'Автономное предложение по улучшению личности'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRiskBadge(selectedProposal.risk_level)}
                      </div>
                    </div>

                    {/* Patch Content Preview */}
                    <div className="flex-1 space-y-1">
                      <div className="text-[11px] font-semibold text-[var(--theme-text-muted)]">
                        Содержимое патча:
                      </div>
                      <pre className="p-3 rounded-xl bg-[var(--theme-code-bg)] border border-[var(--theme-border)] text-xs font-mono whitespace-pre-wrap max-h-[220px] overflow-y-auto text-[var(--theme-code-text)] select-text leading-relaxed">
                        {selectedProposal.patch_payload?.content || JSON.stringify(selectedProposal.patch_payload, null, 2)}
                      </pre>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-[var(--theme-border)]">
                      <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                        {selectedProposal.source_type} ({new Date(selectedProposal.created_at).toLocaleTimeString()})
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedProposal.status === 'pending' && (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReject(selectedProposal.id)}
                              icon={<XCircle size={13} />}
                            >
                              Отклонить
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleApprove(selectedProposal.id)}
                              icon={<CheckCircle size={13} />}
                            >
                              Утвердить
                            </Button>
                          </>
                        )}
                        {selectedProposal.status === 'approved' && (
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[11px] text-[var(--theme-text-muted)] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={forceOverride}
                                onChange={(e) => setForceOverride(e.target.checked)}
                                className="rounded border-[var(--theme-border)]"
                              />
                              <span>Force Override Guard</span>
                            </label>
                            <Button
                              variant="accent"
                              size="sm"
                              onClick={() => handleApply(selectedProposal.id)}
                              icon={<Check size={13} />}
                            >
                              Применить к персоне
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-xs text-[var(--theme-text-muted)] p-8 text-center space-y-1">
                    <GitPullRequest size={20} className="opacity-40 mb-1" />
                    <span>Выберите предложение слева для просмотра diff и утверждения</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Version History & Rollback */}
        {tab === 'history' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-[var(--theme-text-muted)]">
                {t.settings.personas.evolutionHistoryDesc}
              </span>
              <div className="flex gap-1">
                {(['ALL', 'SOUL.md', 'TOOLS.md', 'USER.md'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={selectedFileFilter === f ? 'secondary' : 'ghost'}
                    size="xs"
                    onClick={() => setSelectedFileFilter(f)}
                    className="text-xs"
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
              {history.length === 0 ? (
                <Card className="text-xs text-[var(--theme-text-muted)] p-6 text-center rounded-2xl">
                  Слепки версий пока не записаны.
                </Card>
              ) : (
                history.map((ver) => (
                  <Card key={ver.id} className="p-3 flex items-center justify-between gap-3 rounded-xl">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[var(--theme-text)]">{ver.file}</span>
                        <Badge variant="neutral" size="xs">
                          {ver.id}
                        </Badge>
                        <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                          {ver.created_by}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-[var(--theme-text-muted)] truncate">
                        SHA256: {ver.content_sha256}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                        {new Date(ver.created_at).toLocaleString()}
                      </span>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => handleRollback(ver.file, ver.id)}
                        icon={<RotateCcw size={12} />}
                      >
                        Откатить
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Evaluation Benchmark */}
        {tab === 'benchmark' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3 flex-wrap gap-2">
              <div>
                <div className="text-xs font-bold text-[var(--theme-text)]">Бенчмарк безопасности и гигиена памяти</div>
                <div className="text-[11.5px] text-[var(--theme-text-muted)] mt-0.5">
                  {t.settings.personas.evolutionBenchmarkDesc}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTriggerDecay}
                  disabled={isDecayRunning}
                  loading={isDecayRunning}
                  icon={<RotateCcw size={13} />}
                >
                  {t.settings.personas.runHygieneBtn}
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarkRunning}
                  loading={isBenchmarkRunning}
                  icon={<Play size={13} />}
                >
                  {t.settings.personas.runBenchmarkBtn}
                </Button>
              </div>
            </div>

            {benchmarkResult && (
              <div className="flex flex-col gap-3 animate-fadeIn">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)]">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-[var(--theme-accent)]" />
                    <span className="text-xs font-bold">Итоговый скор соответствия безопасности:</span>
                  </div>
                  <Badge variant={benchmarkResult.overallScore >= 80 ? 'success' : 'warning'} size="sm" className="font-mono font-bold">
                    {benchmarkResult.overallScore}% ({benchmarkResult.passedTasks}/{benchmarkResult.totalTasks} пройдено)
                  </Badge>
                </div>

                <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                  {benchmarkResult.items?.map((item: any) => (
                    <div
                      key={item.taskId}
                      className="p-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold font-mono ${item.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.passed ? '[PASS]' : '[FAIL]'}
                          </span>
                          <span className="text-xs font-semibold text-[var(--theme-text)]">{item.name}</span>
                          <Badge variant="neutral" size="xs">
                            {item.category}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-[var(--theme-text-muted)] line-clamp-1">{item.details}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--theme-text-muted)] shrink-0">
                        {Math.round(item.score * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
