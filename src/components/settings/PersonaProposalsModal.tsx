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
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
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
  const [tab, setTab] = useState<'proposals' | 'history' | 'benchmark'>('proposals');

  // Proposals state
  const [proposals, setProposals] = useState<PersonaChangeProposalRecord[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<PersonaChangeProposalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<PersonaFileVersionRecord[]>([]);
  const [selectedFileFilter, setSelectedFileFilter] = useState<'ALL' | 'SOUL.md' | 'TOOLS.md' | 'USER.md'>('ALL');

  // Benchmark state
  const [benchmarkResult, setBenchmarkResult] = useState<any | null>(null);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);

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
      const fileArg = selectedFileFilter === 'ALL' ? undefined : selectedFileFilter;
      const list = await get_persona_history(persona.id, fileArg);
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
      showToast('Предложение утверждено', 'success');
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
      await apply_persona_proposal(persona.id, id);
      showToast('Изменения успешно применены к личности', 'success');
      loadProposals();
      loadHistory();
      if (onPersonaUpdated) onPersonaUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to apply', 'error');
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
      title={`${persona.name} — Evolution & Proposals Studio`}
      maxWidth="xl"
    >
      <div className="flex flex-col gap-4">
        {/* Sub-tab Navigation */}
        <div className="flex gap-2 border-b border-border pb-2">
          <Button
            variant={tab === 'proposals' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab('proposals')}
            className="flex items-center gap-1.5"
          >
            <GitPullRequest className="w-4 h-4" />
            <span>Proposals ({proposals.filter((p) => p.status === 'pending').length} pending)</span>
          </Button>
          <Button
            variant={tab === 'history' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab('history')}
            className="flex items-center gap-1.5"
          >
            <History className="w-4 h-4" />
            <span>Version History</span>
          </Button>
          <Button
            variant={tab === 'benchmark' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab('benchmark')}
            className="flex items-center gap-1.5"
          >
            <Activity className="w-4 h-4" />
            <span>Evaluation Benchmark</span>
          </Button>
        </div>

        {/* Tab 1: Proposals */}
        {tab === 'proposals' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[360px]">
            {/* List */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px] pr-1">
              {isLoading ? (
                <div className="text-xs text-muted-foreground p-4 text-center">
                  Loading proposals...
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-xs text-muted-foreground p-4 text-center">
                  No persona evolution proposals recorded yet.
                </div>
              ) : (
                proposals.map((p) => (
                  <Card
                    key={p.id}
                    className={`p-2.5 cursor-pointer transition-all ${
                      selectedProposal?.id === p.id ? 'border-primary bg-primary/5' : 'hover:border-border/80'
                    }`}
                    onClick={() => setSelectedProposal(p)}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-xs font-semibold">{p.target_file}</span>
                      {getRiskBadge(p.risk_level)}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mb-1">
                      {p.operation.toUpperCase()}: {p.target_section || 'Root'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-mono">ID: {p.id.slice(0, 8)}</span>
                      <span className={`font-semibold capitalize ${
                        p.status === 'applied' ? 'text-green-400' :
                        p.status === 'approved' ? 'text-blue-400' :
                        p.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Proposal Details & Diff */}
            <div className="md:col-span-2 flex flex-col gap-3 border border-border rounded-xl p-3 bg-secondary/10">
              {selectedProposal ? (
                <>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <div className="font-mono text-xs font-bold text-foreground">
                        {selectedProposal.target_file} ({selectedProposal.operation})
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Rationale: {selectedProposal.rationale || 'Autonomous self-improvement proposal'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRiskBadge(selectedProposal.risk_level)}
                    </div>
                  </div>

                  {/* Patch Content Preview */}
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                      Patch Content:
                    </div>
                    <pre className="p-2.5 rounded-lg bg-black/40 border border-border text-xs font-mono whitespace-pre-wrap max-h-[220px] overflow-y-auto text-emerald-300">
                      {selectedProposal.patch_payload?.content || JSON.stringify(selectedProposal.patch_payload, null, 2)}
                    </pre>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">
                      Source: {selectedProposal.source_type} ({new Date(selectedProposal.created_at).toLocaleTimeString()})
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedProposal.status === 'pending' && (
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleReject(selectedProposal.id)}
                            className="flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApprove(selectedProposal.id)}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </Button>
                        </>
                      )}
                      {selectedProposal.status === 'approved' && (
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => handleApply(selectedProposal.id)}
                          className="flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply to Persona</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  Select a proposal to inspect diff and action flow.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Version History & Rollback */}
        {tab === 'history' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Immutable snapshots recorded whenever files are updated or proposals applied.
              </span>
              <div className="flex gap-1">
                {(['ALL', 'SOUL.md', 'TOOLS.md', 'USER.md'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={selectedFileFilter === f ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedFileFilter(f)}
                    className="text-xs"
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="text-xs text-muted-foreground p-4 text-center">
                  No snapshot versions recorded yet.
                </div>
              ) : (
                history.map((ver) => (
                  <Card key={ver.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{ver.file}</span>
                        <Badge variant="neutral" className="text-[10px] font-mono">
                          {ver.id}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          by {ver.created_by}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate max-w-md">
                        SHA256: {ver.content_sha256}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ver.created_at).toLocaleString()}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRollback(ver.file, ver.id)}
                        className="flex items-center gap-1 text-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rollback</span>
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
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Continuous Persona & Safety Benchmark</div>
                <div className="text-xs text-muted-foreground">
                  Validates language directives, memory retrieval zero-budget invariants, and protected safety defense.
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRunBenchmark}
                disabled={isBenchmarkRunning}
                className="flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>{isBenchmarkRunning ? 'Evaluating...' : 'Run Benchmark'}</span>
              </Button>
            </div>

            {benchmarkResult && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="text-sm font-semibold">Overall Compliance Score:</span>
                  </div>
                  <Badge variant={benchmarkResult.overallScore >= 80 ? 'success' : 'warning'} className="text-sm font-mono px-3 py-1">
                    {benchmarkResult.overallScore}% ({benchmarkResult.passedTasks}/{benchmarkResult.totalTasks} passed)
                  </Badge>
                </div>

                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto">
                  {benchmarkResult.items?.map((item: any) => (
                    <div
                      key={item.taskId}
                      className="p-2.5 rounded-lg border border-border bg-black/20 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${item.passed ? 'text-green-400' : 'text-red-400'}`}>
                            {item.passed ? '[PASS]' : '[FAIL]'}
                          </span>
                          <span className="text-xs font-medium text-foreground">{item.name}</span>
                          <Badge variant="neutral" className="text-[10px] uppercase">
                            {item.category}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{item.details}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">
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
