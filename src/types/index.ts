// Modelo de dados do Residuelo.
// Separação em "tabelas" (QUESTIONS, USERS, MATCHES, ANSWERS, ...) para facilitar
// a migração futura para Supabase/Firebase/PostgreSQL.

export type CategoryId = 'GO' | 'CLI' | 'CIR' | 'PRE' | 'PED';
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D', 'E'];

/** 1 = Fácil, 2 = Média, 3 = Difícil, 4 = Muito difícil */
export type Difficulty = 1 | 2 | 3 | 4;

export type QuestionStatus = 'ativa' | 'anulada' | 'divergente' | 'rascunho';

// ---------- QUESTIONS ----------
export interface Question {
  id: string; // ex.: UNOESTE-2024-012
  number?: number; // número na prova original
  text: string; // enunciado original
  alternatives: Partial<Record<Letter, string>>; // 4 ou 5 alternativas (fiel à prova)
  answer: Letter | null; // gabarito oficial (null = anulada / sem gabarito)
  category: CategoryId;
  subtopic: string;
  difficulty: Difficulty;
  difficultySource: 'auto' | 'manual';
  examId: string; // ex.: UNOESTE-2024
  exam: string; // nome legível da prova
  institution: string;
  year: number;
  explanation: string; // curta (mostrada no jogo)
  explanationFull?: string; // detalhada (modal)
  explanationSource?: 'gerada' | 'oficial' | 'editada';
  reference?: string;
  images?: string[]; // arquivos em /banco/img
  status: QuestionStatus;
  statusNote?: string; // motivo de anulação / divergência
  tags?: string[];
  updatedAt?: number;
}

export interface ExamMeta {
  id: string;
  title: string;
  institution: string;
  year: number;
  file: string;
  count: number;
  source?: string;
}

export interface BankIndex {
  version: number;
  generatedAt: string;
  exams: ExamMeta[];
}

// ---------- ANSWERS ----------
export interface AnswerRecord {
  qid: string;
  cat: CategoryId;
  sub: string;
  diff: Difficulty;
  correct: boolean;
  chosen: Letter | null; // null = tempo esgotado
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
  timerMode: 'adaptativo' | 'fixo30' | 'relaxado';
  includeAnnulledInStudy: boolean;
  reduceMotion: boolean;
}

// ---------- MATCHES ----------
export type MatchMode = 'pvp-bot' | 'pvp-local' | 'ranked' | 'treino';

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
