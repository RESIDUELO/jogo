// Motor da partida PvP (puro, sem React). Mecânica estilo Perguntados:
//  1. o jogador da vez gira a roleta (5 categorias);
//  2. responde uma questão da categoria sorteada;
//  3. cada acerto enche o medidor de coroa; com o medidor cheio, escolhe uma
//     categoria que ainda não tem e responde a "questão da coroa" (na hora);
//  4. a vez passa ao adversário;
//  5. vence quem juntar `targetCrowns` coroas. Se as rodadas acabarem,
//     desempata por coroas e depois por pontos.
// O estado é serializável — pode ser sincronizado com um servidor no multiplayer online.
import type { CategoryId, Letter, MatchMode, MatchSetupData } from '../types';
import { CATEGORY_IDS } from '../data/categories';

export interface MatchConfig {
  targetCrowns: number;
  maxRounds: number;
  meterSize: number;
}

export const QUICK_MATCH: MatchConfig = { targetCrowns: 3, maxRounds: 10, meterSize: 2 };
export const LONG_MATCH: MatchConfig = { targetCrowns: 5, maxRounds: 18, meterSize: 2 };

/** O que está em disputa: provas e áreas escolhidas antes da partida (vazio = todas). */
export type MatchSetup = MatchSetupData;

/** Ajusta coroas/medidor ao número de áreas escolhidas. */
export function configFor(setup: MatchSetup): MatchConfig {
  const n = setup.cats.length || CATEGORY_IDS.length;
  const base = setup.long ? LONG_MATCH : QUICK_MATCH;
  return { ...base, targetCrowns: Math.min(base.targetCrowns, n), meterSize: n <= 2 ? 3 : base.meterSize };
}

export const setupCats = (s: MatchSetup): CategoryId[] => (s.cats.length ? CATEGORY_IDS.filter((c) => s.cats.includes(c)) : CATEGORY_IDS);

export interface Competitor {
  id: string;
  name: string;
  avatar: string;
  frame?: string;
  kind: 'human' | 'bot';
  botId?: string;
  level: number;
  rating: number;
}

export interface CompetitorState extends Competitor {
  crowns: CategoryId[];
  meter: number;
  score: number;
  correct: number;
  answered: number;
  streak: number;
  bestStreak: number;
  totalMs: number;
  wrongIds: string[];
  powerupsUsed: number;
}

export interface TurnLog {
  player: 0 | 1;
  round: number;
  cat: CategoryId;
  qid: string;
  crown: boolean;
  chosen: Letter | null;
  correct: boolean;
  ms: number;
  points: number;
  xp: number;
}

export type Phase = 'spin' | 'crown-choice' | 'question' | 'feedback' | 'end';

export interface MatchState {
  id: string;
  mode: MatchMode;
  config: MatchConfig;
  setup: MatchSetup;
  players: [CompetitorState, CompetitorState];
  turn: 0 | 1;
  round: number;
  phase: Phase;
  cat: CategoryId | null;
  crownQuestion: boolean;
  qid: string | null;
  usedQids: string[];
  log: TurnLog[];
  winner: 0 | 1 | 'draw' | null;
  endReason?: 'crowns' | 'rounds' | 'forfeit';
  startedAt: number;
}

function initCompetitor(c: Competitor): CompetitorState {
  return { ...c, crowns: [], meter: 0, score: 0, correct: 0, answered: 0, streak: 0, bestStreak: 0, totalMs: 0, wrongIds: [], powerupsUsed: 0 };
}

export function createMatch(id: string, mode: MatchMode, a: Competitor, b: Competitor, setup: MatchSetup = { exams: [], cats: [] }): MatchState {
  return {
    id,
    mode,
    config: configFor(setup),
    setup,
    players: [initCompetitor(a), initCompetitor(b)],
    turn: 0,
    round: 1,
    phase: 'spin',
    cat: null,
    crownQuestion: false,
    qid: null,
    usedQids: [],
    log: [],
    winner: null,
    startedAt: Date.now(),
  };
}

export const current = (m: MatchState) => m.players[m.turn];

