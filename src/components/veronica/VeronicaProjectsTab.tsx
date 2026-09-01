import React, { useState, useEffect } from 'react';
import { FolderGit2, Shield, FileText } from 'lucide-react';
import { Card, Badge, Button } from '../ui';
import * as api from '../../services/api';

export const VeronicaProjectsTab: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get_veronica_projects();
      if (res.projects) {
        setProjects(res.projects);
        if (!selectedProject && res.projects.length > 0) {
          setSelectedProject(res.projects[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Veronica projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between gap-3 bg-[var(--theme-card-bg)] p-4 rounded-2xl border border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
            <FolderGit2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Проекты & Сжатый Контекст</h3>
            <p className="text-xs text-[var(--theme-text-muted)]">Управление контекстом и уровнями автономности (L0–L5)</p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchProjects} disabled={loading}>
          Обновить
        </Button>
      </div>

      {/* Master-Detail View */}
      {projects.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-[var(--theme-border)]">
          <FolderGit2 size={32} className="mx-auto text-[var(--theme-text-muted)] mb-3 opacity-60" />
          <h4 className="text-sm font-bold text-[var(--theme-text)]">Нет зарегистрированных проектов</h4>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1 max-w-sm mx-auto">
            Проекты регистрируются автоматически при первом обращении агента или вызове <code className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)]">0xagent veronica context &lt;project&gt;</code>.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Master List */}
          <div className="md:col-span-5 space-y-3">
            {projects.map((p) => {
              const isSelected = selectedProject?.project === p.project;
              return (
                <button
                  key={p.project}
                  type="button"
                  onClick={() => setSelectedProject(p)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] ring-1 ring-[var(--theme-accent)]/30'
                      : 'border-[var(--theme-border)] bg-[var(--theme-panel)] hover:bg-[var(--theme-card-bg)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[var(--theme-text)]">{p.project}</span>
                    <Badge variant={p.active_tasks_count > 0 ? 'accent' : 'neutral'}>
                      {p.active_tasks_count > 0 ? `Активных: ${p.active_tasks_count}` : 'Свободен'}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--theme-text-muted)] line-clamp-2 font-mono">
                    {p.dense_context_summary}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right Detail Pane */}
          <div className="md:col-span-7">
            {selectedProject && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-4">
                  <div>
                    <h4 className="text-base font-bold text-[var(--theme-text)]">{selectedProject.project}</h4>
                    <p className="text-xs text-[var(--theme-text-muted)]">
                      Последняя активность: {new Date(selectedProject.last_activity_at || selectedProject.last_updated).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="accent" icon={<Shield size={12} />}>
                    L2 Autonomy
                  </Badge>
                </div>

                {/* Dense Context Output */}
                <div>
                  <h5 className="text-xs font-bold text-[var(--theme-text)] mb-2 flex items-center gap-1.5">
                    <FileText size={13} className="text-[var(--theme-accent)]" />
                    <span>Сверхплотный Context Output (&lt; 250 токенов):</span>
                  </h5>
                  <div className="p-3 rounded-xl bg-black/40 border border-[var(--theme-border)] font-mono text-xs text-[var(--theme-text)] leading-relaxed select-text">
                    {selectedProject.dense_context_summary}
                  </div>
                  <p className="text-[11px] text-[var(--theme-text-muted)] mt-1.5">
                    Этот текст передается агенту по команде <code className="px-1 py-0.5 rounded bg-[var(--theme-border-subtle)]">0xagent veronica context {selectedProject.project}</code> для экономии контекста LLM.
                  </p>
                </div>

                {/* Status Telemetry */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-[var(--theme-panel)] border border-[var(--theme-border)]">
                    <span className="text-xs text-[var(--theme-text-muted)] block">Ожидает решения:</span>
                    <strong className="text-sm text-[var(--theme-text)]">{selectedProject.pending_attention_count || 0}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--theme-panel)] border border-[var(--theme-border)]">
                    <span className="text-xs text-[var(--theme-text-muted)] block">Активных задач:</span>
                    <strong className="text-sm text-[var(--theme-text)]">{selectedProject.active_tasks_count || 0}</strong>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
