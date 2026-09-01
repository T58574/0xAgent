import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Shield,
  FileText,
  RefreshCw,
  Plus,
  Copy,
  Check,
  FolderSearch,
  GitBranch,
} from 'lucide-react';
import { Card, Badge, Button, Input, Modal } from '../ui';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const VeronicaProjectsTab: React.FC = () => {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [searchPaths, setSearchPaths] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAddPathModalOpen, setIsAddPathModalOpen] = useState(false);
  const [newPathInput, setNewPathInput] = useState('');
  const [copiedContext, setCopiedContext] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const fetchProjectsAndPaths = async () => {
    try {
      setLoading(true);
      const [projRes, pathsRes] = await Promise.all([
        api.get_veronica_projects(),
        api.get_veronica_paths().catch(() => ({ paths: [] })),
      ]);

      if (pathsRes?.paths) {
        setSearchPaths(pathsRes.paths);
      }

      if (projRes.projects) {
        setProjects(projRes.projects);
        if (!selectedProject && projRes.projects.length > 0) {
          setSelectedProject(projRes.projects[0]);
        } else if (selectedProject) {
          const updated = projRes.projects.find((p: any) => p.project === selectedProject.project);
          if (updated) setSelectedProject(updated);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch Veronica projects:', err);
      showToast('Ошибка загрузки проектов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = async () => {
    try {
      setLoading(true);
      const res = await api.rescan_veronica_projects();
      if (res.projects) {
        setProjects(res.projects);
        if (res.projects.length > 0) {
          setSelectedProject(res.projects[0]);
        }
        showToast(`Обнаружено проектов: ${res.projects.length}`, 'success');
      }
    } catch (err: any) {
      showToast(`Ошибка сканирования: ${err?.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSearchPath = async () => {
    if (!newPathInput.trim()) {
      showToast('Укажите путь к папке с проектами', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.add_veronica_path(newPathInput.trim());
      if (res.success) {
        setSearchPaths(res.paths || []);
        setProjects(res.projects || []);
        setIsAddPathModalOpen(false);
        setNewPathInput('');
        showToast('Папка добавлена и проекты пересканированы', 'success');
      }
    } catch (err: any) {
      showToast(`Ошибка добавления пути: ${err?.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContext = () => {
    if (!selectedProject?.dense_context_summary) return;
    navigator.clipboard.writeText(selectedProject.dense_context_summary);
    setCopiedContext(true);
    setTimeout(() => setCopiedContext(false), 2000);
    showToast('Сжатый контекст скопирован', 'info');
  };

  const handleCopyPath = () => {
    if (!selectedProject?.path) return;
    navigator.clipboard.writeText(selectedProject.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
    showToast('Путь к проекту скопирован', 'info');
  };

  useEffect(() => {
    fetchProjectsAndPaths();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--theme-card-bg)] p-5 rounded-2xl border border-[var(--theme-border)] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
            <FolderGit2 size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--theme-text)]">Проекты & Сжатый Контекст</h3>
            <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
              Мониторинг директории <span className="font-mono text-[var(--theme-text)] font-semibold">{searchPaths[0] || 'C:\\Users\\user\\Documents\\dev'}</span> и управление контекстом
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddPathModalOpen(true)}
            icon={<Plus size={13} />}
          >
            Добавить папку
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRescan}
            disabled={loading}
            icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
          >
            Пересканировать
          </Button>
        </div>
      </div>

      {/* Master-Detail Layout */}
      {projects.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-[var(--theme-border)] bg-[var(--theme-card-bg)]">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--theme-border-subtle)] flex items-center justify-center text-[var(--theme-text-muted)]">
            <FolderSearch size={28} />
          </div>
          <h4 className="text-base font-bold text-[var(--theme-text)]">Нет обнаруженных проектов</h4>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1.5 max-w-md mx-auto">
            В директории <code className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)] font-mono">{searchPaths[0] || 'C:\\Users\\user\\Documents\\dev'}</code> пока нет проектов или они не зарегистрированы.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="primary" size="sm" onClick={() => setIsAddPathModalOpen(true)} icon={<Plus size={13} />}>
              Указать путь к проектам
            </Button>
            <Button variant="secondary" size="sm" onClick={handleRescan} icon={<RefreshCw size={13} />}>
              Пересканировать
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Master List */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
                Доступные Проекты ({projects.length})
              </span>
            </div>

            <div className="space-y-2.5">
              {projects.map((p) => {
                const isSelected = selectedProject?.project === p.project;
                return (
                  <Card
                    key={p.project}
                    onClick={() => setSelectedProject(p)}
                    className={`p-4 transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] ring-2 ring-[var(--theme-accent)]/20 shadow-md'
                        : 'border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:border-[var(--theme-accent)]/50 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderGit2 size={16} className={isSelected ? 'text-[var(--theme-accent)] shrink-0' : 'text-[var(--theme-text-muted)] shrink-0'} />
                        <span className="text-sm font-bold text-[var(--theme-text)] truncate">{p.project}</span>
                      </div>
                      <Badge variant={p.active_tasks_count > 0 ? 'accent' : 'neutral'}>
                        {p.active_tasks_count > 0 ? `Активных: ${p.active_tasks_count}` : 'Свободен'}
                      </Badge>
                    </div>

                    {p.path && (
                      <p className="text-[11px] text-[var(--theme-text-muted)] font-mono truncate mb-2 opacity-80" title={p.path}>
                        {p.path}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-[var(--theme-text-muted)] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)]">L2 Autonomy</span>
                      {p.gitRemote && (
                        <span className="flex items-center gap-1 truncate max-w-[150px]" title={p.gitRemote}>
                          <GitBranch size={10} />
                          Git
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right Detail Pane */}
          <div className="md:col-span-7">
            {selectedProject ? (
              <Card className="p-6 space-y-6 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] shadow-xs">
                {/* Detail Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-bold text-[var(--theme-text)] truncate">{selectedProject.project}</h4>
                      <Badge variant="accent" icon={<Shield size={12} />}>
                        L2 Autonomy
                      </Badge>
                    </div>
                    {selectedProject.path && (
                      <p className="text-xs text-[var(--theme-text-muted)] font-mono mt-1 truncate" title={selectedProject.path}>
                        {selectedProject.path}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedProject.path && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyPath}
                        icon={copiedPath ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        title="Скопировать абсолютный путь"
                      >
                        {copiedPath ? 'Скопировано' : 'Путь'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Dense Context Output */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                      <FileText size={14} className="text-[var(--theme-accent)]" />
                      <span>Сверхплотный Context Output (&lt; 250 токенов):</span>
                    </h5>
                    <button
                      type="button"
                      onClick={handleCopyContext}
                      className="text-xs text-[var(--theme-accent)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedContext ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedContext ? 'Скопировано' : 'Скопировать контекст'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] font-mono text-xs text-[var(--theme-text)] leading-relaxed select-text shadow-inner overflow-x-auto whitespace-pre-wrap break-all">
                    {selectedProject.dense_context_summary || `PROJECT:${selectedProject.project} | ACTIVE_TASKS:0 | DOCS:none`}
                  </div>

                  <p className="text-[11px] text-[var(--theme-text-muted)] leading-normal">
                    Этот текст передается агенту по команде <code className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)] font-mono font-bold">0xagent veronica context {selectedProject.project}</code> для нулевого расхода токенов LLM.
                  </p>
                </div>

                {/* Status Telemetry */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] shadow-xs">
                    <span className="text-xs text-[var(--theme-text-muted)] block">Ожидает решения:</span>
                    <strong className="text-base text-[var(--theme-text)] mt-0.5 block">{selectedProject.pending_attention_count || 0}</strong>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] shadow-xs">
                    <span className="text-xs text-[var(--theme-text-muted)] block">Активных задач:</span>
                    <strong className="text-base text-[var(--theme-accent)] mt-0.5 block">{selectedProject.active_tasks_count || 0}</strong>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-xs text-[var(--theme-text-muted)] block">Обновлено:</span>
                    <strong className="text-xs font-mono text-[var(--theme-text)] mt-1 block truncate">
                      {new Date(selectedProject.last_activity_at || selectedProject.last_updated || Date.now()).toLocaleTimeString()}
                    </strong>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Path Modal */}
      <Modal
        isOpen={isAddPathModalOpen}
        onClose={() => setIsAddPathModalOpen(false)}
        title="Добавить директорию проектов"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--theme-text-muted)]">
            Укажите путь к папке на диске, в которой хранятся ваши проекты и репозитории.
          </p>

          <Input
            label="Путь к директории"
            placeholder="C:\Users\user\Documents\dev"
            value={newPathInput}
            onChange={(e) => setNewPathInput(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--theme-border)]">
            <Button variant="secondary" size="sm" onClick={() => setIsAddPathModalOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddSearchPath} disabled={loading}>
              Добавить и сканировать
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
