import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';
import { formatTime } from '../../utils/helpers';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();
  const [hoveredMarker, setHoveredMarker] = useState<HoveredMarkerInfo | null>(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState<number>(messages.length - 1);
  const [scrollProgress, setScrollProgress] = useState<number>(1);
  const [hasScrollableContent, setHasScrollableContent] = useState<boolean>(false);
  const railRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Filter messages that have timestamps and are not internal tool protocol messages
  const validMessages = messages.filter((m) => m.role !== 'tool' && !!m.timestamp);

  // Check if chat container actually has scrollable overflow
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScrollable = () => {
      const { scrollHeight, clientHeight, scrollTop } = container;
      const isScrollable = scrollHeight > clientHeight + 35;
      setHasScrollableContent(isScrollable);

      if (isScrollable && scrollHeight > clientHeight) {
        const progress = Math.max(0, Math.min(1, scrollTop / (scrollHeight - clientHeight)));
        setScrollProgress(progress);

        if (validMessages.length > 0) {
          const targetIndex = Math.min(
            validMessages.length - 1,
            Math.max(0, Math.floor(progress * validMessages.length))
          );
          setActiveMessageIndex(targetIndex);
        }
      }
    };

    checkScrollable();
    container.addEventListener('scroll', checkScrollable, { passive: true });
    window.addEventListener('resize', checkScrollable);

    // MutationObserver to detect new messages height changes
    const observer = new MutationObserver(checkScrollable);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      container.removeEventListener('scroll', checkScrollable);
      window.removeEventListener('resize', checkScrollable);
      observer.disconnect();
    };
  }, [validMessages.length, containerRef]);

  const scrollToMessage = (msgId: string, index: number) => {
    const el = document.getElementById(`msg-${msgId || index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Apply pulse highlight animation
      el.classList.remove('highlight-pulse');
      void el.offsetWidth;
      el.classList.add('highlight-pulse');
      setTimeout(() => {
        el.classList.remove('highlight-pulse');
      }, 1500);
    } else if (containerRef.current) {
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
    
    if (containerRef.current) {
      containerRef.current.scrollTop = ratio * (containerRef.current.scrollHeight - containerRef.current.clientHeight);
    }
  };

  // Only render scrubber when there is actual scrollable overflow
  if (!hasScrollableContent || validMessages.length < 2) return null;

  // Dynamic rail height scaled with conversation message count
  const railHeight = Math.min(420, Math.max(140, validMessages.length * 26));

  return (
    <>
      {/* Mobile Floating Jump-to-Bottom FAB Button */}
      {isScrolledUp && (
        <button
          type="button"
          onClick={onScrollToBottom}
          className={`md:hidden fixed right-3 bottom-24 z-40 w-9 h-9 rounded-full bg-[var(--theme-panel)] border border-[var(--theme-border)] text-[var(--theme-text)] flex items-center justify-center shadow-2xl transition-all cursor-pointer backdrop-blur-2xl active:scale-95 text-xs font-bold ${
            isGenerating ? 'ring-2 ring-[var(--theme-accent)] animate-bounce' : ''
          }`}
          title="Вниз к новым сообщениям"
        >
          ▼
          {isGenerating && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--theme-accent)] animate-ping" />
          )}
        </button>
      )}

      {/* Desktop Vertical Sci-Fi Timeline Scrubber */}
      <div className="hidden md:flex absolute right-2 sm:right-3.5 top-1/2 -translate-y-1/2 z-30 flex-col items-center select-none pointer-events-auto font-sans animate-fadeIn">
        {/* 1. JUMP TO TOP BUTTON */}
        <button
          type="button"
          onClick={onScrollToTop}
          className="w-7 h-7 rounded-full bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] flex items-center justify-center shadow-md transition-all mb-2 cursor-pointer backdrop-blur-2xl group hover:scale-110 text-xs font-bold"
          title="К началу диалога"
        >
          ▲
        </button>

        {/* 2. VERTICAL SCI-FI TIMELINE RAIL */}
        <div
          ref={railRef}
          onMouseDown={handleRailMouseDown}
          className="relative w-5 py-3 flex flex-col items-center justify-between cursor-pointer rounded-full bg-[var(--theme-card-bg)] border border-[var(--theme-border)] backdrop-blur-2xl shadow-lg transition-colors hover:border-[var(--theme-accent)]"
          style={{ height: `${railHeight}px` }}
        >
          {/* Track Center Guide Line */}
          <div className="absolute top-3 bottom-3 left-1/2 -translate-x-1/2 w-[2px] bg-[var(--theme-border)] rounded-full pointer-events-none" />

          {/* Dynamic Sliding Capsule Thumb Indicator */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3.5 h-6 rounded-full bg-[var(--theme-accent)] shadow-md pointer-events-none transition-all duration-75 border border-[var(--theme-accent)]"
            style={{
              top: `${Math.max(4, Math.min(railHeight - 28, scrollProgress * (railHeight - 28)))}px`,
            }}
          />

          {/* Message Anchor Points */}
          {validMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const isActive = idx === activeMessageIndex;
            
            let dotColorClass = 'bg-[var(--theme-text-muted)] opacity-60';
            if (isUser) {
              dotColorClass = 'bg-[var(--theme-accent)]';
            } else if (isSystem) {
              dotColorClass = 'bg-[var(--theme-text-muted)] opacity-40';
            } else {
              dotColorClass = 'bg-[var(--theme-text)]';
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
                className="relative z-10 flex items-center justify-center p-0.5 group cursor-pointer"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${dotColorClass} ${
                    isActive ? 'scale-150 ring-2 ring-[var(--theme-accent)]' : 'group-hover:scale-125 opacity-70 group-hover:opacity-100'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* 3. JUMP TO BOTTOM BUTTON */}
        <button
          type="button"
          onClick={onScrollToBottom}
          className={`w-7 h-7 rounded-full bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] flex items-center justify-center shadow-md transition-all mt-2 cursor-pointer backdrop-blur-2xl group hover:scale-110 text-xs font-bold relative ${
            isScrolledUp && isGenerating ? 'ring-2 ring-[var(--theme-accent)] animate-bounce' : ''
          }`}
          title="Вниз к новым сообщениям"
        >
          ▼
          {isScrolledUp && isGenerating && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--theme-accent)] animate-ping" />
          )}
        </button>

        {/* 4. FLOATING HOVER PREVIEW TOOLTIP */}
        {hoveredMarker && (
          <div
            className="fixed right-12 z-50 rounded-2xl bento-card p-3 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl text-xs max-w-xs animate-fadeIn space-y-1.5 pointer-events-none"
            style={{ top: `${hoveredMarker.yPos - 35}px` }}
          >
            <div className="flex items-center justify-between gap-3 text-[11px] border-b border-[var(--theme-border)] pb-1 font-semibold text-[var(--theme-text-muted)]">
              <span className="capitalize text-[var(--theme-text)]">
                {hoveredMarker.message.role === 'user' ? t.chat.user : t.chat.assistant}
              </span>
              <span>{formatTime(hoveredMarker.message.timestamp)}</span>
            </div>
            <p className="line-clamp-3 text-[var(--theme-text)] text-xs leading-relaxed font-normal">
              {hoveredMarker.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || `(${t.chat.toolExecution})`}
            </p>
          </div>
        )}

      </div>
    </>
  );
};
