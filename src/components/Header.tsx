import React, { useRef } from 'react';
import { X, Plus, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';
import { ChatSession } from '../types';

interface HeaderProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -180, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 180, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex items-center justify-between select-none z-30 font-sans">
      {/* Centered Top Floating Glass Header Container */}
      <div className="w-full flex items-center glass-panel rounded-2xl px-3 py-2 text-theme-text justify-between shadow-2xl relative border border-white/10">
        
        {/* Brand/App Title Badge */}
        <div className="flex items-center gap-2 pl-1 pr-3 border-r border-white/10 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <Terminal size={14} />
          </div>
          <div className="flex flex-col">
            <span className="font-hud text-xs font-bold tracking-wider text-white uppercase flex items-center gap-1.5">
              0xAgent
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            </span>
            <span className="text-[9px] font-mono text-slate-400 tracking-tight">LOCAL AI AGENT</span>
          </div>
        </div>

        {/* Create New Session Button (Tactile Skeuomorphic) */}
        <button
          onClick={onCreateSession}
          className="skeuo-btn ml-2.5 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer shrink-0"
          title="New Session (Ctrl+N)"
        >
          <Plus size={14} className="text-emerald-400" />
          <span className="text-[11px] font-hud uppercase tracking-wider hidden sm:inline">Новая сессия</span>
        </button>

        {/* Left Scroll Chevron */}
        <button
          onClick={handleScrollLeft}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-1 focus:outline-none"
          title="Scroll Left"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Horizontal Sessions List */}
        <div
          ref={scrollRef}
          className="flex-grow flex items-center gap-2 overflow-x-auto h-full px-2 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all border shrink-0 ${
                  isActive
                    ? 'bg-slate-800/90 text-white font-semibold border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                    : 'bg-slate-900/40 text-slate-400 border-white/5 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-indigo-400 transition-colors" />
                <span className="truncate max-w-[130px] font-mono text-[11px]">{session.title}</span>
                
                {/* Delete button, show on hover */}
                <button
                  onClick={(e) => onDeleteSession(session.id, e)}
                  className="p-0.5 rounded-md hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer focus:outline-none ml-1"
                  title="Delete Session"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Scroll Chevron */}
        <button
          onClick={handleScrollRight}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 mr-1 focus:outline-none"
          title="Scroll Right"
        >
          <ChevronRight size={16} />
        </button>

      </div>
    </div>
  );
};
