import React, { useRef, useEffect, useCallback } from 'react';

export type AsciiEffectType = 'hero_wave' | 'neural_brain' | 'telemetry_stream' | 'matrix_rain' | 'custom_frames';

interface AsciiCanvasEngineProps {
  effect?: AsciiEffectType;
  frames?: string[];
  fps?: number;
  color?: 'accent' | 'emerald' | 'cyan' | 'purple' | 'amber' | 'rose' | 'platinum' | 'muted';
  className?: string;
  fontSize?: number;
  interactive?: boolean;
  intensity?: number;
  width?: number;
  height?: number;
}

const HERO_LINES = [
  ' ██████╗ ██╗  ██╗ █████╗  ██████╗ ███████╗███╗   ██╗████████╗',
  '██╔═████╗╚██╗██╔╝██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝',
  '██║██╔██║ ╚███╔╝ ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ',
  '████╔╝██║ ██╔██╗ ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ',
  '╚██████╔╝██╔╝ ██╗██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ',
  ' ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   '
];

const GLYPHS = '01#%&*+=-:.~ ';

export const AsciiCanvasEngine: React.FC<AsciiCanvasEngineProps> = ({
  effect = 'hero_wave',
  frames = [],
  fps = 30,
  color = 'accent',
  className = '',
  fontSize = 11,
  interactive = true,
  intensity = 1,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -100, y: -100, active: false });
  const animFrameIdRef = useRef<number | null>(null);

  const getColorHex = useCallback(() => {
    switch (color) {
      case 'emerald':
        return '#34d399';
      case 'cyan':
        return '#38bdf8';
      case 'purple':
        return '#c084fc';
      case 'amber':
        return '#fbbf24';
      case 'rose':
        return '#f87171';
      case 'platinum':
        return '#f1f5f9';
      case 'muted':
        return '#64748b';
      case 'accent':
      default: {
        const computed = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim();
        return computed || '#38bdf8';
      }
    }
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let startTime = performance.now();
    let lastRender = 0;
    const interval = 1000 / Math.min(60, fps);

    const dpr = window.devicePixelRatio || 1;
    const charWidth = fontSize * 0.6;
    const charHeight = fontSize * 1.15;

    const computeDimensions = () => {
      if (width && height) {
        return { w: width, h: height };
      }
      if (effect === 'hero_wave') {
        const maxLen = Math.max(...HERO_LINES.map((l) => l.length));
        return {
          w: Math.ceil(maxLen * charWidth + 24),
          h: Math.ceil(HERO_LINES.length * charHeight + 16),
        };
      }
      if (effect === 'neural_brain') {
        return { w: 320, h: 90 };
      }
      if (effect === 'telemetry_stream') {
        return { w: 240, h: 48 };
      }
      if (effect === 'matrix_rain') {
        return { w: 300, h: 120 };
      }
      return { w: 280, h: 100 };
    };

    const dims = computeDimensions();
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    canvas.style.width = `${dims.w}px`;
    canvas.style.height = `${dims.h}px`;

    const cols = Math.floor(dims.w / (charWidth * 1.5));
    const drops: number[] = Array.from({ length: cols }, () => Math.random() * -20);

    const render = (currentTime: number) => {
      animFrameIdRef.current = requestAnimationFrame(render);

      if (document.hidden) return;

      const delta = currentTime - lastRender;
      if (delta < interval) return;
      lastRender = currentTime - (delta % interval);

      const elapsed = (currentTime - startTime) / 1000;
      const themeColor = getColorHex();

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, dims.w, dims.h);

      ctx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = 'top';

      if (effect === 'hero_wave') {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const isHovered = mouseRef.current.active;

        HERO_LINES.forEach((line, rowIdx) => {
          const y = 8 + rowIdx * charHeight;

          for (let colIdx = 0; colIdx < line.length; colIdx++) {
            const char = line[colIdx];
            if (!char || char === ' ') continue;

            const x = 12 + colIdx * charWidth;

            const dx = mx - x;
            const dy = my - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const isNearMouse = isHovered && dist < 60;

            const wave = Math.sin(elapsed * 3 + colIdx * 0.18 + rowIdx * 0.3) * intensity;
            const alpha = 0.55 + 0.45 * Math.sin(elapsed * 2.5 + colIdx * 0.12);

            let renderChar = char;
            if (isNearMouse && Math.random() > 0.4) {
              renderChar = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            }

            ctx.fillStyle = isNearMouse ? '#ffffff' : themeColor;
            ctx.globalAlpha = isNearMouse ? 1 : Math.max(0.3, alpha + wave * 0.15);

            const offsetY = Math.sin(elapsed * 2 + colIdx * 0.1) * 1.5;
            ctx.fillText(renderChar, x, y + offsetY);
          }
        });
      } else if (effect === 'neural_brain') {
        const centerX = dims.w / 2;
        const centerY = dims.h / 2;

        ctx.fillStyle = themeColor;
        ctx.globalAlpha = 0.9;

        const brainAscii = [
          '   .╭─────╮.   ',
          '  /  ◉   ◉  \\  ',
          ' │  (  ▲  )  │ ',
          '  \\  ═══  /   ',
          '   `╰─────╯`   '
        ];

        brainAscii.forEach((line, i) => {
          const y = centerY - 32 + i * (charHeight * 0.9);
          const x = centerX - 120;
          ctx.fillText(line, x, y);
        });

        const fluxPct = Math.floor(70 + 30 * Math.sin(elapsed * 3));
        const statusText = `[ NEURAL CORE: FLUX ${fluxPct}% ]`;
        const pulseBars = '■'.repeat(Math.max(1, Math.floor((fluxPct - 60) / 4))) + '░'.repeat(Math.max(0, 10 - Math.floor((fluxPct - 60) / 4)));

        ctx.fillStyle = themeColor;
        ctx.globalAlpha = 0.95;
        ctx.fillText(statusText, centerX - 10, centerY - 20);

        ctx.fillStyle = '#64748b';
        ctx.fillText(`SYNAPSE: [${pulseBars}]`, centerX - 10, centerY - 2);

        const latency = (18 + 4 * Math.sin(elapsed * 1.5)).toFixed(1);
        ctx.fillStyle = '#94a3b8';
        ctx.font = `400 ${fontSize - 1}px 'JetBrains Mono', monospace`;
        ctx.fillText(`STREAM: 60 FPS • ${latency}ms LATENCY`, centerX - 10, centerY + 16);
      } else if (effect === 'telemetry_stream') {
        const timeStr = elapsed.toFixed(2);
        const glyphChunk = Array.from({ length: 18 }, (_, i) => {
          const charCode = Math.floor(48 + ((elapsed * 10 + i * 7) % 40));
          return String.fromCharCode(charCode);
        }).join('');

        ctx.fillStyle = themeColor;
        ctx.globalAlpha = 0.85;
        ctx.fillText(`HUD_DATA [${glyphChunk}]`, 4, 6);
        ctx.fillStyle = '#64748b';
        ctx.fillText(`T+${timeStr}s • STABLE PIPELINE`, 4, 6 + charHeight);
      } else if (effect === 'matrix_rain') {
        for (let i = 0; i < cols; i++) {
          const x = i * charWidth * 1.5;
          const y = drops[i] * charHeight;

          const char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          ctx.fillStyle = themeColor;
          ctx.globalAlpha = Math.random() > 0.7 ? 1 : 0.45;
          ctx.fillText(char, x, y);

          if (y > dims.h && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i] += 0.5;
        }
      } else if (effect === 'custom_frames' && frames.length > 0) {
        const frameIdx = Math.floor(elapsed * fps) % frames.length;
        const currentFrame = frames[frameIdx] || '';
        const lines = currentFrame.split('\n');

        lines.forEach((line, rIdx) => {
          ctx.fillStyle = themeColor;
          ctx.globalAlpha = 0.85;
          ctx.fillText(line, 4, 4 + rIdx * charHeight);
        });
      }

      ctx.restore();
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    if (interactive) {
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (interactive) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [effect, frames, fps, color, fontSize, interactive, intensity, width, height, getColorHex]);

  return (
    <div className={`relative inline-block select-none overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="block pointer-events-auto" />
    </div>
  );
};
