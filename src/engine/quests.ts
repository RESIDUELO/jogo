import type { Quest, QuestKind, Reward } from '../types';
import { uid } from './util';

interface QuestTemplate { kind: QuestKind; title: (n: number) => string; targets: number[]; reward: (n: number) => Reward }

const DAILY: QuestTemplate[] = [
  { kind: 'answer', title: n => `Responda ${n} flashcards`, targets: [20, 30, 50], reward: n => ({ gold: n * 6 }) },
  { kind: 'correct', title: n => `Acerte ${n} flashcards`, targets: [15, 25, 40], reward: n => ({ xp: n * 8 }) },
  { kind: 'kills', title: n => `Derrote ${n} inimigos`, targets: [3, 5, 8], reward: n => ({ xp: n * 40, hpPotion: 1 }) },
  { kind: 'combo', title: n => `Alcance um combo de ${n} acertos`, targets: [5, 10, 15], reward: n => (n >= 10 ? { chest: 'raro' } : { chest: 'incomum' }) },
  { kind: 'overdue', title: n => `Revise ${n} cards pendentes`, targets: [10, 20, 30], reward: n => ({ fragments: Math.ceil(n / 5), gold: n * 5 }) },
  { kind: 'mastered', title: n => `Responda "Dominei" em ${n} cards`, targets: [5, 10], reward: n => ({ manaPotion: 1, gold: n * 10 }) },
  { kind: 'hardCards', title: n => `Acerte ${n} cards difíceis`, targets: [2, 3], reward: () => ({ chest: 'raro' }) },
];

const WEEKLY: QuestTemplate[] = [
  { kind: 'answer', title: n => `Responda ${n} flashcards nesta semana`, targets: [250, 400], reward: n => ({ xp: n * 3, chest: 'epico' }) },
  { kind: 'streakDays', title: n => `Estude em ${n} dias diferentes`, targets: [5, 7], reward: () => ({ chest: 'epico', gold: 800 }) },
  { kind: 'boss', title: n => `Derrote ${n} boss${n > 1 ? 'es' : ''}`, targets: [1, 2], reward: () => ({ chest: 'raro', fragments: 10 }) },
  { kind: 'kills', title: n => `Derrote ${n} inimigos nesta semana`, targets: [30, 50], reward: n => ({ xp: n * 30, gold: n * 10 }) },
  { kind: 'sessions', title: n => `Conclua ${n} sessões de estudo`, targets: [5, 8], reward: () => ({ chest: 'raro', manaPotion: 2 }) },
];

function build(t: QuestTemplate, scale: number): Quest {
  const target = t.targets[Math.min(t.targets.length - 1, scale)];
  return { id: uid(), kind: t.kind, title: t.title(target), target, progress: 0, reward: t.reward(target), claimed: false };
}

function pickTemplates(pool: QuestTemplate[], n: number): QuestTemplate[] {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
}

/** Quests diárias escalam levemente com o nível do jogador. */
export function generateDaily(level: number): Quest[] {
  const scale = level < 8 ? 0 : level < 20 ? 1 : 2;
  const chosen = pickTemplates(DAILY.filter(t => t.kind !== 'answer'), 2);
  return [build(DAILY[0], scale), ...chosen.map(t => build(t, scale))];
}

export function generateWeekly(level: number): Quest[] {
  const scale = level < 15 ? 0 : 1;
  return pickTemplates(WEEKLY, 3).map(t => build(t, scale));
}

export function describeReward(r: Reward): string {
  const parts: string[] = [];
  if (r.xp) parts.push(`${r.xp} XP`);
  if (r.gold) parts.push(`${r.gold} ouro`);
  if (r.chest) parts.push(`Baú ${chestName(r.chest)}`);
  if (r.hpPotion) parts.push(`${r.hpPotion}× Poção de Vida`);
  if (r.manaPotion) parts.push(`${r.manaPotion}× Poção de Mana`);
  if (r.fragments) parts.push(`${r.fragments} fragmentos`);
  return parts.join(' · ');
}

const CHEST_NAMES: Record<string, string> = { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário', mitico: 'Mítico' };
export const chestName = (r: string) => CHEST_NAMES[r] ?? r;
