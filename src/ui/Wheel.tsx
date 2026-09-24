import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { CATEGORIES } from '../data/categories';
import type { CategoryId } from '../types';

const SEG = 360 / CATEGORIES.length;

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`;
}

/** Desaceleração estilo roda de verdade: rápida no início, "rastejando" nos últimos pinos. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

interface Props {
  /** Quando `spinKey` muda e há `target`, a roleta gira até a categoria alvo. */
  target: CategoryId | null;
  spinKey: number;
  onDone?: (cat: CategoryId) => void;
  onSpinClick?: () => void;
  canSpin?: boolean;
  size?: number;
  reduceMotion?: boolean;
}

export function Wheel({ target, spinKey, onDone, onSpinClick, canSpin, size = 300, reduceMotion }: Props) {
  const [rot, setRot] = useState(0);
  const rotRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<CategoryId | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (!spinKey || !target) return;
    const idx = CATEGORIES.findIndex((c) => c.id === target);
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const want = (((-(idx * SEG + SEG / 2 + jitter)) % 360) + 360) % 360;
    const from = rotRef.current;
    const base = from - (from % 360);
    const spins = reduceMotion ? 1 : 5 + Math.floor(Math.random() * 2);
    let to = base + spins * 360 + want;
    if (to - from < 360 * 3 && !reduceMotion) to += 360;
    const dur = reduceMotion ? 600 : 4200 + Math.random() * 600;
    const t0 = performance.now();
    let lastPeg = Math.floor(from / (SEG / 2));
    setSpinning(true);
    setLanded(null);
    sfx.spinStart();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const r = from + (to - from) * easeOut(t);
      rotRef.current = r;
      setRot(r);
      const peg = Math.floor(r / (SEG / 2));
      if (peg !== lastPeg) {
        lastPeg = peg;
        sfx.tick();
      }
      if (t < 1) raf.current = requestAnimationFrame(step);
      else {
        setSpinning(false);
        setLanded(target);
        sfx.land();
        onDone?.(target);
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  const c = 150;
  const r = 140;
  return (
    <div className="relative select-none mx-auto" style={{ width: size, height: size }}>
      {/* brilho */}
      <div className="absolute inset-3 rounded-full bg-violet-500/30 blur-2xl" />
      {/* ponteiro */}
      <div className="absolute left-1/2 -top-2 z-20 -translate-x-1/2 drop-shadow-lg">
        <svg width="38" height="46" viewBox="0 0 38 46">
          <path d="M19 44 L4 10 A16 16 0 1 1 34 10 Z" fill="#fff" stroke="#1b1842" strokeWidth="3" />
          <circle cx="19" cy="15" r="6" fill="#8b5cf6" />
        </svg>
      </div>
      <svg viewBox="0 0 300 300" className="relative w-full h-full" style={{ transform: `rotate(${rot}deg)` }}>
        <circle cx={c} cy={c} r={148} fill="#1b1842" />
        {CATEGORIES.map((cat, i) => {
          const a0 = i * SEG;
          const a1 = a0 + SEG;
          const mid = a0 + SEG / 2;
          const hl = landed === cat.id;
          return (
            <g key={cat.id}>
              <defs>
                <radialGradient id={`g-${cat.id}`} cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor={cat.color} />
                  <stop offset="100%" stopColor={cat.dark} />
                </radialGradient>
              </defs>
              <path d={arcPath(c, c, r, a0, a1)} fill={`url(#g-${cat.id})`} stroke="#fff" strokeOpacity={0.9} strokeWidth={3} opacity={landed && !hl ? 0.55 : 1} />
              <g transform={`rotate(${mid} ${c} ${c})`}>
                <text x={c} y={c - 88} textAnchor="middle" fontSize="34" dominantBaseline="middle">
                  {cat.icon}
                </text>
                <text x={c} y={c - 55} textAnchor="middle" fontSize={cat.name.length > 8 ? 11.5 : 14} fontWeight={700} fill="#fff" fontFamily="Fredoka, sans-serif" style={{ letterSpacing: 0.5 }}>
                  {cat.name}
                </text>
              </g>
            </g>
          );
        })}
        {/* pinos */}
        {Array.from({ length: CATEGORIES.length * 2 }).map((_, i) => {
          const a = ((i * SEG) / 2 - 90) * (Math.PI / 180);
          return <circle key={i} cx={c + 143 * Math.cos(a)} cy={c + 143 * Math.sin(a)} r={i % 2 ? 2.5 : 4} fill="#fde68a" stroke="#92400e" strokeWidth={1} />;
        })}
      </svg>
      {/* botão central */}
      <button
        disabled={!canSpin || spinning}
        onClick={onSpinClick}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full grid place-items-center font-display font-bold text-white border-4 border-white shadow-xl transition
          ${canSpin && !spinning ? 'bg-gradient-to-b from-violet-500 to-indigo-700 hover:scale-105 active:scale-95 animate-pulseRing cursor-pointer' : 'bg-ink-700 cursor-default'}`}
        style={{ width: size * 0.27, height: size * 0.27, fontSize: size * 0.05 }}
      >
        {spinning ? '🌀' : canSpin ? 'GIRAR' : '•••'}
      </button>
    </div>
  );
}
