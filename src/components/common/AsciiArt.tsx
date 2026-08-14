import React from 'react';
import { AsciiCanvasEngine, AsciiEffectType } from './AsciiCanvasEngine';

interface AsciiArtProps {
  frames?: string[];
  fps?: number;
  className?: string;
  color?: 'accent' | 'emerald' | 'cyan' | 'purple' | 'amber' | 'rose' | 'platinum' | 'muted';
  isAnimated?: boolean;
  interactive?: boolean;
  onFrameClick?: (currentFrameIndex: number) => void;
  effect?: AsciiEffectType;
  fontSize?: number;
  width?: number;
  height?: number;
}

export const AsciiArt: React.FC<AsciiArtProps> = ({
  frames = [],
  fps = 30,
  className = '',
  color = 'accent',
  isAnimated = true,
  interactive = false,
  onFrameClick: _onFrameClick,
  effect = 'custom_frames',
  fontSize = 11,
  width,
  height,
}) => {
  const determinedEffect: AsciiEffectType =
    effect !== 'custom_frames'
      ? effect
      : (frames.length > 0 && (frames[0].includes('0xAgent') || frames[0]?.includes('██████╗')))
      ? 'hero_wave'
      : 'custom_frames';

  return (
    <AsciiCanvasEngine
      effect={determinedEffect}
      frames={frames}
      fps={isAnimated ? fps : 1}
      color={color}
      className={className}
      fontSize={fontSize}
      interactive={interactive}
      width={width}
      height={height}
    />
  );
};
