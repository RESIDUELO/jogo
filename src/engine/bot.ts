import { BOT_TIERS, type BotPersona } from '../data/bots';
import type { Letter, Question } from '../types';
import { altLetters } from '../types';
import { clamp, hash01 } from './util';

export interface BotAnswer {
  chosen: Letter | null;
  correct: boolean;
  ms: number;
}

/**
 * Simula a resposta de um bot. A decisão de acerto é determinística por
 * (bot, questão) — o mesmo bot "sabe" ou "não sabe" uma questão de forma
 * consistente — e depende do nível, da categoria e da dificuldade.
 */
export function botAccuracy(bot: BotPersona, q: Question): number {
  const tier = BOT_TIERS[bot.tier];
  const skill = bot.skill[q.category] ?? 0;
  return clamp(tier.baseAccuracy + skill - (q.difficulty - 2) * 0.09, 0.08, 0.97);
}

export function simulateBotAnswer(bot: BotPersona, q: Question, limitMs: number, matchSalt = ''): BotAnswer {
  const p = botAccuracy(bot, q);
  const knows = hash01(bot.id + q.id + matchSalt.slice(0, 2)) < p;
  const tier = BOT_TIERS[bot.tier];
  const letters = altLetters(q);
  // tempo: proporcional ao tamanho do texto; erros tendem a demorar mais
  const lenFactor = clamp(q.text.length / 450, 0.6, 1.8) * 1.6; // relógio de 2 min
  const jitter = 0.65 + Math.random() * 0.7;
  let ms = tier.meanMs * lenFactor * jitter * (knows ? 1 : 1.25);
  const timeout = !knows && Math.random() < 0.06;
  if (timeout) return { chosen: null, correct: false, ms: limitMs };
  ms = clamp(ms, 3500, limitMs - 800);
  if (knows && q.answer) return { chosen: q.answer, correct: true, ms };
  const wrong = letters.filter((l) => l !== q.answer);
  const chosen = wrong[Math.floor(Math.random() * wrong.length)] ?? letters[0];
  return { chosen, correct: chosen === q.answer, ms };
}
