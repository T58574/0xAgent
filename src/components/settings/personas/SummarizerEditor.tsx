import React from 'react';
import { Save, FileText } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

interface SummarizerEditorProps {
  summarizerPrompt: string;
  setSummarizerPrompt: (val: string) => void;
  onSave: () => void;
  saving: boolean;
}

export const SummarizerEditor: React.FC<SummarizerEditorProps> = ({
  summarizerPrompt,
  setSummarizerPrompt,
  onSave,
  saving,
}) => {
  return (
    <Card variant="default" className="space-y-4 font-sans text-[var(--theme-text)]">
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3 gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
            <FileText size={16} className="text-[var(--theme-text-muted)]" />
            <span>Промпт Фонового Суммаризатора Контекста</span>
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">
            Этот системный промпт используется когда диалог превышает лимит контекста и сжимается в фоновом режиме.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          disabled={saving}
          loading={saving}
          icon={<Save size={13} />}
        >
          {saving ? 'Сохранение...' : 'Сохранить промпт'}
        </Button>
      </div>

      <textarea
        value={summarizerPrompt}
        onChange={(e) => setSummarizerPrompt(e.target.value)}
        rows={16}
        className="w-full p-3.5 rounded-xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] border border-[var(--theme-border)] font-mono text-xs focus:outline-none focus:border-[var(--theme-accent)] resize-y leading-relaxed"
        placeholder="Промпт для сжатия диалога..."
      />
    </Card>
  );
};
