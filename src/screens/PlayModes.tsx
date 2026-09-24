import { useEffect, useRef, useState } from 'react';
import { BOTS, BOT_TIERS, type BotTier } from '../data/bots';
import { CAT, CATEGORY_IDS } from '../data/categories';
import { LEAGUES } from '../data/progression';
import { leagueFor, levelFromXp, nextLeague } from '../engine/progression';
import { matchmaking, type SearchStatus } from '../services/matchmaking';
import { useStore } from '../state/store';
import { Avatar, Bar, Btn, Card, Header, Seg } from '../ui/common';

export function PlayScreen() {
  const store = useStore();
  const me = store.player!;
  const [tier, setTier] = useState<BotTier>(() => {
    const lv = levelFromXp(me.xp).level;
    return lv < 8 ? 'interno' : lv < 17 ? 'r1' : lv < 25 ? 'r2' : lv < 33 ? 'r3' : 'especialista';
  });
  const [long, setLong] = useState(false);
  const others = store.players.filter((p) => p.id !== me.id);
  const [newName, setNewName] = useState('');

  const bots = BOTS.filter((b) => b.tier === tier);
  const playBot = (botId?: string) => {
    const id = botId ?? bots[Math.floor(Math.random() * bots.length)].id;
    store.nav({ name: 'match', config: { mode: 'pvp-bot', botId: id, long } });
  };

  return (
    <div className="pb-10">
      <Header title="Jogar" subtitle="Escolha seu adversário" />
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Seg
          value={long ? 'long' : 'quick'}
          onChange={(v) => setLong(v === 'long')}
          options={[
            { v: 'quick', label: '⚡ Rápida (3 coroas)' },
            { v: 'long', label: '🏰 Longa (5 coroas)' },
          ]}
        />
        <Btn variant="gold" onClick={() => store.nav({ name: 'ranked' })}>
          🏆 Ranqueado
        </Btn>
      </div>

      <Card className="p-4">
        <div className="font-display text-lg font-bold">🤖 Duelo contra BOT</div>
        <p className="text-sm text-white/60 mb-3">Bots respondem com tempo e taxa de acerto compatíveis com o nível — e têm áreas fortes e fracas.</p>
        <Seg value={tier} onChange={setTier} options={(Object.keys(BOT_TIERS) as BotTier[]).map((t) => ({ v: t, label: BOT_TIERS[t].label }))} />
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          {bots.map((b) => {
            const strong = CATEGORY_IDS.filter((c) => (b.skill[c] ?? 0) > 0);
            const weak = CATEGORY_IDS.filter((c) => (b.skill[c] ?? 0) < 0);
            return (
              <button key={b.id} onClick={() => playBot(b.id)} className="flex items-center gap-3 rounded-2xl bg-black/25 border border-white/10 p-3 text-left hover:border-violet-400/60 hover:-translate-y-0.5 transition">
                <div className="text-4xl">{b.avatar}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold truncate">{b.name}</div>
                  <div className="text-[11px] text-white/50">
                    Nível {BOT_TIERS[b.tier].level} · rating {BOT_TIERS[b.tier].rating} · ~{Math.round(BOT_TIERS[b.tier].baseAccuracy * 100)}% acerto
                  </div>
                  <div className="text-[11px] mt-0.5">
                    {strong.map((c) => (
                      <span key={c} style={{ color: CAT[c].color }}>
                        ▲{CAT[c].name}{' '}
                      </span>
                    ))}
                    {weak.map((c) => (
                      <span key={c} className="text-white/40">
                        ▼{CAT[c].name}{' '}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-2xl">›</span>
              </button>
            );
          })}
        </div>
        <Btn big className="w-full mt-3" onClick={() => playBot()}>
          🎲 Adversário aleatório ({BOT_TIERS[tier].label})
        </Btn>
      </Card>

      <Card className="p-4 mt-4">
        <div className="font-display text-lg font-bold">👥 PvP local (mesmo aparelho)</div>
        <p className="text-sm text-white/60 mb-3">Dois perfis, um aparelho: passem o celular a cada turno. Cada um recebe XP e estatísticas no próprio perfil.</p>
        {others.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {others.map((o) => (
              <button
                key={o.id}
                onClick={() => store.nav({ name: 'match', config: { mode: 'pvp-local', opponentPlayerId: o.id, long } })}
                className="flex items-center gap-3 rounded-2xl bg-black/25 border border-white/10 p-3 hover:border-violet-400/60 transition text-left"
              >
                <Avatar player={o} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate">{o.name}</div>
                  <div className="text-[11px] text-white/50">Nível {levelFromXp(o.xp).level}</div>
                </div>
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
              store.nav({ name: 'match', config: { mode: 'pvp-local', opponentPlayerId: p.id, long } });
            }}
          >
            Criar e jogar
          </Btn>
        </div>
        <p className="text-[11px] text-white/40 mt-2">PvP online real: a arquitetura já separa o motor da partida; veja o README para a migração.</p>
      </Card>
    </div>
  );
}

export function RankedScreen() {
  const store = useStore();
  const me = store.player!;
  const league = leagueFor(me.rating);
  const next = nextLeague(me.rating);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);
  const ranked = store.matches.filter((m) => m.mode === 'ranked').slice(-8).reverse();

  const search = () => {
    const h = matchmaking.search({ id: me.id, rating: me.rating }, setStatus);
    cancel.current = h.cancel;
  };

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
          <div className="text-sm text-white/60 mt-2">
            {me.rankedWins}V · {me.rankedLosses}D
          </div>
        </div>
      </Card>

      <div className="mt-4">
        {!status && (
          <Btn big variant="gold" className="w-full" onClick={search}>
            🔎 PROCURAR PARTIDA
          </Btn>
        )}
        {status?.phase === 'searching' && (
          <Card className="p-5 text-center">
            <div className="mx-auto w-20 h-20 rounded-full border-4 border-violet-400/30 border-t-violet-400 animate-spin" />
            <div className="font-display text-lg mt-3">Procurando adversário...</div>
            <div className="text-sm text-white/60">
              Faixa de rating: {me.rating - status.window} – {me.rating + status.window}
            </div>
            <Btn variant="ghost" className="mt-3" onClick={() => (cancel.current?.(), setStatus(null))}>
              Cancelar
            </Btn>
          </Card>
        )}
        {status?.phase === 'timeout' && (
          <Card className="p-5 text-center animate-pop">
            <div className="text-4xl">🌙</div>
            <div className="font-display text-lg mt-1">Nenhum jogador disponível agora</div>
            <p className="text-sm text-white/60">Sem espera: jogue contra um BOT de rating próximo. A partida vale rating normalmente.</p>
            <div className="flex items-center justify-center gap-3 my-3">
              <div className="text-4xl">{status.bot.avatar}</div>
              <div className="text-left">
                <div className="font-display font-semibold">{status.bot.name}</div>
                <div className="text-xs text-white/50">Rating {BOT_TIERS[status.bot.tier].rating}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" className="flex-1" onClick={() => setStatus(null)}>
                Voltar
              </Btn>
              <Btn variant="gold" className="flex-1" onClick={() => store.nav({ name: 'match', config: { mode: 'ranked', botId: status.bot.id } })}>
                Jogar contra BOT
              </Btn>
            </div>
          </Card>
        )}
      </div>

      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-2">Ligas</div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center">
          {LEAGUES.map((l) => (
            <div key={l.id} className={`rounded-xl p-2 ${l.id === league.id ? 'bg-white/10 ring-2' : 'bg-black/20'}`} style={{ ['--tw-ring-color' as string]: l.color }}>
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
