import { LEAGUES, LEVEL_TITLES, type League } from '../data/progression';

/** XP necessário para ir do nível n para n+1. */
export const xpToNext = (n: number) => Math.round(100 + 40 * Math.pow(n - 1, 1.25));

export interface LevelInfo {
  level: number;
  into: number; // XP dentro do nível atual
  need: number; // XP total do nível atual
  pct: number;
  title: string;
  icon: string;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  const t = titleFor(level);
  return { level, into: rest, need: xpToNext(level), pct: rest / xpToNext(level), title: t.title, icon: t.icon };
}

export function titleFor(level: number) {
  let t = LEVEL_TITLES[0];
  for (const lt of LEVEL_TITLES) if (level >= lt.from) t = lt;
  return t;
}

/** Nível por categoria (curva mais curta). */
const catXpToNext = (n: number) => 60 + 25 * (n - 1);
export function catLevelFromXp(xp: number) {
  let level = 1;
  let rest = xp;
  while (rest >= catXpToNext(level)) {
    rest -= catXpToNext(level);
    level++;
  }
  return { level, into: rest, need: catXpToNext(level), pct: rest / catXpToNext(level) };
}

export function leagueFor(rating: number): League {
  let l = LEAGUES[0];
  for (const lg of LEAGUES) if (rating >= lg.min) l = lg;
  return l;
}

export function nextLeague(rating: number): League | undefined {
  return LEAGUES.find((l) => l.min > rating);
}
