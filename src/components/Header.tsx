import React, { useRef } from 'react';
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ChatSession } from '../types';

interface HeaderProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
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
      scrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full max-w-4xl flex items-center justify-center pt-2 pb-4 select-none z-30">
      {/* Centered top session pill container */}
      <div className="w-full flex items-center border border-theme-border rounded-full px-3 py-1.5 bg-theme-bg text-theme-text relative justify-between">
        
        {/* Create Session Button (Plus in Circle) */}
        <button
          onClick={onCreateSession}
          className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center hover:bg-theme-active text-theme-text cursor-pointer shrink-0 transition-colors focus:outline-none"
          title="New Session"
        >
          <Plus size={16} />
        </button>

        {/* Left Scroll Chevron */}
        <button
          onClick={handleScrollLeft}
          className="p-1 rounded-full hover:bg-theme-active text-theme-text transition-colors cursor-pointer shrink-0 ml-1.5 focus:outline-none"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Horizontal Sessions list */}
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
                className={`group relative flex items-center gap-2 px-4 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors border shrink-0 ${
                  isActive
                    ? 'border-theme-border bg-theme-active text-theme-text font-bold'
                    : 'border-theme-border bg-theme-bg text-theme-text opacity-70 hover:opacity-100 hover:bg-theme-active'
                }`}
              >
                <span className="truncate max-w-[120px]">{session.title}</span>
                
                {/* Delete button, show on hover */}
                <button
                  onClick={(e) => onDeleteSession(session.id, e)}
                  className="p-0.5 rounded-full hover:bg-neutral-200 text-neutral-450 hover:text-black transition-colors opacity-0 group-hover:opacity-100 cursor-pointer focus:outline-none"
                  title="Delete Session"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Scroll Chevron */}
        <button
          onClick={handleScrollRight}
          className="p-1 rounded-full hover:bg-theme-active text-theme-text transition-colors cursor-pointer shrink-0 mr-1.5 focus:outline-none"
        >
          <ChevronRight size={16} />
        </button>

      </div>
    </div>
  );
};
