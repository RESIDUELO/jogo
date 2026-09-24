import type { MatchMode, MatchSetupData, Question, ReportItem } from '../types';
import type { MatchState } from './match';
import { isPlayable } from './selection';

/** Questões elegíveis para a partida, respeitando provas e áreas escolhidas. */
export function matchPool(questions: Question[], mode: MatchMode, setup: MatchSetupData): Question[] {
  return questions.filter(
    (q) => isPlayable(q, mode, false) && (!setup.exams.length || setup.exams.includes(q.examId)) && (!setup.cats.length || setup.cats.includes(q.category)),
  );
}

/** Relatório da partida (questões do jogador idx, na ordem). */
export function reportOf(m: MatchState, idx: 0 | 1): ReportItem[] {
  return m.log
    .filter((l) => l.player === idx)
    .map((l) => ({ qid: l.qid, cat: l.cat, chosen: l.chosen, correct: l.correct, ms: Math.round(l.ms), crown: l.crown, points: l.points }));
}