export function missingCrowns(p: CompetitorState, m: MatchState): CategoryId[] {
  return setupCats(m.setup).filter((c) => !p.crowns.includes(c));
}

/** Última área sorteada (para a roleta evitar repetições seguidas). */
export const lastSpunCat = (m: MatchState): CategoryId | null => m.log[m.log.length - 1]?.cat ?? null;

/** Resultado da roleta → abre a questão da categoria. */
export function applySpin(m: MatchState, cat: CategoryId): MatchState {
  return { ...m, phase: 'question', cat, crownQuestion: false };
}

export function applyCrownChoice(m: MatchState, cat: CategoryId): MatchState {
  return { ...m, phase: 'question', cat, crownQuestion: true };
}

export function setQuestion(m: MatchState, qid: string): MatchState {
  return { ...m, qid, usedQids: m.usedQids.includes(qid) ? m.usedQids : [...m.usedQids, qid] };
}

export interface AnswerInput {
  chosen: Letter | null;
  correct: boolean;
  ms: number;
  points: number;
  xp: number;
}

/** Registra a resposta do jogador da vez e vai para a fase de feedback. */
export function applyAnswer(m: MatchState, a: AnswerInput): { match: MatchState; crownWon: boolean; meterFull: boolean } {
  const players = [...m.players] as [CompetitorState, CompetitorState];
  const p = { ...players[m.turn] };
  p.answered++;
  p.totalMs += a.ms;
  p.score += a.points;
  let crownWon = false;
  if (a.correct) {
    p.correct++;
    p.streak++;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    if (m.crownQuestion && m.cat && !p.crowns.includes(m.cat)) {
      p.crowns = [...p.crowns, m.cat];
      crownWon = true;
      p.meter = 0;
    } else if (!m.crownQuestion) {
      p.meter = Math.min(m.config.meterSize, p.meter + 1);
    }
  } else {
    p.streak = 0;
    if (m.qid) p.wrongIds = [...p.wrongIds, m.qid];
    if (m.crownQuestion) p.meter = 0;
  }
  players[m.turn] = p;
  const log: TurnLog = { player: m.turn, round: m.round, cat: m.cat!, qid: m.qid!, crown: m.crownQuestion, chosen: a.chosen, correct: a.correct, ms: a.ms, points: a.points, xp: a.xp };
  const meterFull = !m.crownQuestion && a.correct && p.meter >= m.config.meterSize && missingCrowns(p, m).length > 0;
  return { match: { ...m, players, phase: 'feedback', log: [...m.log, log] }, crownWon, meterFull };
}

/**
 * Após o feedback: verifica vitória; se o medidor encheu, o mesmo jogador
 * escolhe a coroa; senão a vez passa ao adversário.
 */
export function advance(m: MatchState): MatchState {
  const p = current(m);
  if (p.crowns.length >= m.config.targetCrowns) {
    return { ...m, phase: 'end', winner: m.turn, endReason: 'crowns', qid: null };
  }
  if (!m.crownQuestion && p.meter >= m.config.meterSize && missingCrowns(p, m).length > 0 && m.log[m.log.length - 1]?.correct) {
    return { ...m, phase: 'crown-choice', qid: null, cat: null };
  }
  const nextTurn: 0 | 1 = m.turn === 0 ? 1 : 0;
  const nextRound = nextTurn === 0 ? m.round + 1 : m.round;
  if (nextRound > m.config.maxRounds) return finishByRounds(m);
  return { ...m, turn: nextTurn, round: nextRound, phase: 'spin', cat: null, qid: null, crownQuestion: false };
}

function finishByRounds(m: MatchState): MatchState {
  const [a, b] = m.players;
  let winner: 0 | 1 | 'draw';
  if (a.crowns.length !== b.crowns.length) winner = a.crowns.length > b.crowns.length ? 0 : 1;
  else if (a.score !== b.score) winner = a.score > b.score ? 0 : 1;
  else winner = 'draw';
  return { ...m, phase: 'end', winner, endReason: 'rounds', qid: null };
}

export function forfeit(m: MatchState, loser: 0 | 1): MatchState {
  return { ...m, phase: 'end', winner: loser === 0 ? 1 : 0, endReason: 'forfeit' };
}
