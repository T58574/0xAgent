import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Save,
  Terminal,
  Shield,
  Wrench,
  Brain,
  Layers,
} from 'lucide-react';
import { SystemPromptItem } from '../../../types';
import * as api from '../../../services/api';
import { useI18n } from '../../../i18n';
import { useToast } from '../../../context/ToastContext';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';

interface SystemPromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemPromptsModal: React.FC<SystemPromptsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [prompts, setPrompts] = useState<SystemPromptItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('summarizer');
  const [activeContent, setActiveContent] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadPrompts = async () => {
    try {
      const list = await api.get_system_prompts();
      setPrompts(list);
      const current = list.find((p) => p.id === selectedId) || list[0];
      if (current) {
        setSelectedId(current.id);
        setActiveContent(current.content);
      }
    } catch (err: any) {
      console.error('Failed to load system prompts:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPrompts();
    }
  }, [isOpen]);

  const handleSelectPrompt = (id: string) => {
    setSelectedId(id);
    const p = prompts.find((item) => item.id === id);
    if (p) {
      setActiveContent(p.content);
    }
  };

  const handleCopy = async () => {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      showToast(t.settings.personas.promptCopied || 'Промпт скопирован в буфер', 'info');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleSave = async () => {
    const p = prompts.find((item) => item.id === selectedId);
    if (!p || !p.editable) return;

    try {
      setIsSaving(true);
      if (p.id === 'summarizer') {
        await api.save_summarizer_prompt(activeContent);
      }
      setSaveSuccess(true);
      showToast(t.settings.personas.saved || 'Промпт успешно сохранен', 'success');
      setTimeout(() => setSaveSuccess(false), 2000);
      await loadPrompts();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const activePrompt = prompts.find((item) => item.id === selectedId) || prompts[0];

  const getPromptIcon = (id: string) => {
    switch (id) {
      case 'summarizer':
        return <Layers size={14} />;
      case 'tools':
        return <Wrench size={14} />;
      case 'directives':
        return <Terminal size={14} />;
      case 'memory_worker':
        return <Brain size={14} />;
      case 'regression_guard':
        return <Shield size={14} />;
      default:
        return <FileCode size={14} />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.settings.personas.systemPromptsTitle || 'Системные промпты проекта'}
      subtitle={t.settings.personas.systemPromptsSubtitle || 'Встроенные инструкции суммаризатора, инструментов и правил ядра'}
      maxWidth="xl"
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-[11px] text-[var(--theme-text-muted)] font-mono">
            {activePrompt ? `${activeContent.length} симв. (~${Math.round(activeContent.length / 4)} токенов)` : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t.settings.personas.cancelBtn}
            </Button>
            {activePrompt?.editable && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                loading={isSaving}
                icon={saveSuccess ? <Check size={13} /> : <Save size={13} />}
              >
                {saveSuccess ? t.settings.personas.saved : t.settings.personas.save}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 font-sans">
        {/* Navigation Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--theme-border)]">
          {prompts.map((p) => {
            const isSelected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPrompt(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                  isSelected
                    ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
                    : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                }`}
              >
                <span className={isSelected ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'}>
                  {getPromptIcon(p.id)}
                </span>
                <span>{p.name}</span>
                {p.editable && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    edit
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Prompt Header & Info */}
        {activePrompt && (
          <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)]">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-[var(--theme-text)]">
                  {activePrompt.title}
                </h4>
                <Badge variant={activePrompt.editable ? 'accent' : 'neutral'} size="xs">
                  {activePrompt.editable ? 'Настраиваемый' : 'Системный (Read-only)'}
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                {activePrompt.description}
              </p>
            </div>

            <Button
              variant="secondary"
              size="xs"
              onClick={handleCopy}
              icon={copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              className="shrink-0 text-xs"
            >
              {copied ? t.settings.personas.promptCopied || 'Скопировано' : t.settings.personas.copyPrompt || 'Копировать'}
            </Button>
          </div>
        )}

        {/* Code / Markdown Content Box */}
        <div className="relative rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-code-bg)] overflow-hidden">
          {activePrompt?.editable ? (
            <textarea
              value={activeContent}
              onChange={(e) => setActiveContent(e.target.value)}
              rows={16}
              className="w-full p-4 font-mono text-xs text-[var(--theme-code-text)] bg-transparent resize-y focus:outline-none leading-relaxed min-h-[360px]"
              placeholder="System prompt content..."
            />
          ) : (
            <pre className="w-full p-4 font-mono text-xs text-[var(--theme-code-text)] whitespace-pre-wrap overflow-auto max-h-[380px] leading-relaxed select-text">
              {activeContent}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
};
