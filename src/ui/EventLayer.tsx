import { useEffect } from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import { CAT } from '../data/categories';
import { MISSION_BY_ID } from '../data/missions';
import { POWERUP } from '../data/shop';
import { useStore, type Toast } from '../state/store';
import { Btn } from './common';
import { Particles } from './Particles';

function toastContent(t: Toast): { icon: string; title: string; sub?: string; color: string } | null {
  const e = t.ev;
  switch (e.type) {
    case 'achievement': {
      const a = ACHIEVEMENTS.find((x) => x.id === e.id);
      return a ? { icon: a.icon, title: 'Conquista desbloqueada!', sub: a.name, color: '#f59e0b' } : null;
    }
    case 'mission':
      return { icon: '🎯', title: 'Missão completa!', sub: `${MISSION_BY_ID[e.id]?.text ?? ''} — resgate a recompensa`, color: '#22c55e' };
    case 'catlevel':
      return { icon: CAT[e.cat].icon, title: `${CAT[e.cat].name} nível ${e.level}!`, color: CAT[e.cat].color };
    case 'coins':
      return { icon: '🪙', title: `+${e.amount} coins`, color: '#fbbf24' };
    case 'item':
      return { icon: POWERUP[e.id].icon, title: `+${e.amount} ${POWERUP[e.id].name}`, color: '#a78bfa' };
    default:
      return null;
  }
}

function ToastItem({ t }: { t: Toast }) {
  const { dismissToast } = useStore();
  useEffect(() => {
    const id = setTimeout(() => dismissToast(t.id), t.ev.type === 'achievement' ? 4200 : 2600);
    return () => clearTimeout(id);
  }, [t, dismissToast]);
  const c = toastContent(t);
  if (!c) return null;
  return (
    <button onClick={() => dismissToast(t.id)} className="w-full flex items-center gap-3 rounded-2xl bg-ink-800/95 border px-3 py-2 shadow-2xl animate-slideIn text-left backdrop-blur" style={{ borderColor: c.color + '88' }}>
      <span className="text-2xl">{c.icon}</span>
      <span className="min-w-0">
        <span className="block font-display font-semibold text-sm" style={{ color: c.color }}>
          {c.title}
        </span>
        {c.sub && <span className="block text-xs text-white/70 truncate">{c.sub}</span>}
      </span>
    </button>
  );
}

export function EventLayer() {
  const { toasts, levelUp, dismissLevelUp } = useStore();
  return (
    <>
      <div className="fixed top-3 right-3 left-3 sm:left-auto sm:w-80 z-[95] space-y-2 pointer-events-none [&>*]:pointer-events-auto">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </div>
      {levelUp && (
        <div className="fixed inset-0 z-[96] grid place-items-center bg-black/75 backdrop-blur-sm p-4" onClick={dismissLevelUp}>
          <Particles burst={levelUp.level} count={160} color="#facc15" />
          <div className="text-center animate-pop">
            <div className="text-sm tracking-[0.3em] text-amber-200">SUBIU DE NÍVEL</div>
            <div className="font-display text-8xl font-bold text-amber-300 animate-glow my-2">{levelUp.level}</div>
            <div className="font-display text-2xl">{levelUp.title}</div>
            <div className="text-white/60 text-sm mt-1">+50 coins · +1 50/50</div>
            <Btn variant="gold" big className="mt-6" onClick={dismissLevelUp}>
              Continuar
            </Btn>
          </div>
        </div>
      )}
    </>
  );
}
