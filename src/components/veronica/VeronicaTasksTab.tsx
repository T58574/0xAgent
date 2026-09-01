import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle, Terminal, Layers } from 'lucide-react';
import { Button, Card, Badge, Input, Modal } from '../ui';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';

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
  const [spawning, setSpawning] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      await api.get_veronica_status();
      // Also fetch projects to get task snapshots
      const projRes = await api.get_veronica_projects();
      const allTasks: any[] = [];
      if (projRes.projects) {
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
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

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
      });

      if (res.success) {
        showToast(`Задача ${res.task.id.substring(0, 8)} успешно запущена!`, 'success');
        setIsSpawnModalOpen(false);
        setNewProject('');
        setNewSkill('');
        setNewPrompt('');
        fetchTasks();
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
        fetchTasks();
      }
    } catch (err: any) {
      showToast(`Ошибка остановки: ${err?.message || err}`, 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="accent" icon={<RefreshCw size={11} className="animate-spin" />}>В работе</Badge>;
      case 'queued':
        return <Badge variant="warning" icon={<Clock size={11} />}>В очереди</Badge>;
      case 'completed':
        return <Badge variant="success" icon={<CheckCircle2 size={11} />}>Завершено</Badge>;
      case 'failed':
      case 'crashed':
        return <Badge variant="danger" icon={<XCircle size={11} />}>Ошибка</Badge>;
      case 'timeout':
        return <Badge variant="warning" icon={<AlertTriangle size={11} />}>Таймаут</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Strip */}
      <div className="flex items-center justify-between gap-3 bg-[var(--theme-card-bg)] p-4 rounded-2xl border border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Операционный Журнал & Live Задачи</h3>
            <p className="text-xs text-[var(--theme-text-muted)]">Управление фоновыми агентами и аудит выполненной работы</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchTasks} disabled={loading} icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}>
            Обновить
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsSpawnModalOpen(true)} icon={<Play size={13} />}>
            Запустить задачу
          </Button>
        </div>
      </div>

      {/* Task List Cards */}
      {tasks.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-[var(--theme-border)]">
          <Terminal size={32} className="mx-auto text-[var(--theme-text-muted)] mb-3 opacity-60" />
          <h4 className="text-sm font-bold text-[var(--theme-text)]">Нет зарегистрированных задач</h4>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1 max-w-sm mx-auto">
            Запустите фоновую задачу через кнопку выше, команду Telegram бота (<code className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)]">/run</code>) или Veronica CLI.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tasks.map((task, idx) => (
            <Card key={task.id || idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-[var(--theme-accent)]">
                    #{task.id ? task.id.substring(0, 8) : `task-${idx}`}
                  </span>
                  <span className="text-xs font-semibold text-[var(--theme-text)]">{task.project || 'Общий проект'}</span>
                  {getStatusBadge(task.status)}
                </div>
                <div className="text-xs text-[var(--theme-text-muted)] flex items-center gap-3">
                  <span>Skill: <strong className="text-[var(--theme-text)]">{task.skill}</strong></span>
                  {task.finished_at && (
                    <span>Завершено: {new Date(task.finished_at).toLocaleTimeString()}</span>
                  )}
                </div>
                {task.summary && (
                  <p className="text-xs text-[var(--theme-text-muted)] font-mono bg-[var(--theme-panel)] p-2 rounded-xl border border-[var(--theme-border)]">
                    {task.summary}
                  </p>
                )}
              </div>

              {task.status === 'running' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleKillTask(task.id)}
                  icon={<Square size={13} />}
                >
                  Остановить
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Spawn Task Modal */}
      {isSpawnModalOpen && (
        <Modal
          isOpen={isSpawnModalOpen}
          onClose={() => setIsSpawnModalOpen(false)}
          title="Запуск фоновой задачи через Веронику"
        >
          <div className="space-y-4">
            <Input
              label="Имя проекта (Project Name)"
              placeholder="например: 0xAgent или WebApp"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
            />
            <Input
              label="Навык / Операция (Skill)"
              placeholder="например: code_review или security_audit"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
            />
            <div>
              <label className="block text-xs font-bold text-[var(--theme-text-muted)] mb-1.5">
                Дополнительный промпт (опционально)
              </label>
              <textarea
                className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl p-3 text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-accent)] resize-none h-24"
                placeholder="Инструкции или контекст для задачи..."
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsSpawnModalOpen(false)}>
                Отмена
              </Button>
              <Button variant="primary" size="sm" onClick={handleSpawnTask} disabled={spawning} icon={<Play size={13} />}>
                {spawning ? 'Запуск...' : 'Запустить'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
