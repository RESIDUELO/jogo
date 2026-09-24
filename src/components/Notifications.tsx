import { useEffect, useRef, useState } from 'react';
import type { GameEvent, Item } from '../types';
import { useGame } from '../state/store';
import { sfx } from '../sound';
import { ItemCard, Modal } from './ui';
import { POINTS_PER_LEVEL } from '../engine/progression';

interface Toast { id: number; text: string; kind: string; icon: string }

const TOAST_MAP: Partial<Record<GameEvent['type'], (e: any) => Omit<Toast, 'id'>>> = {
  quest: e => ({ kind: 'quest', icon: '📜', text: e.title }),
  achievement: e => ({ kind: 'achievement', icon: '🏆', text: `Conquista: ${e.name}` }),
  region: e => ({ kind: 'region', icon: '🗺️', text: `NOVA ÁREA DESBLOQUEADA: ${e.name}` }),
  info: e => ({ kind: 'info', icon: 'ℹ️', text: e.text }),
  streak: e => ({ kind: 'streak', icon: '🔥', text: `Sequência: ${e.days} dia${e.days > 1 ? 's' : ''}!` }),
  hardCard: () => ({ kind: 'warn', icon: '⚠️', text: 'CARD DIFÍCIL marcado — supere-o para uma recompensa especial!' }),
  conquered: e => ({ kind: 'achievement', icon: '💪', text: e.text }),
  drop: e => ({ kind: 'drop', icon: '🎁', text: e.text }),
  faint: () => ({ kind: 'warn', icon: '💫', text: 'Você desmaiou! O inimigo recuperou as forças. Revise com calma.' }),
};

export function Notifications() {
  const { subscribe, s, screen } = useGame();
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [loot, setLoot] = useState<Item[]>([]);
  const nextId = useRef(1);

  useEffect(() => subscribe(events => {
    const add: Toast[] = [];
    for (const e of events) {
      if (e.type === 'drop' && screenRef.current === 'battle') continue; // na batalha vira texto flutuante
      const m = TOAST_MAP[e.type];
      if (m) add.push({ id: nextId.current++, ...m(e) });
      if (e.type === 'levelup') { setLevelUp(e.level); sfx.level(); }
      if (e.type === 'loot') { setLoot(l => [...l, e.item]); sfx.loot(); }
      if (e.type === 'quest' || e.type === 'achievement' || e.type === 'region') sfx.quest();
    }
    if (add.length) {
      setToasts(t => [...t, ...add].slice(-4));
      for (const t of add) setTimeout(() => setToasts(x => x.filter(y => y.id !== t.id)), 3600);
    }
  }), [subscribe]);

  return (
    <>
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}><span>{t.icon}</span>{t.text}</div>
        ))}
      </div>
      {loot.length > 0 && levelUp === null && (
        <div className="loot-popup">
          <div className="loot-title">ITEM DROP!</div>
          <ItemCard item={loot[0]} s={s} compare={s.items.find(i => i.id === s.equipment[loot[0].slot]) ?? null}
            actions={<button className="btn" onClick={() => setLoot(l => l.slice(1))}>OK</button>} />
        </div>
      )}
      {levelUp !== null && (
        <Modal onClose={() => setLevelUp(null)} className="levelup">
          <div className="levelup-rays" />
          <div className="levelup-text">LEVEL UP!</div>
          <div className="levelup-level">Nível {levelUp}</div>
          <p>HP e Mana restaurados · +{POINTS_PER_LEVEL} pontos de atributo · +{25 * levelUp} ouro{levelUp % 5 === 0 ? ' · Baú bônus!' : ''}</p>
          <button className="btn btn-primary" onClick={() => setLevelUp(null)}>Continuar</button>
        </Modal>
      )}
    </>
  );
}
