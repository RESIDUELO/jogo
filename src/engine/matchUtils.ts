import type { MatchSetupData, Question, ReportItem } from '../types';
import { inTopics } from './cards';
import type { MatchState } from './match';

/** Cartões (como perguntas-base) dentro dos temas escolhidos. */
export function matchPool(questions: Iterable<Question>, setup: Pick<MatchSetupData, 'topics'>): Question[] {
  return [...questions].filter((q) => inTopics({ area: q.category, path: q.path }, setup.topics));
}

/** Relatório da partida (questões do jogador idx, na ordem). */
export function reportOf(m: MatchState, idx: 0 | 1): ReportItem[] {
  return m.log
    .filter((l) => l.player === idx)
    .map((l) => ({ qid: l.qid, cat: l.cat, chosen: l.chosen, correct: l.correct, ms: Math.round(l.ms), crown: l.crown, points: l.points }));
}
