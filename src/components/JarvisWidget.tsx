import React, { useState } from 'react';
import { JarvisState, JarvisSparkProposal } from '../types';
import { MaterialIcon } from './common/MaterialIcon';

interface JarvisWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  jarvisState: JarvisState | null;
  onRefresh: () => void;
  onAcceptSpark?: (spark: JarvisSparkProposal) => void;
  onDismissSpark?: (sparkId: string) => void;
}

export const JarvisWidget: React.FC<JarvisWidgetProps> = ({
  isOpen,
  onClose,
  jarvisState,
  onAcceptSpark,
  onDismissSpark,
}) => {
  const [activeTab, setActiveTab] = useState<'sparks' | 'workers' | 'activity'>('sparks');

  if (!isOpen) return null;

  const sparks = jarvisState?.activeSparks || [];
  const pendingSparks = sparks.filter((s) => s.status === 'pending');
  const workers = jarvisState?.activeWorkers || [];
  const activities = jarvisState?.recentActivities || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[var(--theme-panel)]/95 border border-[var(--theme-border)] rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--theme-border)]/60 bg-[var(--theme-sidebar)]/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <MaterialIcon name="smart_toy" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-wider text-[var(--theme-text)]">
                  JARVIS :: TELEMETRY & WORKSPACE
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  [ONLINE]
                </span>
              </div>
              <p className="text-[11px] text-[var(--theme-text-muted)] font-mono">
                Autonomous workshop supervisor & proactivity engine
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer"
          >
            <MaterialIcon name="close" size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-[var(--theme-border)]/40 bg-[var(--theme-panel)]/40">
          <button
            type="button"
            onClick={() => setActiveTab('sparks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'sparks'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
            }`}
          >
            <MaterialIcon name="bolt" size={14} />
            <span>Sparks</span>
            {pendingSparks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                {pendingSparks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'workers'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
            }`}
          >
            <MaterialIcon name="memory" size={14} />
            <span>Workers ({workers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
            }`}
          >
            <MaterialIcon name="schedule" size={14} />
            <span>Log ({activities.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {/* 1. Sparks Tab */}
          {activeTab === 'sparks' && (
            <div className="space-y-3">
              {pendingSparks.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-[var(--theme-text-muted)] space-y-2">
                  <MaterialIcon name="check_circle" size={28} className="mx-auto text-sky-400/50" />
                  <p>No active sparks pending. Jarvis is monitoring workspace in the background.</p>
                </div>
              ) : (
                pendingSparks.map((spark) => (
                  <div
                    key={spark.id}
                    className="p-4 rounded-xl bento-card bg-black/30 border border-[var(--theme-border)] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            [{spark.category.toUpperCase()}]
                          </span>
                          <h4 className="text-xs font-bold text-[var(--theme-text)]">
                            {spark.title}
                          </h4>
                        </div>
                        <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                          {spark.description}
                        </p>
                        {spark.targetFiles && spark.targetFiles.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">Target:</span>
                            {spark.targetFiles.map((file, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-[10px] font-mono text-sky-300 truncate max-w-[200px]"
                                title={file}
                              >
                                {file}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[var(--theme-text-muted)] shrink-0">
                        {new Date(spark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {spark.previewDiff && (
                      <pre className="p-2.5 rounded-lg bg-black/60 border border-[var(--theme-border)]/40 text-[11px] font-mono text-sky-300/90 overflow-x-auto whitespace-pre-wrap">
                        {spark.previewDiff}
                      </pre>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--theme-border)]/30">
                      <button
                        type="button"
                        onClick={() => onDismissSpark?.(spark.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        [Dismiss]
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAcceptSpark?.(spark);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-mono font-medium transition-colors cursor-pointer active:scale-95"
                      >
                        <MaterialIcon name="play_arrow" size={14} />
                        <span>[Run Task]</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2. Workers Tab */}
          {activeTab === 'workers' && (
            <div className="space-y-3">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  className="p-3.5 rounded-xl bento-card bg-black/30 border border-[var(--theme-border)] flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-[var(--theme-border)] flex items-center justify-center text-sky-400">
                      <MaterialIcon name="dns" size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--theme-text)]">
                          {worker.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          [{worker.type.toUpperCase()}]
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--theme-text-muted)] font-mono mt-0.5">
                        {worker.currentTask || 'Idle / Monitoring'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        worker.status === 'running'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {worker.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-2">
              {activities.length === 0 ? (
                <p className="py-8 text-center text-xs font-mono text-[var(--theme-text-muted)]">
                  No activity logs recorded yet.
                </p>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-lg bg-black/20 border border-[var(--theme-border)]/40 flex items-start gap-2.5 text-xs font-mono"
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                        act.type === 'error'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : act.type === 'warning'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : act.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      }`}
                    >
                      {act.agent}
                    </span>
                    <span className="text-[var(--theme-text)] flex-1">{act.message}</span>
                    <span className="text-[10px] text-[var(--theme-text-muted)] shrink-0">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--theme-border)]/60 bg-[var(--theme-sidebar)]/20 flex items-center justify-between text-xs font-mono text-[var(--theme-text-muted)]">
          <span>STATUS: OPERATIONAL</span>
          <span>AUTONOMY: LOCAL & AGENTIC</span>
        </div>
      </div>
    </div>
  );
};
