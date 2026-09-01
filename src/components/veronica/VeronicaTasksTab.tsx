import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Ban,
  PauseCircle,
  AlertOctagon,
  Hourglass,
  Terminal,
  Copy,
  Trash2,
  Radio,
} from 'lucide-react';
import { Button, Card, Badge, Input, Select, Modal } from '../ui';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { VeronicaStreamEvent } from '../../types';

interface VeronicaTasksTabProps {
  onRefresh?: () => void;
}

export const VeronicaTasksTab: React.FC<VeronicaTasksTabProps> = ({ onRefresh }) => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSpawnModalOpen, setIsSpawnModalOpen] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('inherit');
  const [selectedEffort, setSelectedEffort] = useState<'auto' | 'low' | 'medium' | 'high'>('auto');
  const [selectedAgent, setSelectedAgent] = useState('default');
  const [selectedTimeout, setSelectedTimeout] = useState('15m');
  const [availableModels, setAvailableModels] = useState<{ local: string[]; antigravity: { slug: string; name: string; effort?: string }[] }>({ local: [], antigravity: [] });
  const [availableAgents, setAvailableAgents] = useState<{ slug: string; name: string; description?: string }[]>([]);
  const [spawning, setSpawning] = useState(false);

  // Live Stream Console State
  const [streamActiveTaskId, setStreamActiveTaskId] = useState<string | null>(null);
  const [streamLogs, setStreamLogs] = useState<VeronicaStreamEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchTasksAndMeta = async () => {
    try {
      setLoading(true);
      const [projRes, modelsRes, agentsRes] = await Promise.all([
        api.get_veronica_projects().catch(() => ({ projects: [] })),
        api.get_veronica_models().catch(() => ({ local: [], antigravity: [] })),
        api.get_veronica_agents().catch(() => ({ agents: [] })),
      ]);

      if (modelsRes) setAvailableModels(modelsRes);
      if (agentsRes?.agents) setAvailableAgents(agentsRes.agents);

      const allTasks: any[] = [];
      if (projRes?.projects) {
        projRes.projects.forEach((p: any) => {
          try {
            const parsed = JSON.parse(p.recent_completions || '[]');
            allTasks.push(...parsed.map((t: any) => ({ ...t, project: p.project })));
          } catch {}
        });
      }
      setTasks(allTasks);
    } catch (err: any) {
      console.error('Failed to fetch Veronica tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndMeta();
    const interval = setInterval(fetchTasksAndMeta, 5000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to SSE / WS stream when a task console is opened
  useEffect(() => {
    if (!streamActiveTaskId) {
      setStreamLogs([]);
      return;
    }

    // Subscribe via SSE
    const unsubscribe = api.stream_veronica_task(
      streamActiveTaskId,
      (ev) => {
        setStreamLogs((prev) => [...prev, ev]);
      },
      (err) => {
        console.warn('[SSE Task Stream Error]', err);
      }
    );

    // Fallback WS listener
    const unlistenWs = api.listen('veronica-stream-chunk', (data: any) => {
      if (data?.taskId === streamActiveTaskId) {
        setStreamLogs((prev) => {
          if (prev.some((p) => p.timestamp === data.timestamp && p.chunk === data.chunk)) {
            return prev;
          }
          return [...prev, data];
        });
      }
    });

    return () => {
      unsubscribe();
      unlistenWs();
    };
  }, [streamActiveTaskId]);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamLogs, autoScroll]);

  const handleSpawnTask = async () => {
    if (!newProject.trim() || !newSkill.trim()) {
      showToast('Укажите имя проекта и навык (skill)', 'error');
      return;
    }

    try {
      setSpawning(true);
      const res = await api.spawn_veronica_task({
        project: newProject.trim(),
        skill: newSkill.trim(),
        custom_prompt: newPrompt.trim() || undefined,
        model: selectedModel !== 'inherit' ? selectedModel : undefined,
        effort: selectedEffort !== 'auto' ? selectedEffort : undefined,
        agent: selectedAgent !== 'default' ? selectedAgent : undefined,
        print_timeout: selectedTimeout || undefined,
      });

      if (res.success) {
        showToast(`Задача ${res.task.id.substring(0, 8)} успешно запущена!`, 'success');
        setIsSpawnModalOpen(false);
        setNewProject('');
        setNewSkill('');
        setNewPrompt('');
        setStreamActiveTaskId(res.task.id);
        fetchTasksAndMeta();
        onRefresh?.();
      }
    } catch (err: any) {
      showToast(`Ошибка запуска: ${err?.message || err}`, 'error');
    } finally {
      setSpawning(false);
    }
  };

  const handleKillTask = async (taskId: string) => {
    try {
      const res = await api.kill_veronica_task(taskId);
      if (res.success) {
        showToast(`Задача ${taskId.substring(0, 8)} остановлена`, 'info');
        fetchTasksAndMeta();
      }
    } catch (err: any) {
      showToast(`Ошибка остановки: ${err?.message || err}`, 'error');
    }
  };

  const copyLogsToClipboard = () => {
    const text = streamLogs.map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.type.toUpperCase()}: ${l.chunk || l.summary || ''}`).join('\n');
    navigator.clipboard.writeText(text);
    showToast('Логи скопированы в буфер обмена', 'info');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
      case 'RUNNING':
        return <Badge variant="accent" icon={<RefreshCw size={11} className="animate-spin" />}>В работе / RUNNING</Badge>;
      case 'queued':
        return <Badge variant="warning" icon={<Clock size={11} />}>В очереди / QUEUED</Badge>;
      case 'completed':
      case 'SUCCESS':
        return <Badge variant="success" icon={<CheckCircle2 size={11} />}>Успешно / SUCCESS</Badge>;
      case 'failed':
      case 'crashed':
      case 'ERROR':
        return <Badge variant="danger" icon={<XCircle size={11} />}>Ошибка / ERROR</Badge>;
      case 'cancelled':
      case 'CANCELED':
        return <Badge variant="neutral" icon={<Ban size={11} />}>Отменено / CANCELED</Badge>;
      case 'interrupted':
      case 'INTERRUPTED':
        return <Badge variant="warning" icon={<PauseCircle size={11} />}>Прервано / INTERRUPTED</Badge>;
      case 'invalid':
      case 'INVALID':
        return <Badge variant="danger" icon={<AlertOctagon size={11} />}>Невалидно / INVALID</Badge>;
      case 'waiting':
      case 'awaiting_approval':
      case 'WAITING':
        return <Badge variant="warning" icon={<Hourglass size={11} />}>Ожидание / WAITING</Badge>;
      case 'timeout':
        return <Badge variant="warning" icon={<AlertTriangle size={11} />}>Таймаут / TIMEOUT</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Build model options for Select
  const modelOptions = [
    { value: 'inherit', label: 'Default / Auto (Inherit Host Model)' },
    ...availableModels.antigravity.map((m) => ({
      value: m.slug,
      label: `⚡ Antigravity: ${m.name}`,
    })),
    ...availableModels.local.map((m) => ({
      value: m,
      label: `🧠 Local: ${m}`,
    })),
  ];

  // Build agent options for Select
  const agentOptions = [
    { value: 'default', label: 'Default General Agent' },
    ...availableAgents.map((a) => ({
      value: a.slug,
      label: `🤖 ${a.name}`,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Action Strip */}
      <div className="flex items-center justify-between gap-3 bg-[var(--theme-card-bg)] p-4 rounded-2xl border border-[var(--theme-border)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Операционный Журнал & Live Задачи</h3>
            <p className="text-xs text-[var(--theme-text-muted)]">Управление фоновыми агентами, контроль статусов и live SSE/WS стриминг</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchTasksAndMeta} disabled={loading} icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}>
            Обновить
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsSpawnModalOpen(true)} icon={<Play size={13} />}>
            Запустить задачу
          </Button>
        </div>
      </div>

      {/* Tasks Feed */}
      {tasks.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-[var(--theme-border)] bg-[var(--theme-card-bg)]">
          <Layers size={36} className="mx-auto text-[var(--theme-text-muted)] mb-3 opacity-50" />
          <h4 className="text-sm font-bold text-[var(--theme-text)]">Нет недавних задач</h4>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1 max-w-sm mx-auto">
            Запустите фоновую задачу кнопкой выше или через Telegram-бота командой <code className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)] font-mono">/task &lt;project&gt; &lt;skill&gt;</code>.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] shadow-xs">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-[var(--theme-text)]">{task.project}</span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-[var(--theme-border-subtle)] text-[var(--theme-text)] font-semibold">
                    {task.skill}
                  </span>
                  {getStatusBadge(task.status)}
                </div>
                {task.summary && (
                  <p className="text-xs text-[var(--theme-text-muted)] line-clamp-2">
                    {task.summary}
                  </p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-[var(--theme-text-muted)] font-mono">
                  <span>ID: {task.id.substring(0, 8)}</span>
                  {task.finished_at && <span>Завершено: {new Date(task.finished_at).toLocaleTimeString()}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStreamActiveTaskId(task.id)}
                  icon={<Terminal size={13} />}
                >
                  Live Стрим
                </Button>
                {task.status === 'running' && (
                  <Button variant="danger" size="sm" onClick={() => handleKillTask(task.id)}>
                    Остановить
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Live Stream Terminal Drawer Modal */}
      {streamActiveTaskId && (
        <Modal
          isOpen={!!streamActiveTaskId}
          onClose={() => setStreamActiveTaskId(null)}
          title={`Live SSE/WS Console :: Task ${streamActiveTaskId.substring(0, 8)}`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-[var(--theme-border)] text-xs">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-emerald-400 animate-pulse" />
                <span className="font-mono text-emerald-400 font-bold">SSE / WebSocket Stream Active</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                    autoScroll ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-[var(--theme-text-muted)] border-transparent'
                  }`}
                >
                  Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={copyLogsToClipboard}
                  className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
                  title="Копировать логи"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setStreamLogs([])}
                  className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
                  title="Очистить"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Terminal Log Viewport */}
            <div className="bg-[#0c0d12] border border-[var(--theme-border)] rounded-2xl p-4 font-mono text-xs text-zinc-300 h-96 overflow-y-auto space-y-1 scrollbar-thin">
              {streamLogs.length === 0 ? (
                <div className="text-zinc-500 italic flex items-center justify-center h-full">
                  Ожидание потока данных от процесса Antigravity...
                </div>
              ) : (
                streamLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-zinc-600 select-none text-[10px] shrink-0 pt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`font-semibold shrink-0 text-[10px] uppercase px-1 rounded ${
                        log.type === 'stderr' || log.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-400'
                          : log.type === 'stdout'
                          ? 'bg-sky-500/10 text-sky-300'
                          : log.type === 'heartbeat'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {log.type}
                    </span>
                    <span className={`break-all whitespace-pre-wrap ${log.type === 'stderr' ? 'text-rose-300' : 'text-zinc-200'}`}>
                      {log.chunk || log.summary || JSON.stringify(log.metadata || '')}
                    </span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-[var(--theme-text-muted)] font-mono">
                Всего событий: {streamLogs.length}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setStreamActiveTaskId(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Spawn Task Modal with Model, Effort, Timeout & Agent Selector */}
      {isSpawnModalOpen && (
        <Modal
          isOpen={isSpawnModalOpen}
          onClose={() => setIsSpawnModalOpen(false)}
          title="Запуск фоновой задачи через Веронику"
        >
          <div className="space-y-4">
            <Input
              label="Имя проекта (Project Name)"
              placeholder="например: 0xAgent или 0xVoice2Text"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
            />

            <Input
              label="Навык / Операция (Skill)"
              placeholder="например: code_review, audit, test_suite"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Модель (Model Slug)"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                options={modelOptions}
              />

              <Select
                label="Reasoning Effort (--effort)"
                value={selectedEffort}
                onChange={(e) => setSelectedEffort(e.target.value as any)}
                options={[
                  { value: 'auto', label: 'Auto / Default' },
                  { value: 'low', label: 'Low (Быстрый ответ)' },
                  { value: 'medium', label: 'Medium (Сбалансированный)' },
                  { value: 'high', label: 'High (Глубокое рассуждение)' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Специализированный Агент (--agent)"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                options={agentOptions}
              />

              <Select
                label="Таймаут выполнения (--print-timeout)"
                value={selectedTimeout}
                onChange={(e) => setSelectedTimeout(e.target.value)}
                options={[
                  { value: '5m', label: '5 минут (По умолчанию)' },
                  { value: '15m', label: '15 минут (Рекомендуется)' },
                  { value: '30m', label: '30 минут (Длинные задачи)' },
                  { value: '1h', label: '1 час (Глубокий рефакторинг)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--theme-text-muted)] mb-1.5">
                Дополнительный промпт (опционально)
              </label>
              <textarea
                className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl p-3 text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-accent)] resize-none h-20 font-sans"
                placeholder="Инструкции или контекст для задачи..."
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--theme-border)]">
              <Button variant="ghost" size="sm" onClick={() => setIsSpawnModalOpen(false)}>
                Отмена
              </Button>
              <Button variant="primary" size="sm" onClick={handleSpawnTask} disabled={spawning} icon={<Play size={13} />}>
                {spawning ? 'Запуск...' : 'Запустить задачу'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
