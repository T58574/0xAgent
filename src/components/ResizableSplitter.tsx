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
      className={`w-2.5 h-full relative cursor-col-resize select-none flex items-center justify-center shrink-0 z-20 group transition-colors ${
        isDragging ? 'bg-white/20' : 'bg-black/40 hover:bg-white/10'
      }`}
      title="Потяните, чтобы изменить ширину окон"
    >
      <div className="w-1 h-8 rounded-full bg-slate-600 group-hover:bg-[var(--theme-accent)] group-hover:scale-y-110 transition-all flex items-center justify-center">
        <GripVertical size={10} className="text-slate-950 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};
