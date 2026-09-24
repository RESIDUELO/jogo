import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { COSMETIC } from '../data/shop';
import { levelFromXp } from '../engine/progression';
import { computeStats } from '../engine/stats';
import { weekStart } from '../engine/util';
import { getBackend, type Account, type OnlineBackend, type OnlineProfile } from '../services/online';
import type { Player } from '../types';
import { useStore } from './store';

interface OnlineCtx {
  loading: boolean;
  backend: OnlineBackend | null; // null = online não configurado
  account: Account | null;
  profile: OnlineProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<OnlineCtx | null>(null);

/** Resumo público do jogador (ranking de jogadores). */
function profileSnapshot(p: Player, accountId: string, answers: ReturnType<typeof useStore>['answers'], matches: ReturnType<typeof useStore>['matches']): OnlineProfile {
  const s = computeStats(answers);
  const ws = weekStart();
  const weekXp = matches.filter((m) => m.at >= ws).reduce((a, m) => a + m.xp, 0) + answers.filter((a) => a.at >= ws && a.correct).length * 30;
  const cat_stats: OnlineProfile['cat_stats'] = {};
  for (const [c, a] of Object.entries(s.byCat)) cat_stats[c as keyof typeof cat_stats] = { n: a.n, c: a.c };
  return {
    id: accountId,
    name: p.name,
    avatar: COSMETIC[p.cosmetics.avatar]?.value ?? '🩺',
    xp: p.xp,
    level: levelFromXp(p.xp).level,
    rating: p.rating,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    answered: s.total.n,
    correct: s.total.c,
    best_streak: p.bestAnswerStreak,
    win_streak: p.winStreak,
    cat_stats,
    week_xp: weekXp,
    week_start: new Date(ws).toISOString().slice(0, 10),
  };
}

export function OnlineProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [backend, setBackend] = useState<OnlineBackend | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<OnlineProfile | null>(null);
  const linking = useRef(false);

  useEffect(() => {
    let unsub = () => {};
    getBackend().then(async (b) => {
      setBackend(b);
      if (b) {
        setAccount(await b.getAccount());
        unsub = b.onAuthChange(setAccount);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (backend && account) setProfile(await backend.getProfile(account.id));
  }, [backend, account]);

  // vincula a conta ao perfil local (mescla progresso) ao fazer login
  useEffect(() => {
    const p = store.player;
    if (!backend || !account || !p || p.accountId === account.id || linking.current) return;
    linking.current = true;
    (async () => {
      const remote = await backend.getProfile(account.id);
      const remotePlayed = remote ? remote.wins + remote.losses + remote.draws > 0 : false;
      store.updatePlayer((x) => ({
        ...x,
        accountId: account.id,
        name: remote?.name || x.name,
        xp: Math.max(x.xp, remote?.xp ?? 0),
        rating: remotePlayed ? remote!.rating : x.rating,
        peakRating: Math.max(x.peakRating, remote?.rating ?? 0),
        wins: Math.max(x.wins, remote?.wins ?? 0),
        losses: Math.max(x.losses, remote?.losses ?? 0),
        draws: Math.max(x.draws, remote?.draws ?? 0),
        bestAnswerStreak: Math.max(x.bestAnswerStreak, remote?.best_streak ?? 0),
      }));
      setProfile(remote);
      linking.current = false;
    })().catch(() => (linking.current = false));
  }, [backend, account, store.player, store]);

  // envia o resumo do perfil (debounce) sempre que o progresso muda
  useEffect(() => {
    const p = store.player;
    if (!backend || !account || !p || p.accountId !== account.id) return;
    const t = setTimeout(() => {
      const snap = profileSnapshot(p, account.id, store.answers, store.matches);
      backend
        .saveProfile(snap)
        .then(() => setProfile(snap))
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [backend, account, store.player, store.answers, store.matches]);

  const value: OnlineCtx = {
    loading,
    backend,
    account,
    profile,
    signIn: async (e, pw) => {
      await backend!.signIn(e, pw);
      setAccount(await backend!.getAccount());
    },
    signUp: async (e, pw, name) => {
      const r = await backend!.signUp(e, pw, name);
      setAccount(await backend!.getAccount());
      return r;
    },
    signOut: async () => {
      await backend!.signOut();
      setAccount(null);
      setProfile(null);
      if (store.player?.accountId) store.updatePlayer((x) => ({ ...x, accountId: undefined }));
    },
    refreshProfile,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnline() {
  const c = useContext(Ctx);
  if (!c) throw new Error('OnlineProvider ausente');
  return c;
}
