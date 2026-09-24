// Modelo de dados do Residuelo.
// Separação em "tabelas" (QUESTIONS, USERS, MATCHES, ANSWERS, ...) para facilitar
// a migração futura para Supabase/Firebase/PostgreSQL.

export type CategoryId = 'GO' | 'CLI' | 'CIR' | 'PRE' | 'PED';
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D', 'E'];

/** 1 = Fácil, 2 = Média, 3 = Difícil, 4 = Muito difícil */
export type Difficulty = 1 | 2 | 3 | 4;

// ---------- FLASHCARDS ----------
/** Flashcard do baralho (public/cards/deck.json, gerado por tools/build_cards.py). */
export interface Flashcard {
  id: string; // estável: hash da frente
  front: string; // pergunta
  back: string; // resposta
  area: CategoryId;
  path: string[]; // subtemas aninhados, ex.: ["Cardiologia", "Insuficiência cardíaca"]
  extra?: string; // comentário/explicação opcional
  tags?: string[];
  images?: string[]; // arquivos em public/cards/img/
}

export interface DeckFile {
  version: number;
  generatedAt: string;
  cards: Flashcard[];
}

/** Formato das respostas na partida. */
export type AnswerFormat = 'mc' | 'flash'; // múltipla escolha automática | flashcard (autoavaliação)

/** Pergunta jogável, derivada de um flashcard. */
export interface Question {
  id: string; // = id do flashcard
  kind: AnswerFormat;
  text: string; // frente do flashcard
  answerText: string; // verso do flashcard
  alternatives: Partial<Record<Letter, string>>; // só em múltipla escolha
  answer: Letter | null; // alternativa correta (múltipla escolha)
  category: CategoryId;
  path: string[];
  subtopic: string; // caminho legível: "Cardiologia › Insuficiência cardíaca"
  difficulty: Difficulty;
  explanation: string; // verso (+ comentário)
  explanationFull?: string;
  images?: string[];
  altImages?: Partial<Record<Letter, string>>;
  tags?: string[];
}

// ---------- ANSWERS ----------
export interface AnswerRecord {
  qid: string;
  cat: CategoryId;
  sub: string;
  diff: Difficulty;
  correct: boolean;
  chosen: Letter | null; // null = tempo esgotado ou flashcard (autoavaliação)
  ms: number; // tempo de resposta
  at: number; // timestamp
  mode: MatchMode;
  matchId?: string;
}

// ---------- USERS ----------
export type PowerUpId = 'fifty' | 'time' | 'second' | 'hint' | 'swap';

export interface CosmeticsState {
  avatar: string; // id do avatar
  frame: string;
  effect: string;
  title: string;
  owned: string[]; // ids de itens de loja
}

export interface DailyState {
  date: string; // YYYY-MM-DD
  missions: MissionProgress[];
  claimedDailyReward: boolean;
}

export interface MissionProgress {
  id: string; // id do template
  progress: number;
  claimed: boolean;
}

export interface Player {
  id: string;
  name: string;
  accountId?: string; // conta online vinculada (login)
  createdAt: number;
  xp: number;
  coins: number;
  rating: number; // Elo
  peakRating: number;
  wins: number;
  losses: number;
  draws: number;
  rankedWins: number;
  rankedLosses: number;
  winStreak: number;
  bestWinStreak: number;
  answerStreak: number; // acertos seguidos (entre partidas)
  bestAnswerStreak: number;
  catXp: Record<CategoryId, number>;
  inventory: Record<PowerUpId, number>;
  cosmetics: CosmeticsState;
  achievements: Record<string, number>; // id -> timestamp de desbloqueio
  playDays: string[]; // dias (YYYY-MM-DD) com atividade
  daily: DailyState;
  settings: PlayerSettings;
}

export interface PlayerSettings {
  sound: boolean;
  reduceMotion: boolean;
}

// ---------- MATCHES ----------
export type MatchMode = 'pvp-bot' | 'pvp-local' | 'pvp-online' | 'ranked' | 'treino';

/** O que está em disputa, escolhido por quem cria a partida/sala. */
export interface MatchSetupData {
  /** Temas escolhidos: chaves "AREA" ou "AREA|Subtema|Sub-subtema" (vazio = todos). */
  topics: string[];
  /** Segundos por pergunta. */
  timeSec: number;
  format: AnswerFormat;
  long?: boolean;
}

/** Linha do relatório de fim de partida. */
export interface ReportItem {
  qid: string;
  cat: CategoryId;
  chosen: Letter | null;
  correct: boolean;
  ms: number;
  crown?: boolean;
  points: number;
}

export interface MatchSummary {
  id: string;
  mode: MatchMode;
  at: number;
  opponentName: string;
  opponentIsBot: boolean;
  result: 'win' | 'loss' | 'draw' | 'treino';
  score: number;
  oppScore: number;
  crowns: number;
  oppCrowns: number;
  correct: number;
  total: number;
  avgMs: number;
  xp: number;
  coins: number;
  ratingDelta: number;
  wrongIds: string[];
  botId?: string;
  report?: ReportItem[];
  setup?: MatchSetupData;
}

// ---------- RANKINGS ----------
export interface RankingEntry {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  accuracy: number; // 0..1
  streak: number;
  rating: number;
  catAccuracy: Record<CategoryId, number>;
  weekXp: number;
}

/** Letras das alternativas da questão (inclui alternativas que são só imagem). */
export function altLetters(q: Pick<Question, 'alternatives' | 'altImages'>): Letter[] {
  return LETTERS.filter((l) => q.alternatives[l] !== undefined || !!q.altImages?.[l]);
}
