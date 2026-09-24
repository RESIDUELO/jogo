// RANKINGS — ranking local (perfis deste aparelho + bots com estatísticas simuladas).
// Com backend, isto vira uma view/consulta agregada no servidor.
import { BOTS, BOT_TIERS } from '../data/bots';
import { CATEGORY_IDS, emptyCatRecord } from '../data/categories';
import { COSMETIC } from '../data/shop';
import { levelFromXp, xpToNext } from '../engine/progression';
import { computeStats, rate } from '../engine/stats';
import { clamp, hash01, weekStart } from '../engine/util';
import type { CategoryId, Player, RankingEntry } from '../types';
import { playerRepo } from './playerRepo';
import type { OnlineProfile } from './online';

function totalXpForLevel(level: number) {
  let s = 0;
  for (let i = 1; i < level; i++) s += xpToNext(i);
  return s;
}

function botEntries(): RankingEntry[] {
  const wk = String(weekStart());
  return BOTS.map((b) => {
    const t = BOT_TIERS[b.tier];
    const h = hash01(b.id);
    const games = Math.round(20 + h * 120);
    const wins = Math.round(games * clamp(0.3 + (t.rating - 900) / 1800 + (h - 0.5) * 0.1, 0.2, 0.85));
    const catAccuracy = emptyCatRecord(0);
    CATEGORY_IDS.forEach((c) => (catAccuracy[c] = clamp(t.baseAccuracy + (b.skill[c] ?? 0), 0.1, 0.97)));
    return {
      id: b.id,
      name: b.name,
      avatar: b.avatar,
      isBot: true,
      level: t.level,
      xp: totalXpForLevel(t.level) + Math.round(h * 300),
      wins,
      losses: games - wins,
      accuracy: t.baseAccuracy,
      streak: Math.round(hash01(b.id + wk) * 6),
      rating: t.rating + Math.round((h - 0.5) * 80),
      catAccuracy,
      weekXp: Math.round(300 + hash01(b.id + wk) * 2200 * (t.level / 20)),
    };
  });
}

export function playerEntry(p: Player): RankingEntry {
  const answers = playerRepo.getAnswers(p.id);
  const s = computeStats(answers);
  const catAccuracy = emptyCatRecord(0);
  CATEGORY_IDS.forEach((c) => (catAccuracy[c] = rate(s.byCat[c])));
  const ws = weekStart();
  const weekMatches = playerRepo.getMatches(p.id).filter((m) => m.at >= ws);
  const weekXp = weekMatches.reduce((a, m) => a + m.xp, 0) + answers.filter((a) => a.at >= ws && a.correct).length * 30;
  return {
    id: p.id,
    name: p.name,
    avatar: COSMETIC[p.cosmetics.avatar]?.value ?? '🩺',
    isBot: false,
    level: levelFromXp(p.xp).level,
    xp: p.xp,
    wins: p.wins,
    losses: p.losses,
    accuracy: rate(s.total),
    streak: p.winStreak,
    rating: p.rating,
    catAccuracy,
    weekXp,
  };
}

export type RankingKind = 'geral' | 'semanal' | 'ranqueado' | CategoryId;

export function getRanking(kind: RankingKind): RankingEntry[] {
  return sortRanking([...playerRepo.listPlayers().map(playerEntry), ...botEntries()], kind);
}

/** Converte perfis do servidor em linhas de ranking (jogadores reais). */
export function onlineEntries(ps: OnlineProfile[]): RankingEntry[] {
  const thisWeek = new Date(weekStart()).toISOString().slice(0, 10);
  return ps.map((p) => {
    const catAccuracy = emptyCatRecord(0);
    CATEGORY_IDS.forEach((c) => {
      const s = p.cat_stats?.[c];
      catAccuracy[c] = s && s.n ? s.c / s.n : 0;
    });
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: false,
      level: p.level,
      xp: p.xp,
      wins: p.wins,
      losses: p.losses,
      accuracy: p.answered ? p.correct / p.answered : 0,
      streak: p.win_streak,
      rating: p.rating,
      catAccuracy,
      weekXp: p.week_start === thisWeek ? p.week_xp : 0,
    };
  });
}

export function sortRanking(all: RankingEntry[], kind: RankingKind): RankingEntry[] {
  const sorters: Record<string, (a: RankingEntry, b: RankingEntry) => number> = {
    geral: (a, b) => b.xp - a.xp,
    semanal: (a, b) => b.weekXp - a.weekXp,
    ranqueado: (a, b) => b.rating - a.rating,
  };
  const sorter = sorters[kind] ?? ((a, b) => b.catAccuracy[kind as CategoryId] - a.catAccuracy[kind as CategoryId] || b.xp - a.xp);
  return all.sort(sorter);
}
