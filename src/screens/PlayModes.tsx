import { useEffect, useMemo, useRef, useState } from 'react';
import { BOTS, BOT_TIERS, type BotTier } from '../data/bots';
import { LEAGUES } from '../data/progression';
import { configFor } from '../engine/match';
import { DEFAULT_SETUP, inTopics, setupAreas, TIME_OPTIONS } from '../engine/cards';
import { leagueFor, levelFromXp, nextLeague } from '../engine/progression';
import { closestBot } from '../services/matchmaking';
import { setupKey } from '../services/online';
import { useOnline } from '../state/online';
import { useStore } from '../state/store';
import type { MatchSetupData } from '../types';
import { Avatar, Bar, Btn, Card, Header, Seg } from '../ui/common';
import { TopicPicker } from '../ui/TopicPicker';

const SETUP_KEY = 'rdl.setup';
function loadSetup(): MatchSetupData {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY) || '{}');
    return {
      topics: Array.isArray(s.topics) ? s.topics.filter((t: unknown) => typeof t === 'string') : [],
      timeSec: TIME_OPTIONS.includes(s.timeSec) ? s.timeSec : DEFAULT_SETUP.timeSec,
      format: 'flash',
      long: !!s.long,
    };
  } catch {
    return { ...DEFAULT_SETUP };
  }
}

/** Temas e tempo da partida (escolhidos por quem cria a partida/sala). */
export function useSetup() {
  const [setup, setSetup] = useState<MatchSetupData>(loadSetup);
  useEffect(() => {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
    } catch {
      /* sem armazenamento */
    }
  }, [setup]);
  return [setup, setSetup] as const;
}

