import { useEffect, useRef } from 'react';

const MULTI = ['#ec4899', '#3b82f6', '#f97316', '#22c55e', '#eab308', '#a78bfa', '#fff'];

/** Explosão de confete em canvas. Muda `burst` para disparar. */
export function Particles({ burst, color = 'multi', count = 90, origin = { x: 0.5, y: 0.45 } }: { burst: number; color?: string; count?: number; origin?: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!burst) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const colors = color === 'multi' ? MULTI : [color, '#fff', color];
    const ps = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 9;
      return {
        x: W * origin.x,
        y: H * origin.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 5,
        r: 3 + Math.random() * 5,
        c: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        life: 1,
      };
    });
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of ps) {
        if (p.life <= 0) continue;
        alive++;
        p.vy += 0.28;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.012;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[90] w-full h-full" />;
}
