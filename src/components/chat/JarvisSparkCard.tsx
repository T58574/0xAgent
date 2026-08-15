import React from 'react';
import { JarvisSparkProposal } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';

interface JarvisSparkCardProps {
  spark: JarvisSparkProposal;
  onAccept: (spark: JarvisSparkProposal) => void;
  onDismiss: (id: string) => void;
  onSpeak?: (text: string) => void;
}

export const JarvisSparkCard: React.FC<JarvisSparkCardProps> = ({
  spark,
  onAccept,
  onDismiss,
  onSpeak,
}) => {
  if (spark.status !== 'pending') return null;

  const getCategoryLabel = (category: JarvisSparkProposal['category']) => {
    switch (category) {
      case 'feature_spark':
        return 'Идея фичи';
      case 'code_polish':
        return 'Оптимизация';
      case 'exploration':
        return 'Исследование';
      case 'friendly_checkin':
        return 'Напарник';
      default:
        return 'Предложение';
    }
  };

  const getCategoryIcon = (category: JarvisSparkProposal['category']) => {
    switch (category) {
      case 'feature_spark':
        return 'bolt';
      case 'code_polish':
        return 'auto_fix_high';
      case 'exploration':
        return 'explore';
      case 'friendly_checkin':
        return 'support_agent';
      default:
        return 'lightbulb';
    }
  };

  return (
    <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-4 my-3 shadow-2xl transition-all hover:border-white/20">
      {/* Top Tag & Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <MaterialIcon name={getCategoryIcon(spark.category)} className="text-sm" />
          </span>
          <span className="text-xs font-mono font-medium tracking-wide uppercase text-sky-400/90">
            :: {getCategoryLabel(spark.category)}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {new Date(spark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <button
          onClick={() => onDismiss(spark.id)}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          title="Скрыть предложение"
        >
          <MaterialIcon name="close" className="text-sm" />
        </button>
      </div>

      {/* Main Content */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-zinc-100 tracking-tight mb-1">
          {spark.title}
        </h4>
        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
          {spark.description}
        </p>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
        <div className="flex items-center gap-2">
          {spark.voicePhrase && onSpeak && (
            <button
              onClick={() => onSpeak(spark.voicePhrase!)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs transition-colors"
              title="Послушать реплику Джарвиса"
            >
              <MaterialIcon name="volume_up" className="text-xs text-sky-400" />
              <span>Послушать</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDismiss(spark.id)}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors font-mono"
          >
            Отложить
          </button>
          <button
            onClick={() => onAccept(spark)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-md shadow-sky-950/50 transition-all active:scale-95"
          >
            <MaterialIcon name="play_arrow" className="text-xs" />
            <span>{spark.suggestedAction || 'В работу'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
