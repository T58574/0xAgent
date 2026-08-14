import React, { useState, useEffect } from 'react';
import { AppConfig, JarvisState, JulesSessionInfo, JulesSource } from '../types';
import {
  get_jules_sources,
  create_jules_session,
  approve_jules_plan,
  send_jules_message,
} from '../services/api';
import { Bot, X, ExternalLink, Activity } from 'lucide-react';

interface JarvisWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  jarvisState: JarvisState | null;
  julesSessions: JulesSessionInfo[];
  onRefresh: () => void;
  config?: AppConfig | null;
}

export const JarvisWidget: React.FC<JarvisWidgetProps> = ({
  isOpen,
  onClose,
  jarvisState,
  julesSessions,
  onRefresh,
  config,
}) => {
  const [activeTab, setActiveTab] = useState<'workers' | 'new_task' | 'activity'>('workers');
  const [sources, setSources] = useState<JulesSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [newPrompt, setNewPrompt] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('');
  const [startingBranch, setStartingBranch] = useState<string>('main');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSources();
    }
  }, [isOpen]);

  const fetchSources = async () => {
    try {
      const srcList = await get_jules_sources();
      setSources(srcList);
      if (srcList.length > 0 && !selectedSource) {
        const defaultRepo = config?.jules_default_repo?.trim();
        const matched = defaultRepo
          ? srcList.find((s) => s.name === defaultRepo || s.id === defaultRepo || s.name.includes(defaultRepo))
          : null;
        setSelectedSource(matched ? matched.name || matched.id : srcList[0].name || srcList[0].id);
      }
    } catch {
      // Ignored if API key is not configured yet
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt || !selectedSource) return;

    setLoading(true);
    setError(null);
    try {
      await create_jules_session({
        prompt: newPrompt,
        source: selectedSource,
        startingBranch: startingBranch || 'main',
        title: newTitle || undefined,
        autoCreatePR: true,
      });
      setNewPrompt('');
      setNewTitle('');
      setActiveTab('workers');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePlan = async (sessionId: string) => {
    try {
      await approve_jules_plan(sessionId);
      onRefresh();
    } catch (err: any) {
      alert(`Error approving plan: ${err.message}`);
    }
  };

  const handleSendFeedback = async (sessionId: string) => {
    const text = feedbackMap[sessionId];
    if (!text || !text.trim()) return;

    try {
      await send_jules_message(sessionId, text.trim());
      setFeedbackMap((prev) => ({ ...prev, [sessionId]: '' }));
      onRefresh();
    } catch (err: any) {
      alert(`Error sending message: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const activeJulesCount = julesSessions.filter(
    (s) => s.status === 'EXECUTING' || s.status === 'WAITING_PLAN_APPROVAL' || s.status === 'PLANNING'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl h-full bg-[var(--theme-panel)] border-l border-[var(--theme-border)] text-[var(--theme-text)] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--theme-border)] flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-text-muted)]">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[var(--theme-text)] flex items-center gap-2">
                <span>Jarvis Orchestrator</span>
                {activeJulesCount > 0 && (
                  <span className="px-2 py-0.2 text-[10px] font-mono rounded-md bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)]">
                    {activeJulesCount} Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--theme-text-muted)]">Google Jules Cloud Worker & Supervisor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--theme-border)] bg-black/20 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('workers')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'workers'
                ? 'border-[var(--theme-text)] text-[var(--theme-text)]'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            Active Workers ({julesSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('new_task')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'new_task'
                ? 'border-[var(--theme-text)] text-[var(--theme-text)]'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            New Task
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'border-[var(--theme-text)] text-[var(--theme-text)]'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            Live Feed ({jarvisState?.recentActivities.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: Workers Overview */}
          {activeTab === 'workers' && (
            <div className="space-y-4">
              {/* Supervisor Banner */}
              <div className="p-3.5 rounded-xl bento-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Activity size={15} className="text-[var(--theme-text-muted)]" />
                  <div>
                    <span className="text-xs font-semibold text-[var(--theme-text)]">Jarvis Core Supervisor</span>
                    <p className="text-[11px] text-[var(--theme-text-muted)]">
                      {jarvisState?.activeWorkers.find((w) => w.type === 'supervisor')?.currentTask ||
                        'Monitoring background workers and auto-reviewing PRs'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-[var(--theme-text)] font-mono">
                  ACTIVE
                </span>
              </div>

              {/* Jules Sessions List */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--theme-text-muted)]">
                  Google Jules Cloud Tasks
                </h3>

                {julesSessions.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-[var(--theme-border)] text-center text-[var(--theme-text-muted)]">
                    <p className="text-xs">No active cloud tasks in progress.</p>
                    <button
                      onClick={() => setActiveTab('new_task')}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-medium transition-colors cursor-pointer"
                    >
                      Delegate new task
                    </button>
                  </div>
                ) : (
                  julesSessions.map((session) => {
                    const pr = session.outputs?.find((o) => o.pullRequest)?.pullRequest;

                    return (
                      <div
                        key={session.id}
                        className="p-4 rounded-xl bento-card space-y-2.5 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-xs text-[var(--theme-text)]">{session.title}</h4>
                            <p className="text-[10px] text-[var(--theme-text-muted)] font-mono">ID: {session.id}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono border border-[var(--theme-border)]">
                            {session.status}
                          </span>
                        </div>

                        <p className="p-2.5 rounded-lg bg-black/40 border border-[var(--theme-border)] font-mono text-xs text-[var(--theme-text-muted)]">
                          {session.prompt}
                        </p>

                        {/* PR Result Card */}
                        {pr && (
                          <div className="p-2.5 rounded-lg bg-white/5 border border-[var(--theme-border)] flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-semibold uppercase text-[var(--theme-text)]">
                                Pull Request Ready
                              </span>
                              <p className="text-xs text-[var(--theme-text-muted)]">{pr.title}</p>
                            </div>
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                              <span>View PR</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        )}

                        {/* Plan Approval Action */}
                        {session.status === 'WAITING_PLAN_APPROVAL' && (
                          <div className="flex items-center justify-between bg-white/5 border border-[var(--theme-border)] p-2.5 rounded-lg">
                            <span className="text-xs text-[var(--theme-text-muted)]">
                              Jules has generated a plan and awaits your approval.
                            </span>
                            <button
                              onClick={() => handleApprovePlan(session.id)}
                              className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-medium transition-colors cursor-pointer"
                            >
                              Approve Plan
                            </button>
                          </div>
                        )}

                        {/* Follow-up Feedback Input */}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Send instruction to Jules..."
                            value={feedbackMap[session.id] || ''}
                            onChange={(e) =>
                              setFeedbackMap({ ...feedbackMap, [session.id]: e.target.value })
                            }
                            className="flex-1 px-3 py-1.5 text-xs bg-black/40 border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none"
                          />
                          <button
                            onClick={() => handleSendFeedback(session.id)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs rounded-lg font-medium transition-colors cursor-pointer"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: New Task Form */}
          {activeTab === 'new_task' && (
            <form onSubmit={handleCreateTask} className="space-y-3">
              {error && (
                <div className="p-3 rounded-lg bg-white/5 border border-rose-500/40 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--theme-text-muted)]">Repository Source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">Select repository source...</option>
                  {sources.map((s) => (
                    <option key={s.id || s.name} value={s.name || s.id}>
                      {s.name || s.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--theme-text-muted)]">Task Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Fix authentication token expiration"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--theme-text-muted)]">Target Branch</label>
                <input
                  type="text"
                  value={startingBranch}
                  onChange={(e) => setStartingBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--theme-text-muted)]">Task Description / Prompt</label>
                <textarea
                  rows={6}
                  placeholder="Describe what Jules should implement or refactor..."
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  className="w-full p-3 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none resize-y"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating Task...' : 'Dispatch Task to Cloud'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Activity Feed */}
          {activeTab === 'activity' && (
            <div className="space-y-2">
              {(!jarvisState || jarvisState.recentActivities.length === 0) ? (
                <div className="p-8 rounded-xl border border-dashed border-[var(--theme-border)] text-center text-[var(--theme-text-muted)] text-xs">
                  No activity events recorded yet.
                </div>
              ) : (
                jarvisState.recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bento-card text-xs flex items-start gap-2.5"
                  >
                    <Activity size={14} className="text-[var(--theme-text-muted)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[var(--theme-text)]">{act.message}</p>
                      <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
