import React, { useCallback, useEffect, useState } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizableSplitterProps {
  onResize: (newLeftWidthPercent: number) => void;
  minPercent?: number;
  maxPercent?: number;
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  onResize,
  minPercent = 20,
  maxPercent = 80,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const windowWidth = window.innerWidth;
      if (windowWidth <= 0) return;
      const mouseX = e.clientX;
      let newPercent = (mouseX / windowWidth) * 100;
      if (newPercent < minPercent) newPercent = minPercent;
      if (newPercent > maxPercent) newPercent = maxPercent;
      onResize(newPercent);
    },
    [isDragging, minPercent, maxPercent, onResize]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`w-3.5 h-full relative cursor-col-resize select-none flex items-center justify-center shrink-0 z-20 group transition-all my-auto px-0.5`}
      title="Потяните, чтобы изменить ширину окон"
    >
      <div className={`w-1.5 h-12 rounded-full transition-all flex items-center justify-center border border-[var(--theme-border)] ${
        isDragging
          ? 'bg-[var(--theme-accent)] shadow-md scale-y-125'
          : 'bg-[var(--theme-card-bg)] group-hover:bg-[var(--theme-accent)] group-hover:scale-y-115'
      }`}>
        <GripVertical size={10} className="text-[var(--theme-accent-text)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};
