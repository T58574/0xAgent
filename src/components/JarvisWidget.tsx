import React, { useState, useEffect } from 'react';
import { AppConfig, JarvisState, JulesSessionInfo, JulesSource } from '../types';
import {
  get_jules_sources,
  create_jules_session,
  approve_jules_plan,
  send_jules_message,
} from '../services/api';

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
    } catch (err: any) {
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
      setError(err.message || 'Failed to create Jules task');
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl h-full bg-[#0d1322] border-l border-white/10 text-slate-100 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                Jarvis Multi-Agent Orchestrator
                {activeJulesCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    {activeJulesCount} Active Task{activeJulesCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Google Jules Cloud Worker & Background Supervisor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-slate-900/30 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('workers')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'workers'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ Active Workers ({julesSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('new_task')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'new_task'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ➕ New Jules Task
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 Live Feed ({jarvisState?.recentActivities.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Workers Overview */}
          {activeTab === 'workers' && (
            <div className="space-y-6">
              {/* Supervisor Banner */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <span className="text-sm font-semibold text-white">Jarvis Core Supervisor</span>
                    <p className="text-xs text-slate-400">
                      {jarvisState?.activeWorkers.find((w) => w.type === 'supervisor')?.currentTask ||
                        'Monitoring background workers and auto-reviewing PRs'}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 font-mono">
                  ACTIVE
                </span>
              </div>

              {/* Jules Sessions List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Google Jules Cloud Tasks
                </h3>

                {julesSessions.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-white/10 text-center text-slate-400">
                    <p className="text-sm">No Jules cloud tasks in progress.</p>
                    <button
                      onClick={() => setActiveTab('new_task')}
                      className="mt-3 px-4 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
                    >
                      Delegate new task to Jules
                    </button>
                  </div>
                ) : (
                  julesSessions.map((session) => {
                    const pr = session.outputs?.find((o) => o.pullRequest)?.pullRequest;

                    return (
                      <div
                        key={session.id}
                        className="p-5 rounded-xl bg-slate-900/80 border border-white/10 space-y-3 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-white text-base">{session.title}</h4>
                            <p className="text-xs text-slate-400 font-mono">ID: {session.id}</p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              session.status === 'PR_CREATED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : session.status === 'WAITING_PLAN_APPROVAL'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse'
                            }`}
                          >
                            {session.status}
                          </span>
                        </div>

                        <p className="text-sm text-slate-300 bg-slate-950/50 p-3 rounded-lg border border-white/5 font-mono text-xs">
                          {session.prompt}
                        </p>

                        {/* PR Result Card */}
                        {pr && (
                          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎉</span>
                              <div>
                                <span className="text-xs font-bold text-emerald-400 uppercase">
                                  Pull Request Ready
                                </span>
                                <p className="text-xs text-slate-300 font-medium">{pr.title}</p>
                              </div>
                            </div>
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              View PR 🔗
                            </a>
                          </div>
                        )}

                        {/* Plan Approval Action */}
                        {session.status === 'WAITING_PLAN_APPROVAL' && (
                          <div className="flex items-center justify-between bg-amber-950/30 border border-amber-500/30 p-3 rounded-lg">
                            <span className="text-xs text-amber-300">
                              Jules has generated a plan and awaits your approval.
                            </span>
                            <button
                              onClick={() => handleApprovePlan(session.id)}
                              className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                            >
                              Approve Plan ✓
                            </button>
                          </div>
                        )}

                        {/* Follow-up Feedback Input */}
                        <div className="flex gap-2 pt-2">
                          <input
                            type="text"
                            placeholder="Send feedback or additional instruction to Jules..."
                            value={feedbackMap[session.id] || ''}
                            onChange={(e) =>
                              setFeedbackMap({ ...feedbackMap, [session.id]: e.target.value })
                            }
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            onClick={() => handleSendFeedback(session.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition-colors"
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
            <form onSubmit={handleCreateTask} className="space-y-4 bg-slate-900/60 p-6 rounded-xl border border-white/10">
              <h3 className="text-base font-bold text-white mb-2">Delegate Task to Google Jules</h3>
              <p className="text-xs text-slate-400 mb-4">
                Jules will autonomously fork/branch your repository in Google Cloud, write and test code, and create a Pull Request.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Repository (Source)</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {sources.length === 0 ? (
                    <option value="">No sources found (Check Jules API Key in Settings)</option>
                  ) : (
                    sources.map((s) => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.id || s.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Refactor Auth Middleware"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Starting Branch</label>
                <input
                  type="text"
                  placeholder="main"
                  value={startingBranch}
                  onChange={(e) => setStartingBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Prompt / Instruction</label>
                <textarea
                  rows={5}
                  placeholder="Detailed description of what Jules should implement or refactor..."
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !newPrompt || !selectedSource}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all"
              >
                {loading ? 'Launching Cloud Worker...' : '🚀 Launch Jules Cloud Worker'}
              </button>
            </form>
          )}

          {/* TAB 3: Activity Feed */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Real-Time Multi-Agent Live Feed
              </h3>
              {!jarvisState || jarvisState.recentActivities.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No activities logged yet.</p>
              ) : (
                jarvisState.recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-lg bg-slate-900/60 border border-white/5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-cyan-400">{act.agent}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-300 font-mono">{act.message}</p>
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
