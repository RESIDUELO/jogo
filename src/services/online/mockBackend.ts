// Backend online SIMULADO (só para desenvolvimento/testes): "servidor" em
// localStorage, compartilhado entre abas/iframes da mesma origem. Ativado com
// ?online=mock na URL; ?slot=A|B separa sessões para simular dois jogadores.
import type { Account, OnlineBackend, OnlineMatchRow, OnlineProfile } from './types';

interface Db {
  accounts: Record<string, { id: string; password: string }>;
  profiles: Record<string, OnlineProfile>;
  matches: Record<string, OnlineMatchRow>;
  queue: Record<string, { rating: number; key: string; config: unknown; ranked: boolean; match: string | null; created: number; seen: number }>;
}
const DB_KEY = 'mock.db';
const EV = 'mock-db-change';

function load(): Db {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '') as Db;
  } catch {
    return { accounts: {}, profiles: {}, matches: {}, queue: {} };
  }
}
function save(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  window.dispatchEvent(new Event(EV));
}
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const delay = () => new Promise((r) => setTimeout(r, 40));

export function createMockBackend(slot: string): OnlineBackend {
  const SESSION = `mock.session.${slot}`;
  const listeners = new Set<(a: Account | null) => void>();
  const me = (): Account | null => {
    const s = localStorage.getItem(SESSION);
    return s ? (JSON.parse(s) as Account) : null;
  };
  const setMe = (a: Account | null) => {
    if (a) localStorage.setItem(SESSION, JSON.stringify(a));
    else localStorage.removeItem(SESSION);
    listeners.forEach((l) => l(a));
  };
  const need = () => {
    const a = me();
    if (!a) throw new Error('não autenticado');
    return a;
  };
  const blankProfile = (uid: string, name: string): OnlineProfile => ({
    id: uid,
    name,
    avatar: '🩺',
    xp: 0,
    level: 1,
    rating: 1000,
    wins: 0,
    losses: 0,
    draws: 0,
    answered: 0,
    correct: 0,
    best_streak: 0,
    win_streak: 0,
    cat_stats: {},
    week_xp: 0,
    week_start: null,
  });

  return {
    kind: 'mock',
    async getAccount() {
      return me();
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signUp(email, password, name) {
      await delay();
      const db = load();
      if (db.accounts[email]) throw new Error('E-mail já cadastrado');
      const uid = id();
      db.accounts[email] = { id: uid, password };
      db.profiles[uid] = blankProfile(uid, name);
      save(db);
      setMe({ id: uid, email, isGuest: false });
      return { needsConfirm: false };
    },
    async signInAsGuest(name) {
      await delay();
      const db = load();
      const uid = id();
      db.profiles[uid] = { ...blankProfile(uid, name || 'Visitante'), is_guest: true };
      save(db);
      setMe({ id: uid, email: '', isGuest: true });
    },
    async upgradeGuest(email, password, name) {
      const a = need();
      const db = load();
      if (db.accounts[email]) throw new Error('E-mail já cadastrado');
      db.accounts[email] = { id: a.id, password };
      db.profiles[a.id] = { ...db.profiles[a.id], name, is_guest: false };
      save(db);
      setMe({ id: a.id, email, isGuest: false });
      return { needsConfirm: false };
    },
    async signIn(email, password) {
      await delay();
      const acc = load().accounts[email];
      if (!acc || acc.password !== password) throw new Error('E-mail ou senha incorretos');
      setMe({ id: acc.id, email, isGuest: false });
    },
    async signOut() {
      setMe(null);
    },
    async getProfile(uid) {
      return load().profiles[uid] ?? null;
    },
    async saveProfile(p) {
      const db = load();
      db.profiles[p.id] = { ...(db.profiles[p.id] ?? blankProfile(p.id, 'Jogador')), ...p, updated_at: now() };
      save(db);
    },
    async ranking(order, limit = 100) {
      return Object.values(load().profiles)
        .filter((p) => !p.is_guest)
        .sort((a, b) => b[order] - a[order])
        .slice(0, limit);
    },
    async findMatch(setup, key, rating, window, ranked) {
      await delay();
      const a = need();
      const db = load();
      const mine = db.queue[a.id];
      if (mine?.match) {
        const m = mine.match;
        delete db.queue[a.id];
        save(db);
        return m;
      }
      const t = Date.now();
      const cand = Object.entries(db.queue)
        .filter(([uid, q]) => uid !== a.id && q.key === key && !q.match && Math.abs(q.rating - rating) <= window && t - q.seen < 15000)
        .sort((x, y) => x[1].created - y[1].created)[0];
      if (cand) {
        const mid = id();
        db.matches[mid] = { id: mid, code: null, status: 'active', ranked, config: setup, player_a: cand[0], player_b: a.id, state: null, version: 0, updated_at: now() };
        db.queue[cand[0]].match = mid;
        delete db.queue[a.id];
        save(db);
        return mid;
      }
      db.queue[a.id] = { rating, key, config: setup, ranked, match: null, created: mine && mine.key === key ? mine.created : t, seen: t };
      save(db);
      return null;
    },
    async leaveQueue() {
      const a = me();
      if (!a) return;
      const db = load();
      delete db.queue[a.id];
      save(db);
    },
    async createInvite(setup) {
      const a = need();
      const db = load();
      const mid = id();
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      db.matches[mid] = { id: mid, code, status: 'waiting', ranked: false, config: setup, player_a: a.id, player_b: null, state: null, version: 0, updated_at: now() };
      save(db);
      return { id: mid, code };
    },
    async joinInvite(code) {
      const a = need();
      const db = load();
      const m = Object.values(db.matches).find((x) => x.code === code.trim().toUpperCase());
      if (!m) throw new Error('Código inválido ou sala já iniciada');
      if (m.player_a === a.id || m.player_b === a.id) return m.id;
      if (m.status !== 'waiting' || m.player_b) throw new Error('Código inválido ou sala já iniciada');
      m.player_b = a.id;
      m.status = 'active';
      m.updated_at = now();
      save(db);
      return m.id;
    },
    async getMatch(mid) {
      const m = load().matches[mid];
      if (!m) throw new Error('Partida não encontrada');
      return m;
    },
    subscribeMatch(mid, cb) {
      let last = '';
      const check = () => {
        const m = load().matches[mid];
        if (!m) return;
        const sig = m.version + m.status;
        if (sig !== last) {
          last = sig;
          cb(m);
        }
      };
      const onStorage = (e: StorageEvent) => e.key === DB_KEY && check();
      window.addEventListener('storage', onStorage);
      window.addEventListener(EV, check);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(EV, check);
      };
    },
    async updateMatch(mid, version, patch) {
      await delay();
      const db = load();
      const m = db.matches[mid];
      if (!m || m.version !== version) return false;
      Object.assign(m, patch, { version: version + 1, updated_at: now() });
      save(db);
      return true;
    },
    async myOpenMatches() {
      const a = me();
      if (!a) return [];
      return Object.values(load().matches).filter((m) => (m.player_a === a.id || m.player_b === a.id) && (m.status === 'waiting' || m.status === 'active'));
    },
  };
}
