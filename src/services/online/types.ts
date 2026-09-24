// Contrato do backend online (login, perfis, ranking, matchmaking e partidas).
// Implementações: SupabaseBackend (produção) e MockBackend (testes locais).
import type { MatchState } from '../../engine/match';
import type { CategoryId, MatchSetupData } from '../../types';

export interface Account {
  id: string;
  email: string;
  isGuest: boolean; // login anônimo ("jogar como visitante")
}

export interface OnlineProfile {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  level: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  answered: number;
  correct: number;
  best_streak: number;
  win_streak: number;
  is_guest?: boolean;
  cat_stats: Partial<Record<CategoryId, { n: number; c: number }>>;
  week_xp: number;
  week_start: string | null;
  updated_at?: string;
}

export type OnlineMatchStatus = 'waiting' | 'active' | 'finished' | 'abandoned';

export interface OnlineMatchRow {
  id: string;
  code: string | null;
  status: OnlineMatchStatus;
  ranked: boolean;
  config: MatchSetupData;
  player_a: string;
  player_b: string | null;
  state: MatchState | null;
  version: number;
  updated_at: string;
}

export interface OnlineBackend {
  kind: 'supabase' | 'mock';
  getAccount(): Promise<Account | null>;
  onAuthChange(cb: (a: Account | null) => void): () => void;
  signUp(email: string, password: string, name: string): Promise<{ needsConfirm: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  /** Login anônimo: joga online sem criar conta. */
  signInAsGuest(name: string): Promise<void>;
  /** Transforma o visitante em conta com e-mail/senha (mantém o mesmo id e progresso). */
  upgradeGuest(email: string, password: string, name: string): Promise<{ needsConfirm: boolean }>;
  signOut(): Promise<void>;
  getProfile(id: string): Promise<OnlineProfile | null>;
  saveProfile(p: Partial<OnlineProfile> & { id: string }): Promise<void>;
  ranking(order: 'xp' | 'rating' | 'week_xp', limit?: number): Promise<OnlineProfile[]>;
  /** Procura adversário na fila (mesma configuração, rating dentro da janela). Chamado em
   *  intervalos; também informa se alguém me pareou enquanto eu esperava. Retorna id da partida ou null. */
  findMatch(setup: MatchSetupData, key: string, rating: number, window: number, ranked: boolean): Promise<string | null>;
  leaveQueue(): Promise<void>;
  createInvite(setup: MatchSetupData): Promise<{ id: string; code: string }>;
  joinInvite(code: string): Promise<string>;
  getMatch(id: string): Promise<OnlineMatchRow>;
  subscribeMatch(id: string, cb: (row: OnlineMatchRow) => void): () => void;
  /** Atualização otimista: só grava se a versão bater. */
  updateMatch(id: string, version: number, patch: { state: MatchState; status?: OnlineMatchStatus }): Promise<boolean>;
  myOpenMatches(): Promise<OnlineMatchRow[]>;
}

export function setupKey(s: MatchSetupData, ranked: boolean): string {
  return JSON.stringify({ e: [...s.exams].sort(), c: [...s.cats].sort(), l: !!s.long, r: ranked });
}
