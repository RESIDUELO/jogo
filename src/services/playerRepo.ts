// USERS / ANSWERS / MATCHES — persistência local por "tabela".
// Implementação em localStorage; a interface permite trocar por um backend.
import type { AnswerRecord, MatchSummary, Player } from '../types';
import { ensureDaily } from '../engine/player';
import { emptyCatRecord } from '../data/categories';

export interface PlayerRepository {
  listPlayers(): Player[];
  savePlayer(p: Player): void;
  deletePlayer(id: string): void;
  getActiveId(): string | null;
  setActiveId(id: string | null): void;
  getAnswers(pid: string): AnswerRecord[];
  addAnswers(pid: string, recs: AnswerRecord[]): void;
  getMatches(pid: string): MatchSummary[];
  addMatch(pid: string, m: MatchSummary): void;
  exportAll(): string;
  importAll(json: string): void;
}

const K = {
  users: 'rdl.users',
  active: 'rdl.active',
  answers: (pid: string) => `rdl.answers.${pid}`,
  matches: (pid: string) => `rdl.matches.${pid}`,
};

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    console.warn('Falha ao salvar', key, e);
  }
}

/** Garante campos novos em saves antigos. */
function migrate(p: Player): Player {
  return ensureDaily({
    ...p,
    catXp: { ...emptyCatRecord(0), ...p.catXp },
    inventory: Object.assign({ fifty: 0, time: 0, second: 0, hint: 0, swap: 0 }, p.inventory),
    settings: Object.assign({ sound: true, timerMode: 'adaptativo' as const, includeAnnulledInStudy: false, reduceMotion: false }, p.settings),
  });
}

export class LocalPlayerRepository implements PlayerRepository {
  listPlayers() {
    return read<Player[]>(K.users, []).map(migrate);
  }
  savePlayer(p: Player) {
    const all = read<Player[]>(K.users, []);
    const i = all.findIndex((x) => x.id === p.id);
    if (i >= 0) all[i] = p;
    else all.push(p);
    write(K.users, all);
  }
  deletePlayer(id: string) {
    write(K.users, read<Player[]>(K.users, []).filter((p) => p.id !== id));
    localStorage.removeItem(K.answers(id));
    localStorage.removeItem(K.matches(id));
  }
  getActiveId() {
    return localStorage.getItem(K.active);
  }
  setActiveId(id: string | null) {
    if (id) localStorage.setItem(K.active, id);
    else localStorage.removeItem(K.active);
  }
  getAnswers(pid: string) {
    return read<AnswerRecord[]>(K.answers(pid), []);
  }
  addAnswers(pid: string, recs: AnswerRecord[]) {
    const all = this.getAnswers(pid);
    all.push(...recs);
    write(K.answers(pid), all.slice(-20000));
  }
  getMatches(pid: string) {
    return read<MatchSummary[]>(K.matches(pid), []);
  }
  addMatch(pid: string, m: MatchSummary) {
    const all = this.getMatches(pid);
    all.push(m);
    write(K.matches(pid), all.slice(-500));
  }
  exportAll() {
    const users = this.listPlayers();
    return JSON.stringify(
      {
        app: 'residuelo',
        version: 1,
        exportedAt: new Date().toISOString(),
        users,
        answers: Object.fromEntries(users.map((u) => [u.id, this.getAnswers(u.id)])),
        matches: Object.fromEntries(users.map((u) => [u.id, this.getMatches(u.id)])),
      },
      null,
      1,
    );
  }
  importAll(json: string) {
    const d = JSON.parse(json);
    if (d.app !== 'residuelo') throw new Error('Arquivo não é um save do Residuelo');
    write(K.users, d.users);
    for (const [pid, a] of Object.entries(d.answers ?? {})) write(K.answers(pid), a);
    for (const [pid, m] of Object.entries(d.matches ?? {})) write(K.matches(pid), m);
    if (d.users?.[0]) this.setActiveId(d.users[0].id);
  }
}

export const playerRepo: PlayerRepository = new LocalPlayerRepository();
