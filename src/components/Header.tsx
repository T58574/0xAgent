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
      {/* Top Glass Header Container (Minimal Rounding: rounded-md) */}
      <div className="w-full flex items-center glass-panel rounded-md px-3 py-1.5 text-slate-100 justify-between relative border border-white/10">
        
        {/* Brand Badge */}
        <div className="flex items-center gap-2 pl-1 pr-3 border-r border-white/10 shrink-0">
          <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Terminal size={13} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-wide text-white flex items-center gap-1.5">
              0xAgent
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
          </div>
        </div>

        {/* Create New Session Button (Flat Glass) */}
        <button
          onClick={onCreateSession}
          className="flat-btn ml-2 px-2.5 py-1 rounded text-xs font-medium text-slate-200 hover:text-white cursor-pointer shrink-0 flex items-center gap-1.5"
          title="Новая сессия"
        >
          <Plus size={13} className="text-emerald-400" />
          <span className="text-xs font-medium hidden sm:inline">Новая сессия</span>
        </button>

        {/* Left Scroll Chevron */}
        <button
          onClick={handleScrollLeft}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Horizontal Sessions List */}
        <div
          ref={scrollRef}
          className="flex-grow flex items-center gap-1.5 overflow-x-auto h-full px-2 scrollbar-none"
        >
          {sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative flex items-center gap-2 px-3 py-1 rounded text-xs cursor-pointer transition-all border shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-white font-medium border-emerald-500/40'
                    : 'bg-slate-900/40 text-slate-400 border-white/5 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-emerald-400 transition-colors" />
                <span className="truncate max-w-[130px] text-xs font-sans">{session.title}</span>
                
                {/* Delete session button */}
                <button
                  onClick={(e) => onDeleteSession(session.id, e)}
                  className="p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer ml-1"
                  title="Удалить сессию"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Scroll Chevron */}
        <button
          onClick={handleScrollRight}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 mr-1"
        >
          <ChevronRight size={15} />
        </button>

      </div>
    </div>
  );
};
