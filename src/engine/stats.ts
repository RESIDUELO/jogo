import { CATEGORY_IDS, emptyCatRecord } from '../data/categories';
import type { AnswerRecord, CategoryId, MatchSummary, Player } from '../types';
import type { ProgressSnapshot } from '../data/achievements';
import { addDays, dayKey, weekStart } from './util';
import { levelFromXp } from './progression';

export interface Acc {
  n: number;
  c: number;
  ms: number;
}
const acc = (): Acc => ({ n: 0, c: 0, ms: 0 });
export const rate = (a: Acc) => (a.n ? a.c / a.n : 0);

export interface StudyStats {
  total: Acc;
  byCat: Record<CategoryId, Acc>;
  bySub: { cat: CategoryId; sub: string; acc: Acc }[];
  byDay: { day: string; acc: Acc }[];
  byDiff: Record<number, Acc>;
  weakSubs: { cat: CategoryId; sub: string; acc: Acc }[];
  strongest?: CategoryId;
  weakest?: CategoryId;
  week: { byCat: Record<CategoryId, Acc>; total: Acc };
}

export function computeStats(answers: AnswerRecord[]): StudyStats {
  const total = acc();
  const byCat = emptyCatRecord<Acc>(null as unknown as Acc);
  CATEGORY_IDS.forEach((c) => (byCat[c] = acc()));
  const weekByCat = emptyCatRecord<Acc>(null as unknown as Acc);
  CATEGORY_IDS.forEach((c) => (weekByCat[c] = acc()));
  const weekTotal = acc();
  const subs = new Map<string, { cat: CategoryId; sub: string; acc: Acc }>();
  const days = new Map<string, Acc>();
  const byDiff: Record<number, Acc> = { 1: acc(), 2: acc(), 3: acc(), 4: acc() };
  const ws = weekStart();
  const add = (a: Acc, r: AnswerRecord) => {
    a.n++;
    if (r.correct) a.c++;
    a.ms += r.ms;
  };
  for (const r of answers) {
    add(total, r);
    add(byCat[r.cat], r);
    add(byDiff[r.diff] ?? (byDiff[r.diff] = acc()), r);
    const key = r.cat + '|' + r.sub;
    if (!subs.has(key)) subs.set(key, { cat: r.cat, sub: r.sub, acc: acc() });
    add(subs.get(key)!.acc, r);
    const d = dayKey(r.at);
    if (!days.has(d)) days.set(d, acc());
    add(days.get(d)!, r);
    if (r.at >= ws) {
      add(weekByCat[r.cat], r);
      add(weekTotal, r);
    }
  }
  const bySub = [...subs.values()].sort((a, b) => b.acc.n - a.acc.n);
  const weakSubs = bySub
    .filter((s) => s.acc.n >= 2 && rate(s.acc) < 0.6)
    .sort((a, b) => rate(a.acc) - rate(b.acc) || b.acc.n - a.acc.n)
    .slice(0, 6);
  const played = CATEGORY_IDS.filter((c) => byCat[c].n >= 3);
  const strongest = played.length ? played.reduce((a, b) => (rate(byCat[a]) >= rate(byCat[b]) ? a : b)) : undefined;
  const weakest = played.length ? played.reduce((a, b) => (rate(byCat[a]) <= rate(byCat[b]) ? a : b)) : undefined;
  const byDay = [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, a]) => ({ day, acc: a }));
  return { total, byCat, bySub, byDay, byDiff, weakSubs, strongest, weakest, week: { byCat: weekByCat, total: weekTotal } };
}

/** Recomendação simples baseada em estatística (sem IA). */
export function recommendation(s: StudyStats): { cat: CategoryId; count: number; reason: string } | null {
  if (s.total.n < 5) return null;
  const scored = CATEGORY_IDS.map((c) => {
    const a = s.byCat[c];
    // pouca amostra conta como "fraca" para incentivar cobertura
    const r = a.n < 3 ? 0.5 : rate(a);
    return { c, r, n: a.n };
  }).sort((a, b) => a.r - b.r || a.n - b.n);
  const w = scored[0];
  const count = w.r < 0.5 ? 15 : w.r < 0.65 ? 12 : 10;
  const reason = s.byCat[w.c].n < 3 ? 'poucos cartões respondidos nesta área' : `acerto de ${Math.round(w.r * 100)}% nesta área`;
  return { cat: w.c, count, reason };
}

export function dayStreak(playDays: string[], today = dayKey()): number {
  const set = new Set(playDays);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function snapshot(player: Player, answers: AnswerRecord[], matches: MatchSummary[]): ProgressSnapshot {
  const catCorrect = emptyCatRecord(0);
  const catAnswered = emptyCatRecord(0);
  let correct = 0;
  let hardCorrect = 0;
  let fastCorrect = 0;
  const missed = new Set<string>();
  for (const a of answers) {
    catAnswered[a.cat]++;
    if (a.correct) {
      correct++;
      catCorrect[a.cat]++;
      if (missed.has(a.qid)) hardCorrect++; // cartão recuperado (já tinha errado)
      if (a.ms < 8000) fastCorrect++;
    } else missed.add(a.qid);
  }
  return {
    answered: answers.length,
    correct,
    catCorrect,
    catAnswered,
    wins: player.wins,
    rankedWins: player.rankedWins,
    matches: matches.filter((m) => m.mode !== 'treino').length,
    bestAnswerStreak: player.bestAnswerStreak,
    bestWinStreak: player.bestWinStreak,
    dayStreak: dayStreak(player.playDays),
    level: levelFromXp(player.xp).level,
    rating: player.peakRating,
    perfectMatches: matches.filter((m) => m.total >= 5 && m.correct === m.total).length,
    crownsTotal: matches.reduce((s, m) => s + m.crowns, 0),
    hardCorrect,
    fastCorrect,
    shopItems: player.cosmetics.owned.length, // só itens comprados (os gratuitos não entram)
    studySessions: matches.filter((m) => m.mode === 'treino').length,
  };
}
