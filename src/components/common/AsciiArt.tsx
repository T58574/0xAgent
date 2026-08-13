import React, { useState, useEffect } from 'react';

interface AsciiArtProps {
  frames: string[];
  fps?: number;
  className?: string;
  color?: 'accent' | 'emerald' | 'cyan' | 'purple' | 'amber' | 'rose' | 'muted';
  isAnimated?: boolean;
  interactive?: boolean;
  onFrameClick?: (currentFrameIndex: number) => void;
}

export const AsciiArt: React.FC<AsciiArtProps> = ({
  frames,
  fps = 2,
  className = '',
  color = 'accent',
  isAnimated = true,
  interactive = false,
  onFrameClick,
}) => {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!isAnimated || frames.length <= 1) return;

    const intervalMs = Math.max(100, Math.floor(1000 / fps));
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [frames, fps, isAnimated]);

  const getColorClass = () => {
    switch (color) {
      case 'emerald':
        return 'text-emerald-400';
      case 'cyan':
        return 'text-cyan-400';
      case 'purple':
        return 'text-purple-400';
      case 'amber':
        return 'text-amber-400';
      case 'rose':
        return 'text-rose-400';
      case 'muted':
        return 'text-theme-muted';
      case 'accent':
      default:
        return 'text-theme-accent';
    }
  };

  const currentFrame = frames[frameIndex % frames.length] || '';

  const handleClick = () => {
    if (interactive) {
      const nextIndex = (frameIndex + 1) % frames.length;
      setFrameIndex(nextIndex);
      if (onFrameClick) onFrameClick(nextIndex);
    }
  };

  return (
    <pre
      onClick={handleClick}
      className={`font-mono text-xs leading-tight whitespace-pre select-none ${getColorClass()} ${
        interactive ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      } ${className}`}
    >
      {currentFrame}
    </pre>
  );
};
