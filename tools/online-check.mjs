// Teste do online contra o Supabase real (roda no GitHub Actions).
// Simula dois visitantes: sala com código, matchmaking, tempo real e ranking.
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
  const { data, error } = await A.from('online_matches').insert({ code, status: 'waiting', config: { exams: [], cats: [] }, player_a: la.id }).select('id').single();
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
    const got = new Promise((resolve) => {
      const ch = B.channel('t-' + mid)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_matches', filter: `id=eq.${mid}` }, (p) => {
          if (p.new?.state?.teste) resolve(true);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            const { data, error } = await A.from('online_matches').update({ state: { teste: 1 }, version: 1 }).eq('id', mid).eq('version', 0).select('id');
            if (error || data.length !== 1) resolve('update falhou: ' + (error?.message ?? 'versão'));
          }
        });
      setTimeout(() => {
        void B.removeChannel(ch);
        resolve(false);
      }, 15000);
    });
    const r = await got;
    check('tempo real (B recebe a jogada de A)', r === true, r === true ? '' : String(r));
  });

  await step('controle de versão bloqueia gravação antiga', async () => {
    const { data } = await B.from('online_matches').update({ state: { x: 2 }, version: 1 }).eq('id', mid).eq('version', 0).select('id');
    check('controle de versão bloqueia gravação antiga', (data ?? []).length === 0);
  });
  await A.from('online_matches').update({ status: 'abandoned', version: 2 }).eq('id', mid).eq('version', 1);
}

// 5. matchmaking
await step('matchmaking pareia os dois', async () => {
  const key = 'teste-' + Date.now();
  const r1 = await A.rpc('find_match', { p_config: { exams: [], cats: [] }, p_key: key, p_rating: 1000, p_window: 50, p_ranked: false });
  if (r1.error) throw r1.error;
  const r2 = await B.rpc('find_match', { p_config: { exams: [], cats: [] }, p_key: key, p_rating: 1000, p_window: 50, p_ranked: false });
  if (r2.error) throw r2.error;
  const r3 = await A.rpc('find_match', { p_config: { exams: [], cats: [] }, p_key: key, p_rating: 1000, p_window: 50, p_ranked: false });
  if (r3.error) throw r3.error;
  check('matchmaking pareia os dois', r1.data === null && !!r2.data && r2.data === r3.data);
  if (r2.data) await B.from('online_matches').update({ status: 'abandoned', version: 1 }).eq('id', r2.data).eq('version', 0);
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
