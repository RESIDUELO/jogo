// Regras de progressão do jogador (puras): XP, níveis, moedas, missões,
// conquistas, streak diário e loja. Recebem o estado e devolvem novo estado + eventos.
import { ACHIEVEMENTS } from '../data/achievements';
import { emptyCatRecord } from '../data/categories';
import { MISSION_BY_ID, MISSION_TEMPLATES, MISSIONS_PER_DAY, type MissionEvent } from '../data/missions';
import { START_RATING } from '../data/progression';
import { COSMETIC, POWERUP } from '../data/shop';
import type { AnswerRecord, CategoryId, MatchSummary, Player, PowerUpId } from '../types';
import { catLevelFromXp, levelFromXp } from './progression';
import { snapshot } from './stats';
import { dayKey, hash01, seeded, shuffle, uid } from './util';

export type GameEvent =
  | { type: 'xp'; amount: number }
  | { type: 'coins'; amount: number }
  | { type: 'levelup'; level: number; title: string }
  | { type: 'catlevel'; cat: CategoryId; level: number }
  | { type: 'achievement'; id: string }
  | { type: 'mission'; id: string }
  | { type: 'item'; id: PowerUpId; amount: number };

export function newPlayer(name: string, avatar = 'av-steth'): Player {
  const p: Player = {
    id: uid('p-'),
    name,
    createdAt: Date.now(),
    xp: 0,
    coins: 100,
    rating: START_RATING,
    peakRating: START_RATING,
    wins: 0,
    losses: 0,
    draws: 0,
    rankedWins: 0,
    rankedLosses: 0,
    winStreak: 0,
    bestWinStreak: 0,
    answerStreak: 0,
    bestAnswerStreak: 0,
    catXp: emptyCatRecord(0),
    inventory: { fifty: 2, time: 2, second: 1, hint: 2, swap: 1 },
    cosmetics: { avatar, frame: 'fr-none', effect: 'fx-classic', title: 'ti-none', owned: [] },
    achievements: {},
    playDays: [],
    daily: { date: '', missions: [], claimedDailyReward: false },
    settings: { sound: true, timerMode: 'adaptativo', includeAnnulledInStudy: false, reduceMotion: false },
  };
  return ensureDaily(p);
}

/** Gera as missões do dia (determinístico por jogador + data). */
export function ensureDaily(p: Player, today = dayKey()): Player {
  if (p.daily.date === today) return p;
  const rnd = seeded(Math.floor(hash01(p.id + today) * 1e9));
  const picks = shuffle(MISSION_TEMPLATES, rnd).slice(0, MISSIONS_PER_DAY);
  return { ...p, daily: { date: today, missions: picks.map((m) => ({ id: m.id, progress: 0, claimed: false })), claimedDailyReward: false } };
}

function gainXp(p: Player, amount: number, events: GameEvent[]): Player {
  if (amount <= 0) return p;
  const before = levelFromXp(p.xp).level;
  const next = { ...p, xp: p.xp + amount };
  const after = levelFromXp(next.xp);
  events.push({ type: 'xp', amount });
  if (after.level > before) {
    events.push({ type: 'levelup', level: after.level, title: after.title });
    // recompensa de nível: moedas + item
    next.coins += 50 * (after.level - before);
    next.inventory = { ...next.inventory, fifty: next.inventory.fifty + 1 };
    events.push({ type: 'item', id: 'fifty', amount: 1 });
  }
  return next;
}

function progressMissions(p: Player, e: MissionEvent, events: GameEvent[]): Player {
  let changed = false;
  const missions = p.daily.missions.map((m) => {
    const t = MISSION_BY_ID[m.id];
    if (!t || m.progress >= t.goal) return m;
    const s = t.step(e);
    let progress = m.progress;
    if (t.absolute) {
      if (s >= 0) progress = Math.max(progress, s);
    } else progress += s;
    progress = Math.min(t.goal, progress);
    if (progress !== m.progress) {
      changed = true;
      if (progress >= t.goal) events.push({ type: 'mission', id: m.id });
    }
    return { ...m, progress };
  });
  return changed ? { ...p, daily: { ...p.daily, missions } } : p;
}

export function markPlayedToday(p: Player): Player {
  const t = dayKey();
  return p.playDays.includes(t) ? p : { ...p, playDays: [...p.playDays, t].slice(-400) };
}

/** Aplica uma resposta ao perfil (XP, XP da categoria, sequência, missões). */
export function applyAnswerToPlayer(p0: Player, rec: AnswerRecord, xp: number): { player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let p = markPlayedToday(ensureDaily(p0));
  const streak = rec.correct ? p.answerStreak + 1 : 0;
  p = { ...p, answerStreak: streak, bestAnswerStreak: Math.max(p.bestAnswerStreak, streak) };
  const catBefore = catLevelFromXp(p.catXp[rec.cat]).level;
  const catGain = rec.correct ? 10 + rec.diff * 5 : 2; // estudar a categoria sempre rende algo
  p = { ...p, catXp: { ...p.catXp, [rec.cat]: p.catXp[rec.cat] + catGain } };
  const catAfter = catLevelFromXp(p.catXp[rec.cat]).level;
  if (catAfter > catBefore) events.push({ type: 'catlevel', cat: rec.cat, level: catAfter });
  p = gainXp(p, xp, events);
  p = progressMissions(p, { type: 'answer', cat: rec.cat, correct: rec.correct, streak, diff: rec.diff }, events);
  return { player: p, events };
}

