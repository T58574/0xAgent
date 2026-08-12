import React from 'react';
import { Save, FileText } from 'lucide-react';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileText size={16} className="text-purple-400" />
            <span>Промпт Фонового Суммаризатора Контекста</span>
          </h3>
          <p className="text-xs text-slate-400">
            Этот системный промпт используется когда диалог превышает лимит контекста и сжимается в фоновом режиме.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flat-btn px-4 py-2 rounded-xl text-xs font-bold text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
        >
          <Save size={14} />
          <span>{saving ? 'Сохранение...' : 'Сохранить промпт'}</span>
        </button>
      </div>

      <textarea
        value={summarizerPrompt}
        onChange={(e) => setSummarizerPrompt(e.target.value)}
        rows={16}
        className="w-full p-4 rounded-xl flat-input font-mono text-xs text-slate-200 focus:outline-none leading-relaxed"
        placeholder="Промпт для сжатия диалога..."
      />
    </div>
  );
};
