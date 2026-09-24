import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import { CAT } from '../data/categories';
import { COSMETIC } from '../data/shop';
import { useStore } from '../state/store';
import type { CategoryId, Player } from '../types';
import { fmtInt } from '../engine/util';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-b from-violet-500 to-indigo-600 border-indigo-900 text-white',
  secondary: 'bg-gradient-to-b from-ink-600 to-ink-700 border-ink-900 text-white',
  ghost: 'bg-white/5 border-transparent text-white/90 hover:bg-white/10 !shadow-none',
  danger: 'bg-gradient-to-b from-rose-500 to-rose-600 border-rose-900 text-white',
  success: 'bg-gradient-to-b from-emerald-400 to-emerald-600 border-emerald-900 text-white',
  gold: 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-800 text-amber-950',
};

export function Btn({ variant = 'primary', className = '', children, onClick, big, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        sfx.click();
        onClick?.(e);
      }}
      className={`btn3d ${VARIANTS[variant]} ${big ? 'px-6 py-4 text-lg' : 'px-4 py-2.5 text-sm'} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl bg-ink-800/80 border border-white/10 shadow-xl shadow-black/20 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export function Bar({ pct, color = '#a78bfa', className = '', h = 'h-2.5' }: { pct: number; color?: string; className?: string; h?: string }) {
  return (
    <div className={`w-full ${h} rounded-full bg-black/40 overflow-hidden ${className}`}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%`, background: color }} />
    </div>
  );
}

export function Avatar({ player, emoji, frame, size = 56, className = '' }: { player?: Player; emoji?: string; frame?: string; size?: number; className?: string }) {
  const e = emoji ?? (player ? COSMETIC[player.cosmetics.avatar]?.value : '🩺') ?? '🩺';
  const f = frame ?? (player ? COSMETIC[player.cosmetics.frame]?.value : undefined) ?? COSMETIC['fr-none'].value;
  return (
    <div className={`rounded-full p-[3px] shrink-0 ${className}`} style={{ background: f, width: size, height: size }}>
      <div className="w-full h-full rounded-full bg-ink-900 grid place-items-center" style={{ fontSize: size * 0.5 }}>
        {e}
      </div>
    </div>
  );
}

export function CatBadge({ cat, small }: { cat: CategoryId; small?: boolean }) {
  const c = CAT[cat];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-display font-semibold ${small ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`} style={{ background: c.color + '33', color: c.color }}>
      <span>{c.icon}</span>
      {c.name}
    </span>
  );
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

export function Coins({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-display font-semibold text-amber-300 ${className}`}>
      <span className="coin" /> {fmtInt(n)}
    </span>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { back, player } = useStore();
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 px-4 py-3 bg-ink-950/85 backdrop-blur border-b border-white/5 flex items-center gap-3">
      <button onClick={back} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 grid place-items-center text-xl" aria-label="Voltar">
        ‹
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl font-bold leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-white/50 truncate">{subtitle}</p>}
      </div>
      {right ?? (player && <Coins n={player.coins} />)}
    </div>
  );
}

export function Modal({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-3 bg-black/70 backdrop-blur-sm animate-rise" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto rounded-3xl bg-ink-800 border border-white/10 shadow-2xl animate-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 bg-ink-800/95 backdrop-blur px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 z-10">
            <h2 className="font-display text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Fechar">
              ✕
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, icon, color }: { label: string; value: ReactNode; icon?: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-black/25 border border-white/5 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/50 flex items-center gap-1">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="font-display text-xl font-bold mt-0.5" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

export function Empty({ icon, text, children }: { icon: string; text: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-5xl mb-3 animate-bob">{icon}</div>
      <p className="text-white/60">{text}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-black/30 p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => {
            sfx.click();
            onChange(o.v);
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${value === o.v ? 'bg-violet-500 text-white shadow' : 'text-white/60 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