export function applyMatchToPlayer(
  p0: Player,
  m: MatchSummary,
): { player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let p = markPlayedToday(ensureDaily(p0));
  if (m.mode !== 'treino') {
    const win = m.result === 'win';
    const loss = m.result === 'loss';
    const winStreak = win ? p.winStreak + 1 : loss ? 0 : p.winStreak;
    p = {
      ...p,
      wins: p.wins + (win ? 1 : 0),
      losses: p.losses + (loss ? 1 : 0),
      draws: p.draws + (m.result === 'draw' ? 1 : 0),
      winStreak,
      bestWinStreak: Math.max(p.bestWinStreak, winStreak),
    };
    if (m.mode === 'ranked') {
      const rating = Math.max(100, p.rating + m.ratingDelta);
      p = { ...p, rating, peakRating: Math.max(p.peakRating, rating), rankedWins: p.rankedWins + (win ? 1 : 0), rankedLosses: p.rankedLosses + (loss ? 1 : 0) };
    }
  }
  p = { ...p, coins: p.coins + m.coins };
  if (m.coins) events.push({ type: 'coins', amount: m.coins });
  p = gainXp(p, m.xp, events);
  p = progressMissions(
    p,
    { type: 'match-end', mode: m.mode, won: m.result === 'win', perfect: m.total > 0 && m.correct === m.total, crowns: m.crowns },
    events,
  );
  return { player: p, events };
}

export function claimMission(p: Player, id: string): { player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const t = MISSION_BY_ID[id];
  const m = p.daily.missions.find((x) => x.id === id);
  if (!t || !m || m.claimed || m.progress < t.goal) return { player: p, events };
  let next: Player = { ...p, daily: { ...p.daily, missions: p.daily.missions.map((x) => (x.id === id ? { ...x, claimed: true } : x)) } };
  next.coins += t.reward.coins;
  events.push({ type: 'coins', amount: t.reward.coins });
  if (t.reward.item) {
    next.inventory = { ...next.inventory, [t.reward.item]: next.inventory[t.reward.item] + 1 };
    events.push({ type: 'item', id: t.reward.item, amount: 1 });
  }
  next = gainXp(next, t.reward.xp, events);
  return { player: next, events };
}

/** Recompensa diária: cresce com a sequência de dias (máx. 7). */
export function dailyRewardFor(streak: number) {
  const d = Math.min(7, Math.max(1, streak));
  const items: PowerUpId[] = ['time', 'hint', 'fifty', 'swap', 'time', 'second', 'fifty'];
  return { coins: 20 + d * 10, item: items[d - 1], day: d };
}

export function claimDailyReward(p: Player, streak: number): { player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  if (p.daily.claimedDailyReward) return { player: p, events };
  const r = dailyRewardFor(streak);
  const next: Player = {
    ...markPlayedToday(p),
    coins: p.coins + r.coins,
    inventory: { ...p.inventory, [r.item]: p.inventory[r.item] + 1 },
    daily: { ...p.daily, claimedDailyReward: true },
  };
  events.push({ type: 'coins', amount: r.coins }, { type: 'item', id: r.item, amount: 1 });
  return { player: next, events };
}

export function checkAchievements(p: Player, answers: AnswerRecord[], matches: MatchSummary[]): { player: Player; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const snap = snapshot(p, answers, matches);
  let next = p;
  for (const a of ACHIEVEMENTS) {
    if (next.achievements[a.id]) continue;
    if (a.check(snap)) {
      next = { ...next, achievements: { ...next.achievements, [a.id]: Date.now() }, coins: next.coins + a.coins };
      events.push({ type: 'achievement', id: a.id });
      if (a.coins) events.push({ type: 'coins', amount: a.coins });
      next = gainXp(next, a.xp, events);
    }
  }
  return { player: next, events };
}

export function buyPowerUp(p: Player, id: PowerUpId): Player | null {
  const def = POWERUP[id];
  if (p.coins < def.price) return null;
  return { ...p, coins: p.coins - def.price, inventory: { ...p.inventory, [id]: p.inventory[id] + 1 } };
}

export function buyCosmetic(p: Player, id: string): Player | null {
  const def = COSMETIC[id];
  if (!def || p.cosmetics.owned.includes(id) || def.price === 0) return null;
  if (p.coins < def.price) return null;
  if (def.minLevel && levelFromXp(p.xp).level < def.minLevel) return null;
  return { ...p, coins: p.coins - def.price, cosmetics: { ...p.cosmetics, owned: [...p.cosmetics.owned, id] } };
}

export function ownsCosmetic(p: Player, id: string) {
  const def = COSMETIC[id];
  return !!def && (def.price === 0 || p.cosmetics.owned.includes(id));
}

export function equipCosmetic(p: Player, id: string): Player {
  const def = COSMETIC[id];
  if (!def || !ownsCosmetic(p, id)) return p;
  return { ...p, cosmetics: { ...p.cosmetics, [def.kind]: id } };
}
