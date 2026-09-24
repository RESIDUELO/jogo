// Teste do online contra o Supabase real (roda no GitHub Actions).
// Simula dois visitantes: sala com código, tempo real, sala de espera com convites e ranking.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('public/online-config.json', 'utf8'));
const mk = () => createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let ok = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) ok++;
  else fail++;
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};
const step = async (name, fn) => {
  try {
    return await fn();
  } catch (e) {
    check(name, false, e.message ?? String(e));
    return undefined;
  }
};

const A = mk();
const B = mk();

// 1. login como visitante
const la = await step('A entra como visitante', async () => {
  const { data, error } = await A.auth.signInAnonymously({ options: { data: { name: 'Teste A' } } });
  if (error) throw error;
  check('A entra como visitante', !!data.user?.is_anonymous);
  return data.user;
});
const lb = await step('B entra como visitante', async () => {
  const { data, error } = await B.auth.signInAnonymously({ options: { data: { name: 'Teste B' } } });
  if (error) throw error;
  check('B entra como visitante', !!data.user?.is_anonymous);
  return data.user;
});
if (!la || !lb) {
  console.log(`\nRESULTADO: ${ok} ok, ${fail} falhas (login de visitante não funcionou)`);
  process.exit(1);
}

// 2. perfil criado pelo gatilho
await step('perfil do visitante criado (is_guest)', async () => {
  const { data, error } = await A.from('profiles').select('name,is_guest').eq('id', la.id).single();
  if (error) throw error;
  check('perfil do visitante criado (is_guest)', data.is_guest === true && data.name === 'Teste A', JSON.stringify(data));
});

// 3. sala privada com código
const code = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase();
const mid = await step('A cria sala', async () => {
  const { data, error } = await A.from('online_matches').insert({ code, status: 'waiting', config: { topics: [], timeSec: 30, format: 'flash' }, player_a: la.id }).select('id').single();
  if (error) throw error;
  check('A cria sala', !!data.id, code);
  return data.id;
});
if (mid) {
  await step('B entra pelo código', async () => {
    const { data, error } = await B.rpc('join_invite', { p_code: code.toLowerCase() });
    if (error) throw error;
    check('B entra pelo código', data === mid);
  });

  // 4. tempo real: B escuta, A grava
  await step('tempo real (B recebe a jogada de A)', async () => {
    const { data: sess } = await B.auth.getSession();
    await B.realtime.setAuth(sess.session?.access_token);
    const statuses = [];
    const got = new Promise((resolve) => {
      const ch = B.channel('t-' + mid)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_matches', filter: `id=eq.${mid}` }, (p) => {
          if (p.new?.state?.teste) resolve(true);
        })
        .subscribe(async (status, err) => {
          statuses.push(status + (err ? ':' + err.message : ''));
          if (status === 'SUBSCRIBED') {
            await new Promise((r) => setTimeout(r, 1500));
            const { data, error } = await A.from('online_matches').update({ state: { teste: 1 }, version: 1 }).eq('id', mid).eq('version', 0).select('id');
            statuses.push('update:' + (error ? error.message : (data ?? []).length + ' linha'));
          }
        });
      setTimeout(() => {
        void B.removeChannel(ch);
        resolve(false);
      }, 15000);
    });
    const r = await got;
    const { data: pub } = await B.from('online_matches').select('version,state').eq('id', mid).single();
    check('tempo real (B recebe a jogada de A)', r === true, `status: ${statuses.join(' → ')} | linha agora: ${JSON.stringify(pub)}`);
  });

  await step('controle de versão bloqueia gravação antiga', async () => {
    const { data } = await B.from('online_matches').update({ state: { x: 2 }, version: 1 }).eq('id', mid).eq('version', 0).select('id');
    check('controle de versão bloqueia gravação antiga', (data ?? []).length === 0);
  });
  await A.from('online_matches').update({ status: 'abandoned', version: 2 }).eq('id', mid).eq('version', 1);
}

