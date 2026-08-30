import React from 'react';
import {
  User,
  Trash2,
  Save,
  Check,
  CheckCircle2,
  Plus,
  Bot,
} from 'lucide-react';
import { PersonaMetadata, PersonaDetail } from '../../../types';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';

interface PersonaEditorSectionProps {
  personas: PersonaMetadata[];
  activePersonaId: string;
  selectedPersonaId: string;
  personaDetail: PersonaDetail | null;
  activeFile: 'soul' | 'user';
  fileContent: string;
  isSaving: boolean;
  saveSuccess: boolean;
  onSelectPersona: (id: string) => void;
  onActivatePersona: (id: string) => void;
  onDeletePersona: (id: string) => void;
  onChangeActiveFile: (file: 'soul' | 'user') => void;
  onChangeFileContent: (content: string) => void;
  onSaveActiveFile: () => void;
  onCreatePersonaClick?: () => void;
}

export const PersonaEditorSection: React.FC<PersonaEditorSectionProps> = ({
  personas,
  activePersonaId,
  selectedPersonaId,
  personaDetail,
  activeFile,
  fileContent,
  isSaving,
  saveSuccess,
  onSelectPersona,
  onActivatePersona,
  onDeletePersona,
  onChangeActiveFile,
  onChangeFileContent,
  onSaveActiveFile,
  onCreatePersonaClick,
}) => {
  const { t, formatString } = useI18n();

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Personas Profiles List */}
        <div className="md:col-span-5 lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
              {formatString(t.settings.personas.personasCount, { count: personas.length })}
            </span>
            {personas.length > 0 && onCreatePersonaClick && (
              <button
                type="button"
                onClick={onCreatePersonaClick}
                className="text-[11px] font-semibold text-[var(--theme-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>{t.settings.personas.createBtn}</span>
              </button>
            )}
          </div>

          <div className="space-y-3 p-1 pb-4">
            {personas.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card-bg)] text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center mx-auto">
                  <Bot size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[var(--theme-text)]">
                    {t.settings.personas.noPersonasTitle || 'Нет созданных личностей'}
                  </h4>
                  <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                    {t.settings.personas.noPersonasDesc || 'Список чист. Создайте новую личность, чтобы задать индивидуальный характер и правила.'}
                  </p>
                </div>
                {onCreatePersonaClick && (
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={onCreatePersonaClick}
                    icon={<Plus size={12} />}
                    className="w-full justify-center text-xs"
                  >
                    {t.settings.personas.createBtn}
                  </Button>
                )}
              </div>
            ) : (
              personas.map((p) => {
                const isSelected = p.id === selectedPersonaId;
                const isActive = p.id === activePersonaId;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPersona(p.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer select-none space-y-2 ${
                      isSelected
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] shadow-sm ring-1 ring-[var(--theme-accent)]/30'
                        : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:border-[var(--theme-border)]/80 hover:bg-[var(--theme-border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <User size={14} className={isSelected ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
                        <span className="font-bold text-xs text-[var(--theme-text)] truncate">
                          {p.name}
                        </span>
                      </div>
                      {isActive ? (
                        <Badge variant="accent" size="xs">
                          {t.settings.personas.activeBadge}
                        </Badge>
                      ) : (
                        isSelected && (
                          <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                            Выбрана
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-[11.5px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Persona File Editor (SOUL.md / USER.md) */}
        <div className="md:col-span-7 lg:col-span-8 space-y-3">
          {personaDetail ? (
            <Card variant="default" className="p-6 space-y-5 rounded-2xl">
              {/* Persona Metadata Header */}
              <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-4 gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[var(--theme-text)] truncate">
                      {personaDetail.metadata.name}
                    </h3>
                    {personaDetail.metadata.id === activePersonaId ? (
                      <Badge variant="accent" size="xs">
                        <CheckCircle2 size={11} className="mr-1 inline" />
                        {t.settings.personas.activeBadge}
                      </Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => onActivatePersona(personaDetail.metadata.id)}
                        className="text-[11px]"
                      >
                        {t.settings.personas.activateBtn}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                    {personaDetail.metadata.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDeletePersona(personaDetail.metadata.id)}
                    icon={<Trash2 size={13} />}
                    title={t.settings.personas.deleteTooltip}
                  />
                </div>
              </div>

              {/* 2-Position File Switcher (SOUL.md / USER.md) + Save Action */}
              <div className="flex items-center justify-between gap-3 flex-wrap py-0.5">
                <div className="flex items-center bg-[var(--theme-input-bg)] p-1 rounded-xl border border-[var(--theme-border)] gap-0.5">
                  <button
                    type="button"
                    onClick={() => onChangeActiveFile('soul')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      activeFile === 'soul'
                        ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-xs border border-[var(--theme-border)]'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    {t.settings.personas.fileTabSoul}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeActiveFile('user')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      activeFile === 'user'
                        ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-xs border border-[var(--theme-border)]'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    {t.settings.personas.fileTabUser}
                  </button>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onSaveActiveFile}
                  disabled={isSaving}
                  loading={isSaving}
                  icon={saveSuccess ? <Check size={13} className="text-emerald-500" /> : <Save size={13} />}
                >
                  {saveSuccess ? t.settings.personas.saved : t.settings.personas.save}
                </Button>
              </div>

              {/* Code / Markdown Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                    {activeFile === 'soul' ? 'Инструкции характера и тональности (SOUL.md)' : 'Факты о пользователе и предпочтения (USER.md)'}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                    {fileContent.length} симв.
                  </span>
                </div>
                <textarea
                  value={fileContent}
                  onChange={(e) => onChangeFileContent(e.target.value)}
                  rows={14}
                  className="w-full p-4 sm:p-5 rounded-2xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] border border-[var(--theme-border)] font-mono text-xs focus:outline-none focus:border-[var(--theme-accent)] resize-y leading-relaxed min-h-[340px]"
                  placeholder={
                    activeFile === 'soul'
                      ? 'Personality & behavior rules for the assistant (SOUL.md)...'
                      : 'User profile facts and context directives (USER.md)...'
                  }
                />
              </div>
            </Card>
          ) : (
            <Card variant="default" className="p-10 text-center text-xs text-[var(--theme-text-muted)] rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] flex items-center justify-center mx-auto">
                <User size={18} />
              </div>
              <p>{t.settings.personas.selectPersonaPrompt}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
