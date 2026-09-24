import type { AnswerRecord, CategoryId, Difficulty, Question } from '../types';
import { weightedPick } from './util';

/** Resumo do histórico do jogador por questão (derivado de ANSWERS). */
export interface QHistory {
  seen: number;
  correct: number;
  wrong: number;
  lastAt: number;
  lastCorrect: boolean;
}

export function buildHistory(answers: AnswerRecord[]): Map<string, QHistory> {
  const m = new Map<string, QHistory>();
  for (const a of answers) {
    const h = m.get(a.qid) ?? { seen: 0, correct: 0, wrong: 0, lastAt: 0, lastCorrect: false };
    h.seen++;
    if (a.correct) h.correct++;
    else h.wrong++;
    if (a.at >= h.lastAt) {
      h.lastAt = a.at;
      h.lastCorrect = a.correct;
    }
    m.set(a.qid, h);
  }
  return m;
}

export interface PickOptions {
  category?: CategoryId;
  exclude?: Set<string>; // já usadas na partida (inclui as do adversário)
  wrongOnly?: boolean;
  minDifficulty?: Difficulty;
  now?: number;
  rnd?: () => number;
}

const HOUR = 3600_000;

/**
 * Algoritmo anti-repetição. Peso de cada questão:
 *  - nunca respondida: peso alto;
 *  - errada da última vez: volta com prioridade depois de algumas horas (revisão);
 *  - acertada: peso cresce lentamente com o tempo desde a última exposição;
 *  - vista há menos de 30 min: quase nunca.
 */
export function questionWeight(h: QHistory | undefined, now: number): number {
  if (!h) return 6;
  const hours = (now - h.lastAt) / HOUR;
  if (hours < 0.5) return 0.02;
  if (!h.lastCorrect) return hours < 6 ? 0.6 : 3.5;
  const recency = 1 - Math.exp(-hours / 72); // 0 → 1 em ~3 dias
  const mastery = Math.min(3, h.correct) * 0.35; // muito acertadas aparecem menos
  return Math.max(0.05, 1.8 * recency - mastery * 0.4);
}

export function pickQuestion(pool: Question[], history: Map<string, QHistory>, opts: PickOptions = {}): Question | undefined {
  const now = opts.now ?? Date.now();
  let cands = pool.filter((q) => (!opts.category || q.category === opts.category) && !opts.exclude?.has(q.id));
  if (opts.wrongOnly) cands = cands.filter((q) => (history.get(q.id)?.wrong ?? 0) > 0);
  if (opts.minDifficulty) {
    const harder = cands.filter((q) => q.difficulty >= opts.minDifficulty!);
    if (harder.length) cands = harder;
  }
  if (!cands.length) return undefined;
  return weightedPick(cands, (q) => questionWeight(history.get(q.id), now), opts.rnd);
}
