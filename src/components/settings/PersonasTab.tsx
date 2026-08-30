import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Plus,
  Trash2,
  Save,
  Check,
  GitPullRequest,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Sparkles,
  Wrench,
  Layers,
  FileText,
  Terminal,
  Shield,
  BookOpen,
  Brain,
  MessageSquare,
  HardDrive,
} from 'lucide-react';
import {
  PersonaMetadata,
  PersonaDetail,
  ContextBreakdownReport,
} from '../../types';
import { PersonaProposalsModal } from './PersonaProposalsModal';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { SettingsHeader, SettingsSection, SettingStatCard } from './common';

interface PersonasTabProps {
  currentSessionId?: string | null;
}

export const PersonasTab: React.FC<PersonasTabProps> = ({ currentSessionId }) => {
  const { t, formatString } = useI18n();
  const { showToast } = useToast();

  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('default');
  const [personaDetail, setPersonaDetail] = useState<PersonaDetail | null>(null);

  // File editor state: 3 files (soul, user, summarizer)
  const [activeFile, setActiveFile] = useState<'soul' | 'user' | 'summarizer'>('soul');
  const [fileContent, setFileContent] = useState<string>('');
  const [summarizerPrompt, setSummarizerPrompt] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isProposalsOpen, setIsProposalsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Context Token Breakdown state
  const [tokenReport, setTokenReport] = useState<ContextBreakdownReport | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [copiedTokenCat, setCopiedTokenCat] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const hasAnyExpanded = Object.values(expandedCategories).some(Boolean);

  const toggleAllCategories = () => {
    if (!tokenReport) return;
    if (hasAnyExpanded) {
      setExpandedCategories({});
    } else {
      const all: Record<string, boolean> = {};
      tokenReport.categories.forEach((c) => {
        all[c.id] = true;
      });
      setExpandedCategories(all);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'skills':
        return <Sparkles size={14} className="text-cyan-500 shrink-0" />;
      case 'tools':
        return <Wrench size={14} className="text-sky-500 shrink-0" />;
      case 'persona':
        return <Layers size={14} className="text-purple-500 shrink-0" />;
      case 'user_profile':
        return <FileText size={14} className="text-pink-500 shrink-0" />;
      case 'environment':
        return <Terminal size={14} className="text-emerald-500 shrink-0" />;
      case 'planning':
        return <Shield size={14} className="text-amber-500 shrink-0" />;
      case 'workspace_rules':
        return <BookOpen size={14} className="text-indigo-500 shrink-0" />;
      case 'memory':
        return <Brain size={14} className="text-lime-500 shrink-0" />;
      case 'chat_history':
        return <MessageSquare size={14} className="text-zinc-400 shrink-0" />;
      default:
        return <HardDrive size={14} className="text-[var(--theme-text-muted)] shrink-0" />;
    }
  };

  const loadPersonas = async () => {
    try {
      const list = await api.get_personas();
      setPersonas(list);
      const active = list.find((p) => p.is_active) || list[0];
      if (active) {
        setActivePersonaId(active.id);
        if (!selectedPersonaId || !list.some((p) => p.id === selectedPersonaId)) {
          setSelectedPersonaId(active.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch personas:', err);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      const detail = await api.get_persona_detail(id);
      setPersonaDetail(detail);
      if (detail) {
        if (activeFile === 'soul') setFileContent(detail.soul);
        else if (activeFile === 'user') setFileContent(detail.user);
      }
    } catch (err) {
      console.error('Failed to load persona detail:', err);
    }
  };

  const loadSummarizer = async () => {
    try {
      const text = await api.get_summarizer_prompt();
      setSummarizerPrompt(text);
      if (activeFile === 'summarizer') {
        setFileContent(text);
      }
    } catch (err) {
      console.error('Failed to load summarizer prompt:', err);
    }
  };

  const fetchTokenBreakdown = useCallback(async () => {
    setIsLoadingTokens(true);
    try {
      const data = await api.get_context_breakdown(currentSessionId);
      setTokenReport(data);
    } catch (err) {
      console.error('Failed to load token breakdown:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [currentSessionId]);

  useEffect(() => {
    loadPersonas();
    loadSummarizer();
    fetchTokenBreakdown();

    const unsub = api.listen<{ activePersonaId?: string; personas: PersonaMetadata[] }>(
      'persona-changed',
      (e) => {
        if (e.payload?.personas) {
          setPersonas(e.payload.personas);
        }
        if (e.payload?.activePersonaId) {
          setActivePersonaId(e.payload.activePersonaId);
        }
      }
    );

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (selectedPersonaId) {
      loadDetail(selectedPersonaId);
    }
  }, [selectedPersonaId]);

  useEffect(() => {
    if (activeFile === 'soul' && personaDetail) {
      setFileContent(personaDetail.soul);
    } else if (activeFile === 'user' && personaDetail) {
      setFileContent(personaDetail.user);
    } else if (activeFile === 'summarizer') {
      setFileContent(summarizerPrompt);
    }
  }, [activeFile, personaDetail, summarizerPrompt]);

  const handleActivate = async (id: string) => {
    try {
      await api.activate_persona(id);
      setActivePersonaId(id);
      const p = personas.find((item) => item.id === id);
      showToast(formatString(t.toasts.personaActivated, { name: p?.name || id }), 'success');
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const created = await api.create_persona(newName.trim(), newDesc.trim());
      setIsCreateOpen(false);
      setNewName('');
      setNewDesc('');
      await loadPersonas();
      setSelectedPersonaId(created.metadata.id);
      showToast(t.toasts.personaCreated, 'success');
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  const handleSaveActiveFile = async () => {
    try {
      setIsSaving(true);
      if (activeFile === 'summarizer') {
        await api.save_summarizer_prompt(fileContent);
        setSummarizerPrompt(fileContent);
        setSaveSuccess(true);
        showToast(formatString(t.toasts.personaFileSaved, { file: 'SUMMARIZER.md' }), 'success');
      } else if (personaDetail) {
        const targetFile: 'SOUL.md' | 'USER.md' = activeFile === 'soul' ? 'SOUL.md' : 'USER.md';
        await api.save_persona_file(personaDetail.metadata.id, targetFile, fileContent);
        setSaveSuccess(true);
        showToast(
          formatString(t.toasts.personaFileSaved, { file: `${activeFile.toUpperCase()}.md` }),
          'success'
        );
        loadDetail(personaDetail.metadata.id);
      }
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'default') return;
    try {
      await api.delete_persona(id);
      await loadPersonas();
      if (selectedPersonaId === id) {
        setSelectedPersonaId('default');
      }
      showToast(t.toasts.personaDeleted, 'info');
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  const handleCopyCategory = (name: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTokenCat(name);
    setTimeout(() => setCopiedTokenCat(null), 2000);
  };

  return (
    <div className="w-full space-y-6 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header */}
      <SettingsHeader
        title={t.settings.personas.title}
        subtitle={t.settings.personas.subtitle}
        icon={<User size={18} />}
        actionSlot={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            icon={<Plus size={13} />}
          >
            {t.settings.personas.createBtn}
          </Button>
        }
      />

      {/* 2. Main Persona Workspace (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Personas Profiles List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
              {formatString(t.settings.personas.personasCount, { count: personas.length })}
            </span>
          </div>

          <div className="space-y-2">
            {personas.map((p) => {
              const isSelected = p.id === selectedPersonaId;
              const isActive = p.id === activePersonaId;
              return (
                <Card
                  key={p.id}
                  variant="interactive"
                  selected={isSelected}
                  onClick={() => setSelectedPersonaId(p.id)}
                  padded={false}
                  className="p-3.5 flex flex-col gap-1.5 rounded-2xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <User size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                      <span className="font-bold text-xs text-[var(--theme-text)] truncate">
                        {p.name}
                      </span>
                    </div>
                    {isActive && (
                      <Badge variant="accent" size="xs">
                        {t.settings.personas.activeBadge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Persona File Editor (SOUL.md / USER.md / SUMMARIZER.md) */}
        <div className="lg:col-span-8 space-y-3">
          {personaDetail ? (
            <Card variant="default" className="space-y-4 rounded-2xl">
              {/* Persona Metadata Header */}
              <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--theme-text)] truncate">
                      {personaDetail.metadata.name}
                    </h3>
                    {personaDetail.metadata.id === activePersonaId ? (
                      <Badge variant="accent" size="xs">
                        {t.settings.personas.activeBadge}
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleActivate(personaDetail.metadata.id)}
                        className="text-[10px] text-[var(--theme-accent)]"
                      >
                        {t.settings.personas.activateBtn}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">
                    {personaDetail.metadata.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsProposalsOpen(true)}
                    icon={<GitPullRequest size={13} />}
                  >
                    {t.settings.personas.evolutionStudioBtn}
                  </Button>
                  {personaDetail.metadata.id !== 'default' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(personaDetail.metadata.id)}
                      icon={<Trash2 size={13} />}
                      title={t.settings.personas.deleteTooltip}
                    />
                  )}
                </div>
              </div>

              {/* 3-Position File Switcher + Save Action */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center bg-[var(--theme-input-bg)] p-1 rounded-xl border border-[var(--theme-border)]">
                  <button
                    type="button"
                    onClick={() => setActiveFile('soul')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      activeFile === 'soul'
                        ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-xs border border-[var(--theme-border)]'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    {t.settings.personas.fileTabSoul}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFile('user')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      activeFile === 'user'
                        ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-xs border border-[var(--theme-border)]'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    {t.settings.personas.fileTabUser}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFile('summarizer')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      activeFile === 'summarizer'
                        ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-xs border border-[var(--theme-border)]'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    {t.settings.personas.fileTabSummarizer}
                  </button>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveActiveFile}
                  disabled={isSaving}
                  loading={isSaving}
                  icon={saveSuccess ? <Check size={13} className="text-emerald-500" /> : <Save size={13} />}
                >
                  {saveSuccess ? t.settings.personas.saved : t.settings.personas.save}
                </Button>
              </div>

              {/* Code / Markdown Textarea */}
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={13}
                className="w-full p-3.5 rounded-xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] border border-[var(--theme-border)] font-mono text-xs focus:outline-none focus:border-[var(--theme-accent)] resize-y leading-relaxed"
                placeholder={
                  activeFile === 'soul'
                    ? 'Personality & behavior rules for the assistant...'
                    : activeFile === 'user'
                    ? 'User profile facts and context directives...'
                    : 'Context compaction summarizer prompt...'
                }
              />
            </Card>
          ) : (
            <Card variant="default" className="p-8 text-center text-xs text-[var(--theme-text-muted)] rounded-2xl">
              {t.settings.personas.selectPersonaPrompt}
            </Card>
          )}
        </div>
      </div>

      {/* 3. Integrated Context & Token Budget Inspector */}
      {tokenReport && (
        <SettingsSection
          title={t.settings.personas.contextBreakdownTitle}
          description={t.settings.personas.contextBreakdownDesc}
          badge="Token Telemetry"
          actionSlot={
            <Button
              variant="secondary"
              size="xs"
              onClick={fetchTokenBreakdown}
              loading={isLoadingTokens}
              icon={<RefreshCw size={12} />}
            >
              {t.common.refresh}
            </Button>
          }
        >
          <Card variant="default" className="space-y-4 rounded-2xl">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SettingStatCard
                label={t.settings.customizations.available}
                value={`${tokenReport.availablePercentage}%`}
                sublabel={t.settings.customizations.limitContext}
              />

              <SettingStatCard
                label={t.settings.customizations.usedTokens}
                value={
                  <>
                    {tokenReport.totalUsed.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-[var(--theme-text-muted)]">
                      / {tokenReport.totalBudget.toLocaleString()}
                    </span>
                  </>
                }
                sublabel={t.settings.customizations.systemInst}
              />

              <SettingStatCard
                label={t.settings.customizations.categoriesCount}
                value={tokenReport.categories.length}
                sublabel={t.settings.customizations.activeDirectives}
              />
            </div>

            {/* Segmented Color Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-[var(--theme-input-bg)] overflow-hidden flex items-center p-0.5 border border-[var(--theme-border)]">
              {tokenReport.categories.map((cat) => {
                const widthPercent = Math.max(0.6, (cat.tokens / tokenReport.totalBudget) * 100);
                return (
                  <div
                    key={cat.id}
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: cat.color,
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 cursor-pointer hover:brightness-125"
                    onClick={() => toggleCategory(cat.id)}
                    title={`${cat.name}: ${cat.tokens.toLocaleString()} tok (${cat.percentage}%)`}
                  />
                );
              })}
            </div>

            {/* Category Badges Grid + Toggle All Button */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {tokenReport.categories.map((cat) => {
                    const isExpanded = Boolean(expandedCategories[cat.id]);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                          isExpanded
                            ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] font-bold'
                            : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)]'
                        }`}
                        title="Click to view directive breakdown"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span>{cat.name}</span>
                        <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                          {cat.tokens.toLocaleString()} tok
                        </span>
                        {isExpanded ? (
                          <ChevronDown size={11} className="text-[var(--theme-accent)] ml-0.5" />
                        ) : (
                          <ChevronRight size={11} className="text-[var(--theme-text-muted)] ml-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={toggleAllCategories}
                  className="text-xs font-semibold text-[var(--theme-accent)] hover:underline flex items-center gap-1 cursor-pointer select-none ml-auto shrink-0"
                >
                  <span>
                    {hasAnyExpanded
                      ? t.settings.customizations.collapseCategories
                      : formatString(t.settings.customizations.showAllCategories, {
                          count: tokenReport.categories.length,
                        })}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${hasAnyExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {/* Detailed Breakdown Accordion Items */}
              {tokenReport.categories.some((c) => expandedCategories[c.id]) && (
                <div className="space-y-2 pt-2 border-t border-[var(--theme-border)]">
                  {tokenReport.categories
                    .filter((c) => expandedCategories[c.id])
                    .map((cat) => {
                      const hasDetails = cat.details && cat.details.length > 0;
                      return (
                        <div
                          key={cat.id}
                          className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)] p-3.5 space-y-2.5 animate-fadeIn"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {getCategoryIcon(cat.category)}
                              <span className="text-xs font-bold text-[var(--theme-text)] truncate">
                                {cat.name}
                              </span>
                              {cat.scope && (
                                <Badge variant="neutral" size="xs">
                                  {cat.scope}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono font-semibold text-[var(--theme-text)]">
                                {cat.tokens.toLocaleString()} tok
                              </span>
                              <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                                ({cat.percentage}%)
                              </span>
                            </div>
                          </div>

                          {cat.description && (
                            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                              {cat.description}
                            </p>
                          )}

                          {/* Detail Items List */}
                          {hasDetails && (
                            <div className="space-y-1.5 pt-1">
                              {cat.details!.map((detail) => (
                                <div
                                  key={detail.id}
                                  className="p-2.5 rounded-lg bg-[var(--theme-card-bg)] border border-[var(--theme-border)] flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 space-y-0.5 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold font-mono text-[var(--theme-text)]">
                                        {detail.name}
                                      </span>
                                      {detail.scope && (
                                        <Badge variant="neutral" size="xs">
                                          {detail.scope}
                                        </Badge>
                                      )}
                                      {detail.enabled !== undefined && (
                                        <Badge
                                          variant={detail.enabled ? 'success' : 'neutral'}
                                          size="xs"
                                        >
                                          {detail.enabled ? 'Active' : 'Off'}
                                        </Badge>
                                      )}
                                    </div>
                                    {detail.description && (
                                      <p className="text-[10px] text-[var(--theme-text-muted)] line-clamp-1">
                                        {detail.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                                      {detail.tokens.toLocaleString()} tok
                                    </span>
                                    {detail.preview && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCategory(detail.id, detail.preview!)}
                                        className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                                        title={t.common.copy}
                                      >
                                        {copiedTokenCat === detail.id ? (
                                          <Check size={12} className="text-emerald-500" />
                                        ) : (
                                          <Copy size={12} />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Raw Content Preview if available and no structured details */}
                          {!hasDetails && cat.contentPreview && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text-muted)]">
                                  {t.settings.customizations.contentPreview}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCategory(cat.id, cat.contentPreview!)}
                                  className="text-[10px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedTokenCat === cat.id ? (
                                    <>
                                      <Check size={11} className="text-emerald-500" />
                                      <span className="text-emerald-500">{t.common.copied}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} />
                                      <span>{t.common.copy}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-2.5 rounded-lg bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-[var(--theme-border)] select-text leading-relaxed">
                                {cat.contentPreview}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </Card>
        </SettingsSection>
      )}

      {/* 4. Create New Persona Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t.settings.personas.newPersonaTitle}
        subtitle={t.settings.personas.newPersonaSubtitle}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              {t.settings.personas.cancelBtn}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCreate}>
              {t.settings.personas.createConfirmBtn}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3.5">
          <Input
            label={t.settings.personas.personaNameLabel}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.settings.personas.personaNamePlaceholder}
            required
            autoFocus
          />

          <Input
            label={t.settings.personas.personaDescLabel}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={t.settings.personas.personaDescPlaceholder}
          />
        </form>
      </Modal>

      {/* 5. Evolution & Proposals Studio Modal */}
      {personaDetail && (
        <PersonaProposalsModal
          isOpen={isProposalsOpen}
          onClose={() => setIsProposalsOpen(false)}
          persona={personaDetail.metadata}
          onPersonaUpdated={() => loadDetail(personaDetail.metadata.id)}
        />
      )}
    </div>
  );
};

