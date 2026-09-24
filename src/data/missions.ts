import type { CategoryId, MatchMode, PowerUpId } from '../types';

/** Evento que faz missões avançarem. */
export type MissionEvent =
  | { type: 'answer'; cat: CategoryId; correct: boolean; streak: number; diff: number }
  | { type: 'match-end'; mode: MatchMode; won: boolean; perfect: boolean; crowns: number };

export interface MissionTemplate {
  id: string;
  text: string;
  goal: number;
  reward: { xp: number; coins: number; item?: PowerUpId };
  /** Quanto o evento adiciona ao progresso (0 = nada). Se `absolute`, define o valor. */
  step: (e: MissionEvent) => number;
  absolute?: boolean;
}

const catName: Record<CategoryId, string> = { GO: 'GO', CLI: 'Clínica', CIR: 'Cirurgia', PRE: 'Preventiva', PED: 'Pediatria' };

const catMission = (cat: CategoryId): MissionTemplate => ({
  id: `answer-${cat}`,
  text: `Responda 10 cartões de ${catName[cat]}`,
  goal: 10,
  reward: { xp: 80, coins: 40 },
  step: (e) => (e.type === 'answer' && e.cat === cat ? 1 : 0),
});

export const MISSION_TEMPLATES: MissionTemplate[] = [
  catMission('GO'),
  catMission('CLI'),
  catMission('CIR'),
  catMission('PRE'),
  catMission('PED'),
  { id: 'answer-20', text: 'Responda 20 cartões', goal: 20, reward: { xp: 100, coins: 50, item: 'time' }, step: (e) => (e.type === 'answer' ? 1 : 0) },
  { id: 'correct-15', text: 'Acerte 15 cartões', goal: 15, reward: { xp: 120, coins: 60 }, step: (e) => (e.type === 'answer' && e.correct ? 1 : 0) },
  { id: 'streak-5', text: 'Consiga 5 acertos consecutivos', goal: 5, reward: { xp: 100, coins: 50, item: 'fifty' }, absolute: true, step: (e) => (e.type === 'answer' ? e.streak : -1) },
  { id: 'win-2', text: 'Vença 2 partidas', goal: 2, reward: { xp: 150, coins: 80, item: 'second' }, step: (e) => (e.type === 'match-end' && e.won && e.mode !== 'treino' ? 1 : 0) },
  { id: 'play-pvp', text: 'Jogue pelo menos uma partida PvP', goal: 1, reward: { xp: 60, coins: 40 }, step: (e) => (e.type === 'match-end' && e.mode !== 'treino' ? 1 : 0) },
  { id: 'hard-3', text: 'Consiga 8 acertos consecutivos', goal: 8, reward: { xp: 120, coins: 60, item: 'hint' }, absolute: true, step: (e) => (e.type === 'answer' ? e.streak : -1) },
  { id: 'crowns-3', text: 'Conquiste 3 coroas', goal: 3, reward: { xp: 100, coins: 60 }, step: (e) => (e.type === 'match-end' ? e.crowns : 0) },
  { id: 'train-1', text: 'Complete um treino', goal: 1, reward: { xp: 60, coins: 30, item: 'swap' }, step: (e) => (e.type === 'match-end' && e.mode === 'treino' ? 1 : 0) },
];

export const MISSION_BY_ID: Record<string, MissionTemplate> = Object.fromEntries(MISSION_TEMPLATES.map((m) => [m.id, m]));

export const MISSIONS_PER_DAY = 4;
