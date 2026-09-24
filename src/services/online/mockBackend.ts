// Backend online SIMULADO (só para desenvolvimento/testes): "servidor" em
// localStorage, compartilhado entre abas/iframes da mesma origem. Ativado com
// ?online=mock na URL; ?slot=A|B separa sessões para simular dois jogadores.
import { CHALLENGE_TTL_MS, type Account, type Challenge, type LobbyEntry, type OnlineBackend, type OnlineMatchRow, type OnlineProfile } from './types';

interface Db {
  accounts: Record<string, { id: string; password: string }>;
  profiles: Record<string, OnlineProfile>;
  matches: Record<string, OnlineMatchRow>;
  lobby: Record<string, LobbyEntry>;
  challenges: Record<string, Challenge>;
}
const DB_KEY = 'mock.db';
const EV = 'mock-db-change';

function load(): Db {
  try {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '') as Db;
    return { ...db, lobby: db.lobby ?? {}, challenges: db.challenges ?? {} };
  } catch {
    return { accounts: {}, profiles: {}, matches: {}, lobby: {}, challenges: {} };
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
    async lobbyEnter(p, ranked) {
      const a = need();
      const db = load();
      db.lobby[a.id] = { user_id: a.id, name: p.name, avatar: p.avatar, level: p.level, rating: p.rating, ranked, is_guest: p.isGuest, seen_at: now() };
      save(db);
    },
    async lobbyLeave() {
      const a = me();
      if (!a) return;
      const db = load();
      delete db.lobby[a.id];
      save(db);
    },
    async lobbyList(ranked) {
      await delay();
      const a = me();
      const t = Date.now();
      return Object.values(load().lobby).filter((l) => l.user_id !== a?.id && l.ranked === ranked && t - Date.parse(l.seen_at) < 20_000);
    },
    async sendChallenge(to, setup, ranked) {
      await delay();
      const a = need();
      const db = load();
      const mine = db.lobby[a.id];
      const target = db.lobby[to];
      if (!mine) throw new Error('Entre na busca de adversário primeiro');
      if (!target || Date.now() - Date.parse(target.seen_at) > 20_000) throw new Error('Essa pessoa não está mais disponível');
      for (const c of Object.values(db.challenges)) {
        if (c.from_id === a.id && c.status === 'pending') {
          c.status = 'cancelled';
          if (db.matches[c.match_id]) db.matches[c.match_id].status = 'abandoned';
        }
      }
      const mid = id();
      db.matches[mid] = { id: mid, code: null, status: 'waiting', ranked, config: setup, player_a: a.id, player_b: null, state: null, version: 0, updated_at: now() };
      const cid = id();
      db.challenges[cid] = { id: cid, from_id: a.id, to_id: to, from_name: mine.name, from_avatar: mine.avatar, from_level: mine.level, from_rating: mine.rating, match_id: mid, setup, ranked, status: 'pending', created_at: now() };
      save(db);
      return cid;
    },
    async getChallenge(cid) {
      return load().challenges[cid] ?? null;
    },
    async myChallenges() {
      await delay();
      const a = me();
      const t = Date.now();
      return Object.values(load().challenges).filter((c) => c.to_id === a?.id && c.status === 'pending' && t - Date.parse(c.created_at) < CHALLENGE_TTL_MS);
    },
    async answerChallenge(cid, accept) {
      await delay();
      const a = need();
      const db = load();
      const c = db.challenges[cid];
      if (!c || c.to_id !== a.id) throw new Error('Convite não encontrado');
      if (c.status !== 'pending' || Date.now() - Date.parse(c.created_at) > CHALLENGE_TTL_MS) throw new Error('Esse convite não vale mais');
      const m = db.matches[c.match_id];
      if (!accept) {
        c.status = 'declined';
        if (m?.status === 'waiting') m.status = 'abandoned';
        save(db);
        return null;
      }
      if (!m || m.status !== 'waiting' || m.player_b) throw new Error('Esse convite não vale mais');
      Object.assign(m, { player_b: a.id, status: 'active', updated_at: now() });
      c.status = 'accepted';
      for (const o of Object.values(db.challenges)) {
        if (o.to_id === a.id && o.status === 'pending') {
          o.status = 'declined';
          if (db.matches[o.match_id]) db.matches[o.match_id].status = 'abandoned';
        }
      }
      delete db.lobby[a.id];
      delete db.lobby[c.from_id];
      save(db);
      return m.id;
    },
    async cancelChallenge(cid) {
      const a = need();
      const db = load();
      const c = db.challenges[cid];
      if (c && c.from_id === a.id && c.status === 'pending') {
        c.status = 'cancelled';
        if (db.matches[c.match_id]?.status === 'waiting') db.matches[c.match_id].status = 'abandoned';
        save(db);
      }
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
