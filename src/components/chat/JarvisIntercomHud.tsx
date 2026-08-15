import React, { useState, useEffect } from 'react';
import { MaterialIcon } from '../common/MaterialIcon';
import { JarvisSparkProposal } from '../../types';
import * as api from '../../services/api';

interface JarvisIntercomHudProps {
  onAcceptSpark?: (spark: JarvisSparkProposal) => void;
  onDismissSpark?: (sparkId: string) => void;
}

const ASCII_WAVE_FRAMES = [
  '░▒▓█▓▒░',
  ' ▂▃▅▆▅▃ ',
  '▃▅▇█▇▅▃',
  '▅▇███▇▅',
  '▃▅▇█▇▅▃',
  ' ▂▃▅▆▅▃ ',
  '░▒▓█▓▒░',
];

export const JarvisIntercomHud: React.FC<JarvisIntercomHudProps> = ({
  onAcceptSpark,
  onDismissSpark,
}) => {
  const [activePhrase, setActivePhrase] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [waveFrameIdx, setWaveFrameIdx] = useState<number>(0);
  const [latestSpark, setLatestSpark] = useState<JarvisSparkProposal | null>(null);

  // Animate ASCII waveform when speaking
  useEffect(() => {
    if (!isSpeaking) return;
    const timer = setInterval(() => {
      setWaveFrameIdx((prev) => (prev + 1) % ASCII_WAVE_FRAMES.length);
    }, 100);
    return () => clearInterval(timer);
  }, [isSpeaking]);

  useEffect(() => {
    let dismissTimer: any = null;

    // Listen to voice events
    const u1 = api.listen<{ text: string; audioBase64?: string; category?: string }>('jarvis_speak', (e) => {
      setActivePhrase(e.payload.text);
      setIsSpeaking(true);

      if (dismissTimer) clearTimeout(dismissTimer);
      // Automatically close overlay 4 seconds after phrase ends
      dismissTimer = setTimeout(() => {
        setIsSpeaking(false);
        setActivePhrase(null);
      }, 4500);
    });

    // Listen to incoming spark proposals
    const u2 = api.listen<JarvisSparkProposal>('jarvis_spark_proposal', (e) => {
      setLatestSpark(e.payload);
    });

    const u3 = api.listen<JarvisSparkProposal>('jarvis_spark_updated', (e) => {
      if (e.payload.status !== 'pending') {
        setLatestSpark((prev) => (prev?.id === e.payload.id ? null : prev));
      }
    });

    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      u1();
      u2();
      u3();
    };
  }, []);

  const handleStopVoice = async () => {
    setIsSpeaking(false);
    setActivePhrase(null);
    try {
      await api.stop_voice();
    } catch {
      // ignore
    }
  };

  const handleAcceptLatestSpark = () => {
    if (!latestSpark) return;
    const spark = latestSpark;
    setLatestSpark(null);
    onAcceptSpark?.(spark);
  };

  const handleDismissLatestSpark = () => {
    if (!latestSpark) return;
    const sparkId = latestSpark.id;
    setLatestSpark(null);
    onDismissSpark?.(sparkId);
  };

  // If nothing active, render nothing
  if (!isSpeaking && !latestSpark) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-none transition-all duration-300 animate-fadeIn">
      {/* 1. Voice Speech HUD Overlay */}
      {isSpeaking && activePhrase && (
        <div className="pointer-events-auto overflow-hidden rounded-2xl border border-sky-500/30 bg-[#080d18]/95 backdrop-blur-2xl p-3.5 shadow-2xl shadow-sky-950/60 mb-2 font-mono text-xs">
          {/* Header & Waveform */}
          <div className="flex items-center justify-between gap-3 mb-1.5 pb-1.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span className="text-[11px] font-bold tracking-wider text-sky-400 uppercase">
                :: [VOICE_INTERCOM]
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                [ru-RU-Dmitry]
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Animated ASCII Soundwave */}
              <div className="text-sky-300 font-bold tracking-widest text-xs select-none">
                [{ASCII_WAVE_FRAMES[waveFrameIdx]}]
              </div>

              <button
                onClick={handleStopVoice}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
                title="Остановить голос"
              >
                <MaterialIcon name="stop" className="text-xs text-rose-400" />
              </button>
            </div>
          </div>

          {/* Subtitle / Spoken Phrase */}
          <div className="text-zinc-200 text-xs font-sans tracking-wide leading-relaxed pl-1">
            <span className="text-sky-400 font-mono mr-1.5">›</span>
            {activePhrase}
          </div>
        </div>
      )}

      {/* 2. Proactive Spark / Error Toast Alert */}
      {latestSpark && !isSpeaking && (
        <div
          className={`pointer-events-auto overflow-hidden rounded-2xl border p-3.5 shadow-2xl font-mono text-xs backdrop-blur-2xl transition-all ${
            latestSpark.category === 'error_incident'
              ? 'border-rose-500/40 bg-[#14080a]/95 shadow-rose-950/60'
              : 'border-sky-500/20 bg-[#070c16]/95 shadow-sky-950/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  latestSpark.category === 'error_incident'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                }`}
              >
                <MaterialIcon
                  name={latestSpark.category === 'error_incident' ? 'bug_report' : 'bolt'}
                  className="text-xs"
                />
              </span>
              <span
                className={`text-[11px] font-bold tracking-wider uppercase ${
                  latestSpark.category === 'error_incident' ? 'text-rose-400' : 'text-sky-400'
                }`}
              >
                {latestSpark.category === 'error_incident' ? ':: [LOG_ERROR_INTERCEPTED]' : ':: [JARVIS_SPARK]'}
              </span>
            </div>

            <button
              onClick={handleDismissLatestSpark}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
              title="Скрыть"
            >
              <MaterialIcon name="close" className="text-xs" />
            </button>
          </div>

          <div className="mb-3">
            <div className="font-semibold text-zinc-100 text-xs font-sans mb-0.5">
              {latestSpark.title}
            </div>
            <div className="text-[11px] text-zinc-400 font-sans leading-normal">
              {latestSpark.description}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
            <button
              onClick={handleDismissLatestSpark}
              className="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors text-xs"
            >
              Отложить
            </button>
            <button
              onClick={handleAcceptLatestSpark}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-md shadow-sky-950/60 transition-all active:scale-95"
            >
              <MaterialIcon name="play_arrow" className="text-xs" />
              <span>{latestSpark.suggestedAction || 'В работу'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
