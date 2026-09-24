import type { Difficulty, MatchMode } from '../types';
import { clamp } from './util';

// Pontuação: o acerto é o que mais importa. Velocidade dá no máximo +20% e
// só conta se a resposta estiver certa; sequência dá até +50%.
export const BASE_POINTS: Record<Difficulty, number> = { 1: 100, 2: 150, 3: 200, 4: 250 };
export const BASE_XP: Record<Difficulty, number> = { 1: 20, 2: 30, 3: 40, 4: 55 };
export const SPEED_MAX = 0.2;
export const STREAK_STEP = 0.1;
export const STREAK_MAX = 0.5;

export interface ScoreBreakdown {
  points: number;
  base: number;
  speedBonus: number;
  streakBonus: number;
  xp: number;
}

export function scoreAnswer(opts: {
  correct: boolean;
  difficulty: Difficulty;
  msUsed: number;
  msLimit: number;
  streakBefore: number; // acertos consecutivos antes desta questão
  secondChance?: boolean;
  crown?: boolean;
}): ScoreBreakdown {
  if (!opts.correct) return { points: 0, base: 0, speedBonus: 0, streakBonus: 0, xp: opts.msUsed >= opts.msLimit ? 2 : 5 };
  const base = BASE_POINTS[opts.difficulty];
  const remaining = clamp(1 - opts.msUsed / opts.msLimit, 0, 1);
  // bônus de velocidade: no máximo +20%, proporcional ao tempo que sobrou
  const speedBonus = Math.round(base * SPEED_MAX * remaining);
  const streakBonus = Math.round(base * Math.min(STREAK_MAX, STREAK_STEP * opts.streakBefore));
  let points = base + speedBonus + streakBonus;
  let xp = BASE_XP[opts.difficulty] + Math.min(15, opts.streakBefore * 3);
  if (opts.crown) {
    points += 100;
    xp += 20;
  }
  if (opts.secondChance) {
    points = Math.round(points / 2);
    xp = Math.round(xp / 2);
  }
  return { points, base, speedBonus, streakBonus, xp };
}

/** Recompensas de fim de partida. */
export function matchRewards(opts: { mode: MatchMode; result: 'win' | 'loss' | 'draw' | 'treino'; winStreak: number; crowns: number; correct: number; total: number }) {
  if (opts.mode === 'treino') {
    const acc = opts.total ? opts.correct / opts.total : 0;
    return { xp: 30 + Math.round(opts.total * 2 * acc), coins: 10 + opts.correct * 2 };
  }
  let xp = 30; // completar a partida
  let coins = 15;
  if (opts.result === 'win') {
    xp += 150 + 25 * Math.min(4, Math.max(0, opts.winStreak - 1));
    coins += 60;
  } else if (opts.result === 'draw') {
    xp += 70;
    coins += 30;
  } else {
    xp += 20;
    coins += 5;
  }
  coins += opts.crowns * 10;
  if (opts.mode === 'ranked') coins = Math.round(coins * 1.2);
  return { xp, coins };
}

/** Tempo por questão: 2 minutos, suficiente para ler o caso clínico com calma. */
export const QUESTION_TIME_MS = 120_000;
