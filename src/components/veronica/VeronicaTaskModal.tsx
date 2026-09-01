import React, { useState, useEffect } from 'react';
import {
  Rocket,
  FolderGit2,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Modal, Button, Select } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useI18n } from '../../i18n';
import * as api from '../../services/api';

interface VeronicaTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProject?: string;
  onTaskSpawned?: (task: any) => void;
}

export const VeronicaTaskModal: React.FC<VeronicaTaskModalProps> = ({
  isOpen,
  onClose,
  defaultProject,
  onTaskSpawned,
}) => {
  const { showToast } = useToast();
  const { language } = useI18n();

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(defaultProject || '');
  const [skill, setSkill] = useState<string>('custom_task');
  const [prompt, setPrompt] = useState<string>('');
  const [autonomyLevel, setAutonomyLevel] = useState<'L1' | 'L2' | 'L3'>('L2');
  const [selectedModel, setSelectedModel] = useState<string>('inherit');
  const [availableModels, setAvailableModels] = useState<{ local: string[]; antigravity: any[] }>({
    local: [],
    antigravity: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [spawning, setSpawning] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    Promise.all([
      api.get_veronica_projects().catch(() => ({ projects: [] })),
      api.get_veronica_models().catch(() => ({ local: [], antigravity: [] })),
    ])
      .then(([projRes, modelsRes]) => {
        setProjects(projRes.projects || []);
        setAvailableModels(modelsRes || { local: [], antigravity: [] });
        if (!selectedProject && projRes.projects?.length > 0) {
          setSelectedProject(defaultProject || projRes.projects[0].name);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, defaultProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      showToast(language === 'ru' ? 'Выберите целевой проект' : 'Select a target project', 'warning');
      return;
    }
    if (!prompt.trim()) {
      showToast(language === 'ru' ? 'Введите описание задачи' : 'Enter task description', 'warning');
      return;
    }

    setSpawning(true);
    try {
      const res = await api.spawn_veronica_task({
        project: selectedProject,
        skill,
        custom_prompt: prompt.trim(),
        autonomy_level: autonomyLevel,
        model: selectedModel !== 'inherit' ? selectedModel : undefined,
      });

      if (res.success && res.task) {
        showToast(
          language === 'ru'
            ? `Задача [${res.task.id.substring(0, 8)}] успешно поставлена на ${selectedProject}`
            : `Task [${res.task.id.substring(0, 8)}] launched on ${selectedProject}`,
          'success'
        );
        onTaskSpawned?.(res.task);
        onClose();
        setPrompt('');
      } else {
        showToast(language === 'ru' ? 'Не удалось запустить задачу' : 'Failed to launch task', 'error');
      }
    } catch (err: any) {
      showToast(`Ошибка запуска: ${err?.message || err}`, 'error');
    } finally {
      setSpawning(false);
    }
  };

  const skillOptions = [
    { value: 'custom_task', label: language === 'ru' ? '⚡ Произвольная разработка / фича' : '⚡ Custom Feature Implementation' },
    { value: 'code_review', label: language === 'ru' ? '🔍 Аудит кода и архитектуры' : '🔍 Code & Architecture Review' },
    { value: 'security_audit', label: language === 'ru' ? '🛡️ Проверка безопасности (Security)' : '🛡️ Security Audit' },
    { value: 'refactor', label: language === 'ru' ? '🧹 Рефакторинг и оптимизация' : '🧹 Refactoring & Optimization' },
    { value: 'frontend_enhancement', label: language === 'ru' ? '🎨 Улучшение интерфейса / UI' : '🎨 Frontend / UI Enhancement' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ru' ? 'Вероника :: Постановка автономной задачи' : 'Veronica :: Launch Autonomous Task'}
      subtitle={
        language === 'ru'
          ? 'Задача будет автоматически скомпилирована в 4-фазный промпт с паспортом проекта и регламентом CLI'
          : 'Task will be compiled with project passport, acceptance criteria, and CLI protocol'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Project Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FolderGit2 size={14} className="text-[var(--theme-accent)]" />
              <span>{language === 'ru' ? 'Целевой проект' : 'Target Project'}</span>
            </span>
            {projects.length > 0 && (
              <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                {projects.length} {language === 'ru' ? 'найдено' : 'discovered'}
              </span>
            )}
          </label>
          <Select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            options={projects.map((p) => ({
              value: p.name,
              label: `${p.name} (${p.autonomy_level || 'L2'})`,
            }))}
            disabled={loading || spawning}
          />
        </div>

        {/* Skill Type Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
            <Layers size={14} className="text-[var(--theme-accent)]" />
            <span>{language === 'ru' ? 'Тип операции (Skill)' : 'Operation Skill'}</span>
          </label>
          <Select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            options={skillOptions}
            disabled={spawning}
          />
        </div>

        {/* Task Prompt / Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Zap size={14} className="text-[var(--theme-accent)]" />
              <span>{language === 'ru' ? 'Техническое задание / Промпт' : 'Task Prompt / Requirements'}</span>
            </span>
            <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
              {language === 'ru' ? 'One-Prompt Architecture' : 'Single Autonomous Prompt'}
            </span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              language === 'ru'
                ? 'Например: Реализуй переключатель темы со звуковыми эффектами, добавь unit-тесты и проверь сборку.'
                : 'e.g. Implement dark mode toggle with sound effects, add unit tests, and verify build.'
            }
            rows={4}
            className="w-full rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] p-3 text-xs focus:outline-none focus:border-[var(--theme-accent)] transition-all resize-none font-sans scrollbar-thin"
            disabled={spawning}
          />
        </div>

        {/* Grid Settings: Autonomy & Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Autonomy Level */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>{language === 'ru' ? 'Уровень автономности' : 'Autonomy Level'}</span>
            </label>
            <Select
              value={autonomyLevel}
              onChange={(e) => setAutonomyLevel(e.target.value as any)}
              options={[
                { value: 'L1', label: 'L1: Audit & Read-only' },
                { value: 'L2', label: 'L2: Edit Code (Recommended)' },
                { value: 'L3', label: 'L3: Full Auto (Commit & Git)' },
              ]}
              disabled={spawning}
            />
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
              <Cpu size={14} className="text-indigo-400" />
              <span>{language === 'ru' ? 'Модель Antigravity' : 'Antigravity Model'}</span>
            </label>
            <Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              options={[
                { value: 'inherit', label: language === 'ru' ? 'По умолчанию (из настроек)' : 'Inherit (From Config)' },
                ...availableModels.antigravity.map((m) => ({
                  value: m.slug,
                  label: m.name,
                })),
              ]}
              disabled={spawning}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--theme-border)]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={spawning}
          >
            {language === 'ru' ? 'Отмена' : 'Cancel'}
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={spawning || !prompt.trim() || !selectedProject}
            className="flex items-center gap-2"
          >
            <Rocket size={14} />
            <span>
              {spawning
                ? language === 'ru'
                  ? 'Запуск задачи...'
                  : 'Spawning Task...'
                : language === 'ru'
                ? 'Запустить агента'
                : 'Launch Agent'}
            </span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
