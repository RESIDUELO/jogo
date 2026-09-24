// Repetição espaçada simplificada, inspirada no Anki (SM-2).
import type { Card, Grade } from '../types';
import { addDays, DAY, fmtInterval, MIN } from './util';

export const MASTERED_IVL = 21; // dias — equivalente a um card "maduro" no Anki
const MIN_EASE = 1.3;

export function newCardFields(): Pick<Card, 'state' | 'due' | 'interval' | 'ease' | 'correct' | 'wrong' | 'streak' | 'xpEarned' | 'hard' | 'conquered' | 'lastReviewed'> {
  return { state: 'new', due: 0, interval: 0, ease: 2.5, correct: 0, wrong: 0, streak: 0, xpEarned: 0, hard: false, conquered: 0, lastReviewed: null };
}

/** Retorna os campos de agendamento após uma resposta (sem mexer em estatísticas). */
export function schedule(card: Card, grade: Grade, now = Date.now()): Pick<Card, 'state' | 'due' | 'interval' | 'ease'> {
  let { state, interval, ease } = card;

  if (state === 'new' || state === 'learning') {
    switch (grade) {
      case 1: return { state: 'learning', due: now + 1 * MIN, interval: 0, ease };
      case 2: return { state: 'learning', due: now + 6 * MIN, interval: 0, ease };
      case 3:
        // primeiro acerto de um card novo: mais uma passada em 10 min; depois gradua
        if (state === 'new') return { state: 'learning', due: now + 10 * MIN, interval: 0, ease };
        return { state: 'review', due: addDays(now, 1), interval: 1, ease };
      case 4: return { state: 'review', due: addDays(now, 4), interval: 4, ease: ease + 0.15 };
    }
  }

  // revisão
  const lateDays = Math.max(0, Math.floor((now - card.due) / DAY));
  switch (grade) {
    case 1:
      return { state: 'learning', due: now + 10 * MIN, interval: 0, ease: Math.max(MIN_EASE, ease - 0.2) };
    case 2: {
      interval = Math.max(interval + 1, Math.round(interval * 1.2));
      ease = Math.max(MIN_EASE, ease - 0.15);
      break;
    }
    case 3:
      interval = Math.max(interval + 1, Math.round((interval + lateDays / 2) * ease));
      break;
    case 4:
      interval = Math.max(interval + 2, Math.round((interval + lateDays) * ease * 1.3));
      ease += 0.15;
      break;
  }
  interval = Math.min(interval, 3650);
  return { state: 'review', due: addDays(now, interval), interval, ease };
}

export function previewLabel(card: Card, grade: Grade): string {
  const now = Date.now();
  const s = schedule(card, grade, now);
  return s.state === 'review' ? fmtInterval(s.interval * DAY) : fmtInterval(s.due - now);
}

export const isMastered = (c: Card) => c.state === 'review' && c.interval >= MASTERED_IVL;
export const isDue = (c: Card, now = Date.now()) => c.state !== 'new' && c.due <= now;
export const isOverdue = (c: Card, now = Date.now()) => c.state === 'review' && c.due < addDays(now, 0);

/** Um card é marcado como difícil quando erra muito em relação às tentativas. */
export function shouldMarkHard(c: Card): boolean {
  const attempts = c.correct + c.wrong;
  return attempts >= 5 && c.wrong / attempts >= 0.5;
}

export function accuracy(cards: Card[]): number {
  const c = cards.reduce((s, x) => s + x.correct, 0);
  const w = cards.reduce((s, x) => s + x.wrong, 0);
  return c + w ? c / (c + w) : 0;
}
