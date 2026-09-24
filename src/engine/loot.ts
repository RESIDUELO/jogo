import type { AttrKey, Item, Rarity, Slot } from '../types';
import { ATTR_SUFFIX, ITEM_BASES, RARITIES, RARITY_BY_ID, SLOTS, SLOT_BY_ID } from '../data/content';
import { pick, rand, uid } from './util';

const ATTR_KEYS: AttrKey[] = ['INT', 'SAB', 'VIT', 'PRE', 'CON'];
const ARMOR_SLOTS: Slot[] = ['capacete', 'armadura', 'luvas', 'calcas', 'botas'];

/** Sorteia raridade. `luck` desloca o peso para raridades altas; `min` garante um piso. */
export function rollRarity(luck = 0, min: Rarity = 'comum'): Rarity {
  const minIdx = RARITIES.findIndex(r => r.id === min);
  const pool = RARITIES.slice(minIdx).map((r, i) => ({ id: r.id, w: r.weight * (1 + luck * (i + minIdx)) }));
  const total = pool.reduce((s, r) => s + r.w, 0);
  let x = Math.random() * total;
  for (const r of pool) {
    x -= r.w;
    if (x <= 0) return r.id;
  }
  return pool[0].id;
}

export function generateItem(level: number, rarity: Rarity, slot?: Slot): Item {
  const s = slot ?? pick(SLOTS).id;
  const r = RARITY_BY_ID[rarity];
  const attrs: Partial<Record<AttrKey, number>> = {};
  const keys = [...ATTR_KEYS].sort(() => Math.random() - 0.5).slice(0, r.lines);
  for (const k of keys) attrs[k] = Math.max(1, Math.round((1 + level * 0.35) * r.mult * rand(0.7, 1.2)));
  const main = keys[0];
  const atk = s === 'arma' ? Math.round((4 + level * 1.5) * r.mult * rand(0.85, 1.15)) : 0;
  const def = ARMOR_SLOTS.includes(s) ? Math.round((2 + level * 0.8) * r.mult * rand(0.85, 1.15)) : 0;
  return {
    id: uid(),
    name: `${pick(ITEM_BASES[s])} ${ATTR_SUFFIX[main]}`,
    slot: s,
    rarity,
    level,
    attrs,
    atk,
    def,
    value: Math.round((5 + level * 3) * r.mult * r.mult),
    icon: SLOT_BY_ID[s].icon,
  };
}

export const requiredLevel = (it: Item) => Math.max(1, it.level - 2);

/** Soma de "poder" de um item — usada para comparação rápida. */
export function itemPower(it: Item | null | undefined): number {
  if (!it) return 0;
  const attrSum = Object.values(it.attrs).reduce((s, v) => s + (v ?? 0), 0);
  return attrSum * 2 + it.atk * 1.5 + it.def;
}
