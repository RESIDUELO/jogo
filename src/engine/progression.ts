import type { AttrKey, Attrs, SaveData } from '../types';
import { CLASS_BY_ID, COMBO_TIERS } from '../data/content';

/* ---------- Curva de XP ----------
 * XP total para alcançar o nível L: 25·(L−1)·(L+2)
 * Nível 2 → 100 · Nível 3 → 250 · Nível 4 → 450 · Nível 10 → 2.700 · Nível 20 → 10.450
 */
export const xpForLevel = (level: number) => 25 * (level - 1) * (level + 2);

export function levelFromXp(xp: number): number {
  let l = 1;
  while (xp >= xpForLevel(l + 1)) l++;
  return l;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return { level, current: xp - start, needed: end - start, pct: (xp - start) / (end - start) };
}

export const POINTS_PER_LEVEL = 3;

/* ---------- Atributos derivados ---------- */
export interface Derived {
  attrs: Attrs;
  maxHp: number;
  maxMana: number;
  atk: number;
  def: number;
  critChance: number;
  xpMult: number;
}

export function derived(s: SaveData): Derived {
  const cls = CLASS_BY_ID[s.player.classId];
  const attrs: Attrs = { ...s.player.baseAttrs };
  let atk = 0;
  let def = 0;
  for (const id of Object.values(s.equipment)) {
    if (!id) continue;
    const it = s.items.find(i => i.id === id);
    if (!it) continue;
    atk += it.atk;
    def += it.def;
    for (const [k, v] of Object.entries(it.attrs)) attrs[k as AttrKey] += v ?? 0;
  }
  const L = s.player.level;
  const maxHp = Math.round((100 + attrs.VIT * 10 + L * 15) * cls.hpMult);
  const maxMana = Math.round((50 + attrs.INT * 2 + L * 3) * (cls.id === 'mago' ? 1.3 : 1));
  const critChance = Math.min(0.6, 0.05 + attrs.PRE * 0.005 + cls.critBonus);
  const xpMult = (1 + attrs.INT * 0.01) * cls.xpMult;
  return { attrs, maxHp, maxMana, atk, def, critChance, xpMult };
}

export function comboTier(combo: number) {
  return COMBO_TIERS.find(t => combo >= t.at) ?? null;
}

/** Bônus de XP pela sequência de dias (máx. +20%). */
export const streakBonus = (days: number) => Math.min(days, 20) * 0.01;