export const fmtTime = (s: number) => (s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)}m${s % 60}` : `${s / 60} min`);

export function TimePicker({ value, onChange }: { value: number; onChange: (s: number) => void }) {
  return <Seg value={value} onChange={onChange} options={TIME_OPTIONS.map((t) => ({ v: t, label: fmtTime(t) }))} />;
}

export function SetupPicker({ setup, onChange }: { setup: MatchSetupData; onChange: (s: MatchSetupData) => void }) {
  const store = useStore();
  const count = useMemo(() => store.cards.filter((c) => inTopics(c, setup.topics)).length, [store.cards, setup.topics]);
  const cfg = configFor(setup, setupAreas(setup, store.cards));
  return (
    <Card className="p-4 space-y-5">
      <div>
        <div className="font-display font-semibold mb-1">🎯 Temas da partida</div>
        <p className="text-xs text-white/50 mb-2">Marque as grandes áreas e toque em › para escolher os subtemas. A roleta só terá as áreas marcadas.</p>
        <TopicPicker cards={store.cards} topics={setup.topics} onChange={(topics) => onChange({ ...setup, topics })} />
      </div>
      <div>
        <div className="font-display font-semibold mb-2">⏱️ Tempo por rodada</div>
        <TimePicker value={setup.timeSec} onChange={(timeSec) => onChange({ ...setup, timeSec })} />
      </div>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Seg
          value={setup.long ? 'long' : 'quick'}
          onChange={(v) => onChange({ ...setup, long: v === 'long' })}
          options={[
            { v: 'quick', label: '⚡ Rápida' },
            { v: 'long', label: '🏰 Longa' },
          ]}
        />
        <div className="text-xs text-white/60 text-right">
          {count} flashcards · vence com {cfg.targetCrowns} coroa{cfg.targetCrowns > 1 ? 's' : ''} · até {cfg.maxRounds} rodadas
        </div>
      </div>
      {count < 10 && <p className="text-xs text-amber-300">Poucos flashcards com essa combinação — alguns podem se repetir.</p>}
    </Card>
  );
}

export function PlayScreen() {
  const store = useStore();
  const online = useOnline();
  const me = store.player!;
  const [setup, setSetup] = useSetup();
  const [tier, setTier] = useState<BotTier>(() => {
    const lv = levelFromXp(me.xp).level;
    return lv < 8 ? 'interno' : lv < 17 ? 'r1' : lv < 25 ? 'r2' : lv < 33 ? 'r3' : 'especialista';
  });
  const others = store.players.filter((p) => p.id !== me.id);
  const [newName, setNewName] = useState('');
  const bots = BOTS.filter((b) => b.tier === tier);
  const playBot = (botId?: string) => store.nav({ name: 'match', config: { mode: 'pvp-bot', botId: botId ?? bots[Math.floor(Math.random() * bots.length)].id, setup } });

  return (
    <div className="pb-10">
      <Header title="Jogar" subtitle="1) escolha o que disputar · 2) escolha o adversário" />
      <SetupPicker setup={setup} onChange={setSetup} />
      <OnlineCard setup={setup} />

      <Card className="p-4 mt-4">
        <div className="font-display text-lg font-bold">🤖 Contra BOT</div>
        <p className="text-sm text-white/60 mb-3">Bots com tempo e acerto compatíveis com o nível, com áreas fortes e fracas.</p>
        <Seg value={tier} onChange={setTier} options={(Object.keys(BOT_TIERS) as BotTier[]).map((t) => ({ v: t, label: BOT_TIERS[t].label }))} />
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          {bots.map((b) => (
            <button key={b.id} onClick={() => playBot(b.id)} className="flex items-center gap-3 rounded-2xl bg-black/25 border border-white/10 p-3 text-left hover:border-violet-400/60 transition">
              <div className="text-4xl">{b.avatar}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold truncate">{b.name}</div>
                <div className="text-[11px] text-white/50">
                  Nível {BOT_TIERS[b.tier].level} · ~{Math.round(BOT_TIERS[b.tier].baseAccuracy * 100)}% acerto
                </div>
              </div>
              <span className="text-2xl">›</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 mt-4">
        <div className="font-display text-lg font-bold">👥 Local (mesmo aparelho)</div>
        <p className="text-sm text-white/60 mb-3">Passem o celular a cada turno. Cada perfil recebe XP e estatísticas.</p>
        {others.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {others.map((o) => (
              <button key={o.id} onClick={() => store.nav({ name: 'match', config: { mode: 'pvp-local', opponentPlayerId: o.id, setup } })} className="flex items-center gap-3 rounded-2xl bg-black/25 border border-white/10 p-3 text-left">
                <Avatar player={o} size={40} />
                <span className="flex-1 font-display font-semibold truncate">{o.name}</span>
                <span>⚔️</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do 2º jogador" className="input flex-1" maxLength={20} />
          <Btn
            disabled={!newName.trim()}
            onClick={() => {
              const p = store.createPlayer(newName.trim(), 'av-doc-f');
              setNewName('');
              store.nav({ name: 'match', config: { mode: 'pvp-local', opponentPlayerId: p.id, setup } });
            }}
          >
            Criar e jogar
          </Btn>
        </div>
      </Card>
      {!online.backend && !online.loading && <p className="text-[11px] text-white/40 mt-3 text-center">Online ainda não configurado neste site.</p>}
    </div>
  );
}

function OnlineCard({ setup }: { setup: MatchSetupData }) {
  const store = useStore();
  const online = useOnline();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (!online.backend || !online.account) return;
    online.backend.myOpenMatches().then((ms) => setOpen(ms.filter((m) => m.status === 'active').map((m) => ({ id: m.id, label: `Partida em andamento (${new Date(m.updated_at).toLocaleTimeString('pt-BR', { timeStyle: 'short' })})` }))));
  }, [online.backend, online.account]);
  if (!online.backend) return null;
  return (
    <Card className="p-4 mt-4 border-sky-400/30">
      <div className="font-display text-lg font-bold">🌐 Online</div>
      {!online.account ? (
        <>
          <p className="text-sm text-white/60 mb-3">Jogue contra outras pessoas. Sem conta, você entra como visitante na hora.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Btn
              big
              variant="gold"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg('');
                try {
                  await online.signInAsGuest(store.player?.name ?? 'Visitante');
                } catch (e) {
                  setMsg(String((e as Error).message));
                }
                setBusy(false);
              }}
            >
              👤 Jogar como visitante
            </Btn>
            <Btn big variant="secondary" onClick={() => store.nav({ name: 'account' })}>
              Entrar / criar conta
            </Btn>
          </div>
          {msg && <p className="text-sm text-rose-300 mt-2">{msg}</p>}
          <p className="text-[11px] text-white/40 mt-2">Visitantes jogam normalmente, mas não aparecem no ranking. Dá para criar a conta depois sem perder o progresso.</p>
        </>
      ) : (
        <div className="space-y-3 mt-2">
          {online.account.isGuest && (
            <p className="text-xs text-white/50">
              👤 Jogando como visitante ·{' '}
              <button className="underline text-sky-300" onClick={() => store.nav({ name: 'account' })}>
                criar conta para entrar no ranking
              </button>
            </p>
          )}
          {open.map((m) => (
            <Btn key={m.id} variant="gold" className="w-full" onClick={() => store.nav({ name: 'onlineMatch', matchId: m.id })}>
              ↩️ Voltar para {m.label}
            </Btn>
          ))}
          <Btn big className="w-full" onClick={() => store.nav({ name: 'onlineSearch', setup, ranked: false })}>
            🔎 Buscar adversário
          </Btn>
          <div className="grid sm:grid-cols-2 gap-2">
            <Btn
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg('');
                try {
                  const r = await online.backend!.createInvite(setup);
                  store.nav({ name: 'onlineRoom', matchId: r.id, code: r.code });
                } catch (e) {
                  setMsg(String((e as Error).message));
                }
                setBusy(false);
              }}
            >
              🔑 Criar sala (desafiar amigo)
            </Btn>
            <div className="flex gap-2">
              <input className="input uppercase tracking-widest" placeholder="CÓDIGO" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <Btn
                disabled={code.length < 4 || busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg('');
                  try {
                    const id = await online.backend!.joinInvite(code);
                    store.nav({ name: 'onlineMatch', matchId: id });
                  } catch (e) {
                    setMsg(String((e as Error).message));
                  }
                  setBusy(false);
                }}
              >
                Entrar
              </Btn>
            </div>
          </div>
          {msg && <p className="text-sm text-rose-300">{msg}</p>}
          <p className="text-[11px] text-white/40">Na sala com código, valem os temas e o tempo escolhidos por quem criou. Itens ficam desativados no online.</p>
        </div>
      )}
    </Card>
  );
}

/** Matchmaking: rating parecido primeiro, janela crescente e, sem ninguém, BOT. */
export function OnlineSearchScreen({ setup, ranked }: { setup: MatchSetupData; ranked: boolean }) {
  const store = useStore();
  const online = useOnline();
  const me = store.player!;
  const [window_, setWindow] = useState(50);
  const [elapsed, setElapsed] = useState(0);
  const [timeout, setTimedOut] = useState(false);
  const [err, setErr] = useState('');
  const stop = useRef(false);

  useEffect(() => {
    if (!online.backend || !online.account) return;
    stop.current = false;
    const start = Date.now();
    const key = setupKey(setup, ranked);
    let w = 50;
    const loop = async () => {
      while (!stop.current) {
        try {
          const mid = await online.backend!.findMatch(setup, key, me.rating, w, ranked);
          if (mid) {
            stop.current = true;
            store.nav({ name: 'onlineMatch', matchId: mid });
            return;
          }
        } catch (e) {
          setErr(String((e as Error).message));
        }
        const el = Date.now() - start;
        setElapsed(el);
        if (el > 30_000) {
          setTimedOut(true);
          return; // continua na fila até o usuário decidir
        }
        w = Math.min(600, w + 50);
        setWindow(w);
        await new Promise((r) => setTimeout(r, 2000));
      }
    };
    void loop();
    return () => {
      stop.current = true;
      void online.backend?.leaveQueue();
    };
  }, [online.backend, online.account]); // eslint-disable-line react-hooks/exhaustive-deps

  const bot = useMemo(() => closestBot(me.rating), [me.rating]);
  const keepWaiting = () => {
    setTimedOut(false);
    store.nav({ name: 'onlineSearch', setup, ranked });
  };

  return (
    <div className="pb-10">
      <Header title={ranked ? 'Ranqueada online' : 'Buscar adversário'} />
      <Card className="p-6 text-center">
        {!timeout ? (
          <>
            <div className="mx-auto w-20 h-20 rounded-full border-4 border-sky-400/30 border-t-sky-400 animate-spin" />
            <div className="font-display text-lg mt-3">Procurando jogador...</div>
            <div className="text-sm text-white/60">
              Rating {me.rating} ± {window_} · {Math.round(elapsed / 1000)} s
            </div>
          </>
        ) : (
          <>
            <div className="text-4xl">🌙</div>
            <div className="font-display text-lg mt-1">Ninguém disponível agora</div>
            <p className="text-sm text-white/60">Você não precisa esperar: jogue contra um BOT com a mesma configuração, ou continue na fila.</p>
            <div className="flex items-center justify-center gap-3 my-3">
              <div className="text-4xl">{bot.avatar}</div>
              <div className="text-left">
                <div className="font-display font-semibold">{bot.name}</div>
                <div className="text-xs text-white/50">Rating {BOT_TIERS[bot.tier].rating}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <Btn variant="secondary" onClick={keepWaiting}>
                Continuar esperando
              </Btn>
              <Btn variant="gold" onClick={() => store.nav({ name: 'match', config: { mode: ranked ? 'ranked' : 'pvp-bot', botId: bot.id, setup } })}>
                Jogar contra BOT
              </Btn>
            </div>
          </>
        )}
        {err && <p className="text-sm text-rose-300 mt-3">{err}</p>}
        <Btn variant="ghost" className="mt-4" onClick={() => store.back()}>
          Cancelar
        </Btn>
      </Card>
    </div>
  );
}

export function OnlineRoomScreen({ matchId, code }: { matchId: string; code: string }) {
  const store = useStore();
  const online = useOnline();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!online.backend) return;
    return online.backend.subscribeMatch(matchId, (r) => {
      if (r.status === 'active') store.nav({ name: 'onlineMatch', matchId });
    });
  }, [online.backend, matchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const link = `${location.origin}${location.pathname}?sala=${code}`;
  return (
    <div className="pb-10">
      <Header title="Sala privada" />
      <Card className="p-6 text-center">
        <p className="text-white/70">Passe este código para seu amigo (Jogar → Online → Entrar):</p>
        <div className="font-display text-5xl font-bold tracking-[0.3em] my-4 text-amber-300">{code}</div>
        <Btn
          variant="secondary"
          onClick={async () => {
            const text = `Bora um duelo no Residuelo? Código da sala: ${code}\n${link}`;
            try {
              if (navigator.share) await navigator.share({ text });
              else {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              }
            } catch {
              /* cancelado */
            }
          }}
        >
          📤 {copied ? 'Copiado!' : 'Compartilhar convite'}
        </Btn>
        <div className="mt-6 text-white/60 animate-pulse">Aguardando o adversário entrar...</div>
      </Card>
    </div>
  );
}

export function RankedScreen() {
  const store = useStore();
  const online = useOnline();
  const me = store.player!;
  const league = leagueFor(me.rating);
  const next = nextLeague(me.rating);
  const [setup, setSetup] = useSetup();
  const ranked = store.matches.filter((m) => m.mode === 'ranked').slice(-8).reverse();
  const canOnline = !!online.backend && !!online.account;

  return (
    <div className="pb-10">
      <Header title="Ranqueado" subtitle="Vitória sobe, derrota desce. Rating estilo Elo." />
      <Card className="p-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 0%, ${league.color}, transparent 70%)` }} />
        <div className="relative">
          <div className="text-6xl">{league.icon}</div>
          <div className="font-display text-3xl font-bold mt-1" style={{ color: league.color }}>
            {league.name}
          </div>
          <div className="text-white/70">
            Rating <b className="text-white text-xl">{me.rating}</b> · pico {me.peakRating}
          </div>
          {next && (
            <div className="max-w-xs mx-auto mt-3">
              <Bar pct={(me.rating - league.min) / (next.min - league.min)} color={league.color} />
              <div className="text-xs text-white/50 mt-1">
                {next.min - me.rating} pontos para {next.icon} {next.name}
              </div>
            </div>
          )}
        </div>
      </Card>
      <div className="mt-4">
        <SetupPicker setup={setup} onChange={setSetup} />
      </div>
      <Btn
        big
        variant="gold"
        className="w-full mt-4"
        onClick={() => (canOnline ? store.nav({ name: 'onlineSearch', setup, ranked: true }) : store.nav({ name: 'match', config: { mode: 'ranked', botId: closestBot(me.rating).id, setup } }))}
      >
        🔎 {canOnline ? 'PROCURAR PARTIDA' : 'JOGAR RANQUEADA (vs BOT)'}
      </Btn>
      {!canOnline && online.backend && (
        <p className="text-xs text-white/50 text-center mt-2">
          <button className="underline" onClick={() => store.nav({ name: 'account' })}>
            Entre na sua conta
          </button>{' '}
          para enfrentar jogadores reais.
        </p>
      )}
      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-2">Ligas</div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center">
          {LEAGUES.map((l) => (
            <div key={l.id} className={`rounded-xl p-2 ${l.id === league.id ? 'bg-white/10' : 'bg-black/20'}`}>
              <div className="text-2xl">{l.icon}</div>
              <div className="text-[11px] font-semibold" style={{ color: l.color }}>
                {l.name}
              </div>
              <div className="text-[10px] text-white/40">{l.min}+</div>
            </div>
          ))}
        </div>
      </Card>
      {ranked.length > 0 && (
        <Card className="p-4 mt-4">
          <div className="font-display font-semibold mb-2">Últimas ranqueadas</div>
          {ranked.map((m) => (
            <div key={m.id} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
              <span>
                {m.result === 'win' ? '🟢' : m.result === 'draw' ? '🟡' : '🔴'} vs {m.opponentName}
              </span>
              <span className={m.ratingDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {m.ratingDelta >= 0 ? '+' : ''}
                {m.ratingDelta}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export function AccountScreen() {
  const store = useStore();
  const online = useOnline();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(store.player?.name ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!online.backend)
    return (
      <div>
        <Header title="Conta" />
        <Card className="p-5 text-white/70">O modo online ainda não foi configurado neste site. O jogo funciona normalmente offline.</Card>
      </div>
    );

  if (online.account?.isGuest)
    return (
      <div>
        <Header title="Visitante" />
        <Card className="p-5 space-y-3 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <Avatar player={store.player!} size={56} />
            <div>
              <div className="font-display text-lg font-bold">{store.player?.name}</div>
              <div className="text-sm text-white/60">👤 Jogando como visitante</div>
            </div>
          </div>
          <p className="text-sm text-white/60">Você já pode jogar online. Para aparecer no ranking e entrar em outro aparelho, crie uma conta: seu progresso é mantido.</p>
          <input className="input" placeholder="Nome no ranking" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          <input className="input" type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" autoComplete="new-password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Btn
            className="w-full"
            disabled={busy || !email || password.length < 6}
            onClick={async () => {
              setBusy(true);
              setMsg('');
              try {
                const r = await online.upgradeGuest(email.trim(), password, name.trim() || 'Jogador');
                if (name.trim()) store.updatePlayer((x) => ({ ...x, name: name.trim() }));
                setMsg(r.needsConfirm ? 'Quase lá! Confirme pelo link enviado ao seu e-mail.' : 'Conta criada! ✅');
              } catch (e) {
                setMsg(String((e as Error).message));
              }
              setBusy(false);
            }}
          >
            Criar conta e manter progresso
          </Btn>
          {msg && <p className="text-sm text-amber-200">{msg}</p>}
          <div className="flex gap-2 flex-wrap pt-2">
            <Btn variant="secondary" onClick={() => store.nav({ name: 'play' })}>
              Jogar online
            </Btn>
            <Btn variant="ghost" onClick={() => online.signOut()}>
              Sair do modo visitante
            </Btn>
          </div>
        </Card>
      </div>
    );

  if (online.account)
    return (
      <div>
        <Header title="Conta" />
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar player={store.player!} size={56} />
            <div>
              <div className="font-display text-lg font-bold">{online.profile?.name ?? store.player?.name}</div>
              <div className="text-sm text-white/60">{online.account.email}</div>
            </div>
          </div>
          <p className="text-sm text-white/60">Seu progresso é sincronizado com a conta e aparece no ranking de jogadores.</p>
          <div className="flex gap-2 flex-wrap">
            <Btn onClick={() => store.nav({ name: 'play' })}>Jogar online</Btn>
            <Btn variant="secondary" onClick={() => store.nav({ name: 'ranking' })}>
              Ranking
            </Btn>
            <Btn variant="danger" onClick={() => online.signOut()}>
              Sair da conta
            </Btn>
          </div>
        </Card>
      </div>
    );

  const submit = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'login') await online.signIn(email.trim(), password);
      else {
        const r = await online.signUp(email.trim(), password, name.trim() || 'Jogador');
        if (r.needsConfirm) setMsg('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.');
      }
    } catch (e) {
      setMsg(String((e as Error).message));
    }
    setBusy(false);
  };

  return (
    <div>
      <Header title={mode === 'login' ? 'Entrar' : 'Criar conta'} />
      <Card className="p-5 space-y-3 max-w-md mx-auto">
        <Seg value={mode} onChange={setMode} options={[{ v: 'login', label: 'Entrar' }, { v: 'signup', label: 'Criar conta' }]} />
        {mode === 'signup' && <input className="input" placeholder="Nome no ranking" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />}
        <input className="input" type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <Btn big className="w-full" disabled={busy || !email || password.length < 6} onClick={submit}>
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </Btn>
        {msg && <p className="text-sm text-amber-200">{msg}</p>}
        <div className="flex items-center gap-3 text-white/30 text-xs">
          <div className="h-px flex-1 bg-white/10" />
          ou
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <Btn
          big
          variant="gold"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg('');
            try {
              await online.signInAsGuest(name.trim() || store.player?.name || 'Visitante');
              store.nav({ name: 'play' });
            } catch (e) {
              setMsg(String((e as Error).message));
            }
            setBusy(false);
          }}
        >
          👤 Jogar como visitante
        </Btn>
        <p className="text-[11px] text-white/40">Visitante joga online sem cadastro, mas não aparece no ranking. Ao entrar, seu progresso deste aparelho é vinculado à conta.</p>
      </Card>
    </div>
  );
}
