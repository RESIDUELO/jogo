import type { ReactNode } from 'react';
import type { Item, SaveData } from '../types';
import { ATTRS, RARITY_BY_ID, SLOT_BY_ID } from '../data/content';
import { requiredLevel } from '../engine/loot';
import { fmt } from '../engine/util';

export function Bar({ value, max, kind, label, big }: { value: number; max: number; kind: 'hp' | 'mana' | 'xp' | 'enemy' | 'plain'; label?: ReactNode; big?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar bar-${kind}${big ? ' bar-big' : ''}`}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
      {label !== undefined && <span className="bar-label">{label}</span>}
    </div>
  );
}

export function Panel({ title, children, className = '', right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      {title && <header className="panel-title"><span>{title}</span>{right}</header>}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function RarityTag({ rarity }: { rarity: Item['rarity'] }) {
  return <span className={`rarity r-${rarity}`}>{RARITY_BY_ID[rarity].name}</span>;
}

/** Linhas de atributos de um item; com `compare`, mostra a diferença para o item equipado. */
export function ItemStats({ item, compare }: { item: Item; compare?: Item | null }) {
  const rows: { k: string; v: number; o: number }[] = [];
  if (item.atk || compare?.atk) rows.push({ k: 'Ataque', v: item.atk, o: compare?.atk ?? 0 });
  if (item.def || compare?.def) rows.push({ k: 'Defesa', v: item.def, o: compare?.def ?? 0 });
  for (const a of ATTRS) {
    const v = item.attrs[a.key] ?? 0;
    const o = compare?.attrs[a.key] ?? 0;
    if (v || o) rows.push({ k: a.key, v, o });
  }
  return (
    <ul className="item-stats">
      {rows.map(r => (
        <li key={r.k}>
          <span>{r.k}</span>
          <b>{r.v ? `+${r.v}` : '—'}</b>
          {compare !== undefined && r.v !== r.o && (
            <em className={r.v > r.o ? 'up' : 'down'}>{r.v > r.o ? '▲' : '▼'} {Math.abs(r.v - r.o)}</em>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ItemIcon({ item, size = 'md', onClick, selected, equipped }: { item: Item; size?: 'sm' | 'md' | 'lg'; onClick?: () => void; selected?: boolean; equipped?: boolean }) {
  return (
    <button type="button" className={`item-icon sz-${size} r-${item.rarity}${selected ? ' selected' : ''}`} onClick={onClick} title={item.name}>
      <span>{item.icon}</span>
      <small>{item.level}</small>
      {equipped && <i className="eq-dot" />}
    </button>
  );
}

export function ItemCard({ item, compare, s, actions }: { item: Item; compare?: Item | null; s: SaveData; actions?: ReactNode }) {
  const req = requiredLevel(item);
  return (
    <div className={`item-card r-${item.rarity}`}>
      <div className="item-card-head">
        <span className="item-card-icon">{item.icon}</span>
        <div>
          <h4 className={`t-${item.rarity}`}>{item.name}</h4>
          <div className="muted small"><RarityTag rarity={item.rarity} /> · {SLOT_BY_ID[item.slot].name} · Nível {item.level}</div>
        </div>
      </div>
      <ItemStats item={item} compare={compare} />
      <div className="item-card-foot">
        <span className={s.player.level < req ? 'bad' : 'muted'}>Requer nível {req}</span>
        <span className="gold-text">🪙 {fmt(item.value)}</span>
      </div>
      {actions && <div className="item-card-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: string }) {
  return (
    <div className="stat">
      {icon && <span className="stat-icon">{icon}</span>}
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Modal({ children, onClose, className = '' }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}
