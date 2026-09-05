import React, { useEffect, useRef } from 'react';

interface AsciiParticleFlowProps {
  isActive: boolean;
}

export const AsciiParticleFlow: React.FC<AsciiParticleFlowProps> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const chars = ['·', '°', '⁺', '*', '‧', '•', '∘'];
    const particles: Array<{ x: number; y: number; char: string; speed: number; opacity: number }> = [];

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 200;
      canvas.height = canvas.parentElement?.clientHeight || 40;
    };
    resize();

    const spawn = () => {
      if (particles.length < 18) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 5,
          char: chars[Math.floor(Math.random() * chars.length)],
          speed: 0.6 + Math.random() * 0.9,
          opacity: 0.15 + Math.random() * 0.5,
        });
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isActive) {
        spawn();
        spawn();
      }

      ctx.font = '10px monospace';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y -= p.speed;
        p.opacity -= 0.012;

        if (p.y < -5 || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, p.opacity)})`;
        ctx.fillText(p.char, p.x, p.y);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
        isActive ? 'opacity-90' : 'opacity-0'
      }`}
    />
  );
};
