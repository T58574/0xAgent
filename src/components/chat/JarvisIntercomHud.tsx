import React, { useState, useEffect } from 'react';
import { MaterialIcon } from '../common/MaterialIcon';
import * as api from '../../services/api';

const ASCII_WAVE_FRAMES = [
  '░▒▓█▓▒░',
  ' ▂▃▅▆▅▃ ',
  '▃▅▇█▇▅▃',
  '▅▇███▇▅',
  '▃▅▇█▇▅▃',
  ' ▂▃▅▆▅▃ ',
  '░▒▓█▓▒░',
];

export const JarvisIntercomHud: React.FC = () => {
  const [activePhrase, setActivePhrase] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [waveFrameIdx, setWaveFrameIdx] = useState<number>(0);

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
      // Automatically close overlay 4.5 seconds after phrase ends
      dismissTimer = setTimeout(() => {
        setIsSpeaking(false);
        setActivePhrase(null);
      }, 4500);
    });

    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      u1();
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

  // If nothing active, render nothing
  if (!isSpeaking || !activePhrase) return null;

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
    </div>
  );
};
