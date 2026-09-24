import type { SupabaseClient } from '@supabase/supabase-js';
import type { MatchSetupData } from '../../types';
import type { Account, OnlineBackend, OnlineMatchRow, OnlineProfile } from './types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createSupabaseBackend(url: string, anonKey: string): Promise<OnlineBackend> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const toAccount = (u: { id: string; email?: string; is_anonymous?: boolean } | null | undefined): Account | null =>
    u ? { id: u.id, email: u.email ?? '', isGuest: !!u.is_anonymous } : null;

  return {
    kind: 'supabase',
    async getAccount() {
      const { data } = await sb.auth.getSession();
      return toAccount(data.session?.user);
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(toAccount(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password, name) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
      fail(error);
      return { needsConfirm: !data.session };
    },
    async signInAsGuest(name) {
      const { error } = await sb.auth.signInAnonymously({ options: { data: { name } } });
      if (error && /anonymous/i.test(error.message)) throw new Error('O modo visitante ainda não foi ativado no servidor (Supabase → Authentication → "Allow anonymous sign-ins").');
      fail(error);
    },
    async upgradeGuest(email, password, name) {
      const { data, error } = await sb.auth.updateUser({ email, password, data: { name } }, { emailRedirectTo: location.origin + location.pathname });
      fail(error);
      // com confirmação de e-mail ligada, o e-mail só vale depois do link
      return { needsConfirm: !!data.user && !data.user.email_confirmed_at && !!data.user.new_email };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      fail(error);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async getProfile(id) {
      const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
      fail(error);
      return data as OnlineProfile | null;
    },
    async saveProfile(p) {
      const { error } = await sb.from('profiles').upsert({ ...p, updated_at: new Date().toISOString() });
      fail(error);
    },
    async ranking(order, limit = 100) {
      const { data, error } = await sb.from('profiles').select('*').eq('is_guest', false).order(order, { ascending: false }).limit(limit);
      fail(error);
      return (data ?? []) as OnlineProfile[];
    },
    async findMatch(setup: MatchSetupData, key, rating, window, ranked) {
      const { data, error } = await sb.rpc('find_match', { p_config: setup, p_key: key, p_rating: rating, p_window: window, p_ranked: ranked });
      fail(error);
      return (data as string | null) ?? null;
    },
    async leaveQueue() {
      const { data } = await sb.auth.getSession();
      if (data.session) await sb.from('mm_queue').delete().eq('user_id', data.session.user.id);
    },
    async createInvite(setup) {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) throw new Error('Faça login');
      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { data, error } = await sb.from('online_matches').insert({ code, status: 'waiting', config: setup, player_a: s.session.user.id }).select('id').single();
        if (!error) return { id: (data as { id: string }).id, code };
        if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
      }
      throw new Error('Não foi possível gerar o código');
    },
    async joinInvite(code) {
      const { data, error } = await sb.rpc('join_invite', { p_code: code });
      fail(error);
      return data as string;
    },
    async getMatch(id) {
      const { data, error } = await sb.from('online_matches').select('*').eq('id', id).single();
      fail(error);
      return data as OnlineMatchRow;
    },
    subscribeMatch(id, cb) {
      const ch = sb
        .channel('match-' + id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_matches', filter: `id=eq.${id}` }, (payload) => cb(payload.new as OnlineMatchRow))
        .subscribe();
      // rede ruim/realtime perdido: consulta periódica como garantia
      const poll = setInterval(async () => {
        const { data } = await sb.from('online_matches').select('*').eq('id', id).maybeSingle();
        if (data) cb(data as OnlineMatchRow);
      }, 5000);
      return () => {
        clearInterval(poll);
        void sb.removeChannel(ch);
      };
    },
    async updateMatch(id, version, patch) {
      const { data, error } = await sb
        .from('online_matches')
        .update({ ...patch, version: version + 1 })
        .eq('id', id)
        .eq('version', version)
        .select('id');
      fail(error);
      return (data ?? []).length === 1;
    },
    async myOpenMatches() {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return [];
      const me = s.session.user.id;
      const { data, error } = await sb
        .from('online_matches')
        .select('*')
        .in('status', ['waiting', 'active'])
        .or(`player_a.eq.${me},player_b.eq.${me}`)
        .order('updated_at', { ascending: false })
        .limit(10);
      fail(error);
      return (data ?? []) as OnlineMatchRow[];
    },
  };
}