// 5. sala de espera + convite (recusar e aceitar)
const setup = { topics: [], timeSec: 30, format: 'flash' };
const lobbyMe = (name) => ({ p_name: name, p_avatar: '🩺', p_level: 1, p_rating: 1000, p_ranked: false, p_guest: true });
await step('os dois entram na sala de espera', async () => {
  const r1 = await A.rpc('lobby_enter', lobbyMe('Teste A'));
  if (r1.error) throw r1.error;
  const r2 = await B.rpc('lobby_enter', lobbyMe('Teste B'));
  if (r2.error) throw r2.error;
  check('os dois entram na sala de espera', true);
});
await step('A vê B disponível', async () => {
  const { data, error } = await A.rpc('lobby_list', { p_ranked: false });
  if (error) throw error;
  check('A vê B disponível', data.some((l) => l.user_id === lb.id) && !data.some((l) => l.user_id === la.id), `${data.length} pessoa(s) na lista`);
});
await step('B recusa o convite de A', async () => {
  const s1 = await A.rpc('send_challenge', { p_to: lb.id, p_setup: setup, p_ranked: false });
  if (s1.error) throw s1.error;
  const inc = await B.rpc('my_challenges');
  if (inc.error) throw inc.error;
  const got = inc.data.find((c) => c.id === s1.data);
  const r = await B.rpc('answer_challenge', { p_id: s1.data, p_accept: false });
  if (r.error) throw r.error;
  const { data: c } = await A.from('challenges').select('status').eq('id', s1.data).single();
  check('B recusa o convite de A', !!got && got.from_name === 'Teste A' && c.status === 'declined', `status: ${c?.status}`);
});
await step('B aceita e os dois entram na partida', async () => {
  const s1 = await A.rpc('send_challenge', { p_to: lb.id, p_setup: setup, p_ranked: false });
  if (s1.error) throw s1.error;
  const r = await B.rpc('answer_challenge', { p_id: s1.data, p_accept: true });
  if (r.error) throw r.error;
  const { data: c } = await A.from('challenges').select('status,match_id').eq('id', s1.data).single();
  const { data: m } = await A.from('online_matches').select('status,player_a,player_b').eq('id', r.data).single();
  const { data: left } = await A.rpc('lobby_list', { p_ranked: false });
  check('B aceita e os dois entram na partida', c.status === 'accepted' && c.match_id === r.data && m.status === 'active' && m.player_a === la.id && m.player_b === lb.id && !left.some((l) => l.user_id === lb.id), JSON.stringify(m));
  await A.from('online_matches').update({ status: 'abandoned', version: 1 }).eq('id', r.data).eq('version', 0);
});
await step('convite cancelado não pode ser aceito', async () => {
  await A.rpc('lobby_enter', lobbyMe('Teste A'));
  await B.rpc('lobby_enter', lobbyMe('Teste B'));
  const s1 = await A.rpc('send_challenge', { p_to: lb.id, p_setup: setup, p_ranked: false });
  if (s1.error) throw s1.error;
  await A.rpc('cancel_challenge', { p_id: s1.data });
  const r = await B.rpc('answer_challenge', { p_id: s1.data, p_accept: true });
  check('convite cancelado não pode ser aceito', !!r.error, r.error?.message);
  await A.from('lobby').delete().eq('user_id', la.id);
  await B.from('lobby').delete().eq('user_id', lb.id);
});

// 6. ranking (sem visitantes)
await step('ranking de jogadores (sem visitantes)', async () => {
  const { data, error } = await mk().from('profiles').select('name,xp,is_guest').eq('is_guest', false).order('xp', { ascending: false }).limit(10);
  if (error) throw error;
  check('ranking de jogadores (sem visitantes)', data.every((p) => !p.is_guest), `${data.length} jogador(es) com conta`);
});

// 7. salvar progresso no perfil
await step('visitante salva progresso no perfil', async () => {
  const { error } = await A.from('profiles').upsert({ id: la.id, name: 'Teste A', xp: 10, updated_at: new Date().toISOString() });
  if (error) throw error;
  check('visitante salva progresso no perfil', true);
});

console.log(`\nRESULTADO: ${ok} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
