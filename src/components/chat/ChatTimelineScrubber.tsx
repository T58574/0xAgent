import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';
import { formatTimeDetailed, formatTime } from '../../utils/helpers';

interface ChatTimelineScrubberProps {
  messages: ChatMessage[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  isScrolledUp: boolean;
  onScrollToBottom: () => void;
  onScrollToTop: () => void;
  isGenerating?: boolean;
}

interface HoveredMarkerInfo {
  index: number;
  message: ChatMessage;
  yPos: number;
}

export const ChatTimelineScrubber: React.FC<ChatTimelineScrubberProps> = ({
  messages,
  containerRef,
  isScrolledUp,
  onScrollToBottom,
  onScrollToTop,
  isGenerating = false,
}) => {
  const [hoveredMarker, setHoveredMarker] = useState<HoveredMarkerInfo | null>(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState<number>(messages.length - 1);
  const railRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Filter messages that have timestamps
  const validMessages = messages.filter((m) => !!m.timestamp);

  // Track active message index on container scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (validMessages.length === 0) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollRatio = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
      const targetIndex = Math.min(
        validMessages.length - 1,
        Math.max(0, Math.floor(scrollRatio * validMessages.length))
      );
      setActiveMessageIndex(targetIndex);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [validMessages.length, containerRef]);

  const scrollToMessage = (msgId: string, index: number) => {
    const el = document.getElementById(`msg-${msgId || index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Apply pulse highlight animation
      el.classList.remove('highlight-pulse');
      // Trigger reflow to restart animation
      void el.offsetWidth;
      el.classList.add('highlight-pulse');
      setTimeout(() => {
        el.classList.remove('highlight-pulse');
      }, 1500);
    } else if (containerRef.current) {
      // Fallback ratio scroll
      const ratio = validMessages.length > 1 ? index / (validMessages.length - 1) : 1;
      containerRef.current.scrollTo({
        top: ratio * (containerRef.current.scrollHeight - containerRef.current.clientHeight),
        behavior: 'smooth',
      });
    }
  };

  const handleRailMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current || !containerRef.current || validMessages.length === 0) return;
    isDraggingRef.current = true;
    handleScrub(e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        handleScrub(moveEvent.clientY);
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleScrub = (clientY: number) => {
    if (!railRef.current || !containerRef.current || validMessages.length === 0) return;
    const rect = railRef.current.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = rect.height > 0 ? relativeY / rect.height : 0;
    
    const targetIdx = Math.min(
      validMessages.length - 1,
      Math.max(0, Math.floor(ratio * validMessages.length))
    );
    
    const targetMsg = validMessages[targetIdx];
    if (targetMsg) {
      scrollToMessage(targetMsg.id || `${targetIdx}`, targetIdx);
    }
  };

  if (validMessages.length < 2) return null;

  return (
    <div className="absolute right-1 sm:right-2.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center select-none pointer-events-auto font-mono">
      {/* 1. JUMP TO TOP BUTTON (ASCII) */}
      <button
        type="button"
        onClick={onScrollToTop}
        className="w-6 h-6 rounded-full bg-[var(--theme-panel-solid,#0a0c12)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-accent)] flex items-center justify-center shadow-lg transition-all mb-2 cursor-pointer backdrop-blur-xl group hover:scale-110 text-[10px] font-bold"
        title="К началу диалога"
      >
        ▲
      </button>

      {/* 2. VERTICAL TIMELINE RAIL */}
      <div
        ref={railRef}
        onMouseDown={handleRailMouseDown}
        className="relative w-4 py-3 flex flex-col items-center justify-between cursor-pointer rounded-full bg-black/30 hover:bg-black/50 border border-[var(--theme-border)]/40 backdrop-blur-md transition-colors"
        style={{ height: `${Math.min(320, Math.max(120, validMessages.length * 28))}px` }}
      >
        {/* Track Line */}
        <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-[2px] bg-white/10 rounded-full pointer-events-none" />

        {/* Message Markers */}
        {validMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          const isActive = idx === activeMessageIndex;
          
          let dotColorClass = 'bg-[var(--theme-text-muted)] opacity-60';
          if (isUser) {
            dotColorClass = 'bg-[var(--theme-accent)] ring-1 ring-[var(--theme-accent)]/40';
          } else if (isSystem) {
            dotColorClass = 'bg-[var(--theme-text-muted)]';
          } else {
            dotColorClass = 'bg-[var(--theme-text)] opacity-90';
          }

          return (
            <div
              key={msg.id || idx}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredMarker({
                  index: idx,
                  message: msg,
                  yPos: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setHoveredMarker(null)}
              onClick={(e) => {
                e.stopPropagation();
                scrollToMessage(msg.id || `${idx}`, idx);
              }}
              className="relative z-10 flex items-center justify-center p-1 group cursor-pointer"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${dotColorClass} ${
                  isActive ? 'scale-150 ring-2 ring-[var(--theme-accent)] shadow-[0_0_8px_var(--theme-accent-glow)]' : 'group-hover:scale-125 opacity-70 group-hover:opacity-100'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* 3. JUMP TO BOTTOM BUTTON (ASCII WITH BOUNCE ON GENERATING) */}
      <button
        type="button"
        onClick={onScrollToBottom}
        className={`w-6 h-6 rounded-full bg-[var(--theme-panel-solid,#0a0c12)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-accent)] flex items-center justify-center shadow-lg transition-all mt-2 cursor-pointer backdrop-blur-xl group hover:scale-110 text-[10px] font-bold relative ${
          isScrolledUp && isGenerating ? 'ring-2 ring-[var(--theme-accent)] animate-bounce text-[var(--theme-accent)]' : ''
        }`}
        title="Вниз к новым сообщениям"
      >
        ▼
        {isScrolledUp && isGenerating && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--theme-accent)] animate-ping" />
        )}
      </button>

      {/* 4. FLOATING RICH HOVER PREVIEW TOOLTIP */}
      {hoveredMarker && (
        <div
          className="fixed right-12 z-50 pointer-events-none transition-all duration-150 animate-fadeIn font-mono"
          style={{ top: `${hoveredMarker.yPos - 36}px` }}
        >
          <div className="w-64 p-2.5 rounded-xl bg-[var(--theme-panel-solid,#0a0c12)]/95 border border-[var(--theme-border)] shadow-2xl backdrop-blur-2xl text-[var(--theme-text)] space-y-1.5 font-mono">
            {/* Header: Role & Timestamp */}
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[var(--theme-border)]">
              <div className="flex items-center gap-1.5 font-semibold">
                {hoveredMarker.message.role === 'user' ? (
                  <>
                    <span className="px-1 py-0.2 rounded bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] text-[9px] font-bold">[USR]</span>
                    <span className="text-[var(--theme-accent)]">Вы</span>
                  </>
                ) : hoveredMarker.message.role === 'system' ? (
                  <>
                    <span className="px-1 py-0.2 rounded bg-white/10 text-[var(--theme-text-muted)] text-[9px] font-bold">[SYS]</span>
                    <span className="text-[var(--theme-text-muted)]">Система</span>
                  </>
                ) : (
                  <>
                    <span className="px-1 py-0.2 rounded bg-[var(--theme-border)] text-[var(--theme-text)] text-[9px] font-bold">[AI]</span>
                    <span className="text-[var(--theme-text)]">0xAgent</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-[var(--theme-text-muted)]">
                {formatTimeDetailed(hoveredMarker.message.timestamp) || formatTime(hoveredMarker.message.timestamp)}
              </span>
            </div>

            {/* Message Preview Text */}
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-tight line-clamp-2 select-none">
              {hoveredMarker.message.content
                ? hoveredMarker.message.content.replace(/<[^>]*>/g, '').trim() || 'Содержит вложения / вызовы...'
                : 'Сообщение...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
