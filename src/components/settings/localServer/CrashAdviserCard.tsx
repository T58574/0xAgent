import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface CrashAdviserCardProps {
  crashAdvice: string | null;
}

export const CrashAdviserCard: React.FC<CrashAdviserCardProps> = React.memo(({ crashAdvice }) => {
  if (!crashAdvice) return null;

  return (
    <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs flex items-start gap-2.5 animate-fadeIn">
      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
      <span className="text-[var(--theme-text)] font-medium leading-relaxed">{crashAdvice}</span>
    </div>
  );
});
