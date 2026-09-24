// Ranking, Conquistas, Missões e Loja.
import { useEffect, useMemo, useState } from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import { CAT, CATEGORY_IDS } from '../data/categories';
import { MISSION_BY_ID } from '../data/missions';
import { COSMETICS, POWERUP, POWERUPS, type CosmeticKind } from '../data/shop';
import { buyCosmetic, buyPowerUp, equipCosmetic, ownsCosmetic } from '../engine/player';
import { leagueFor, levelFromXp } from '../engine/progression';
import { snapshot } from '../engine/stats';
import { fmtInt, fmtPct } from '../engine/util';
import { getRanking, onlineEntries, sortRanking, type RankingKind } from '../services/rankings';
import { useOnline } from '../state/online';
import type { RankingEntry } from '../types';
import { sfx } from '../audio/sfx';
import { useStore } from '../state/store';
import { Avatar, Bar, Btn, Card, Coins, Header, Seg } from '../ui/common';

export function RankingScreen() {
  const store = useStore();
  const online = useOnline();
  const [kind, setKind] = useState<RankingKind>('geral');
  const [source, setSource] = useState<'online' | 'local'>('online');
  const [remote, setRemote] = useState<RankingEntry[] | null>(null);
  const [err, setErr] = useState('');
  const useOnlineSource = source === 'online' && !!online.backend;
  useEffect(() => {
    if (!useOnlineSource) return;
    setErr('');
    const order = kind === 'ranqueado' ? 'rating' : kind === 'semanal' ? 'week_xp' : 'xp';
    online.backend!.ranking(order, 200).then((ps) => setRemote(onlineEntries(ps)), (e) => setErr(String(e.message ?? e)));
  }, [useOnlineSource, kind, online.backend]);
  const rows = useMemo(
    () => (useOnlineSource ? sortRanking(remote ?? [], kind).filter((r) => !CATEGORY_IDS.includes(kind as never) || r.catAccuracy[kind as 'GO'] > 0) : getRanking(kind)),
    [useOnlineSource, remote, kind, store.players], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const isCat = CATEGORY_IDS.includes(kind as never);
  const myId = useOnlineSource ? online.account?.id : store.player?.id;
  return (
    <div className="pb-10">
      <Header title="Ranking" subtitle={useOnlineSource ? 'Jogadores com conta' : 'Perfis deste aparelho + bots'} />
      {online.backend && (
        <div className="mb-3">
          <Seg value={source} onChange={setSource} options={[{ v: 'online', label: '🌐 Jogadores' }, { v: 'local', label: '📱 Este aparelho + bots' }]} />
        </div>
      )}
      {useOnlineSource && online.account?.isGuest && <p className="text-xs text-white/60 mb-2">👤 Visitantes não aparecem no ranking. <button className="underline" onClick={() => store.nav({ name: 'account' })}>Criar conta</button></p>}
      {useOnlineSource && !online.account && (
        <p className="text-xs text-white/60 mb-2">
          <button className="underline" onClick={() => store.nav({ name: 'account' })}>
            Entre na sua conta
          </button>{' '}
          para aparecer no ranking.
        </p>
      )}
      {err && <p className="text-sm text-rose-300 mb-2">{err}</p>}
      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="flex gap-2 w-max">
          {(
            [
              ['geral', '🌐 Geral'],
              ['semanal', '📅 Semanal'],
              ['ranqueado', '🏆 Rating'],
              ...CATEGORY_IDS.map((c) => [c, `${CAT[c].icon} ${CAT[c].name}`]),
            ] as [RankingKind, string][]
          ).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap border ${kind === k ? 'bg-violet-500 border-violet-400' : 'bg-ink-800 border-white/10 text-white/70'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <Card className="mt-2 overflow-hidden">
        <div className="hidden sm:grid grid-cols-[44px_1fr_60px_80px_70px_70px_60px] gap-2 px-4 py-2 text-[11px] uppercase text-white/40 border-b border-white/5">
          <span>#</span>
          <span>Jogador</span>
          <span>Nível</span>
          <span>{kind === 'semanal' ? 'XP sem.' : kind === 'ranqueado' ? 'Rating' : 'XP'}</span>
          <span>V/D</span>
          <span>{isCat ? CAT[kind as 'GO'].name : 'Acerto'}</span>
          <span>Seq.</span>
        </div>
        {useOnlineSource && remote && rows.length === 0 && <div className="p-6 text-center text-white/50 text-sm">Ninguém no ranking ainda. Seja o primeiro!</div>}
        {useOnlineSource && !remote && !err && <div className="p-6 text-center text-white/50 text-sm animate-pulse">Carregando...</div>}
        {rows.map((r, i) => {
          const me = r.id === myId;
          const medal = ['🥇', '🥈', '🥉'][i];
          return (
            <div key={r.id} className={`grid grid-cols-[36px_1fr_auto] sm:grid-cols-[44px_1fr_60px_80px_70px_70px_60px] gap-2 items-center px-4 py-2.5 border-b border-white/5 ${me ? 'bg-violet-500/15' : ''}`}>
              <span className="font-display text-lg">{medal ?? i + 1}</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">{r.avatar}</span>
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm">
                    {r.name} {me && <span className="text-violet-300">(você)</span>}
                  </div>
                  <div className="text-[11px] text-white/40 sm:hidden">
                    Nv {r.level} · {r.wins}V/{r.losses}D · {fmtPct(isCat ? r.catAccuracy[kind as 'GO'] : r.accuracy)}
                  </div>
                  <div className="text-[11px] text-white/40 hidden sm:block">
                    {r.isBot ? 'BOT' : 'jogador'} · {leagueFor(r.rating).icon} {leagueFor(r.rating).name}
                  </div>
                </div>
              </div>
              <span className="text-sm hidden sm:block">{r.level}</span>
              <span className="font-display text-amber-200 text-sm text-right sm:text-left">{kind === 'semanal' ? fmtInt(r.weekXp) : kind === 'ranqueado' ? r.rating : fmtInt(r.xp)}</span>
              <span className="text-sm hidden sm:block">
                {r.wins}/{r.losses}
              </span>
              <span className="text-sm hidden sm:block">{fmtPct(isCat ? r.catAccuracy[kind as 'GO'] : r.accuracy)}</span>
              <span className="text-sm hidden sm:block">🔥{r.streak}</span>
            </div>
          );
        })}
      </Card>

    </div>
  );
}

export function AchievementsScreen() {
  const store = useStore();
  const p = store.player!;
  const snap = useMemo(() => snapshot(p, store.answers, store.matches), [p, store.answers, store.matches]);
  const done = ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length;
  return (
    <div className="pb-10">
      <Header title="Conquistas" subtitle={`${done}/${ACHIEVEMENTS.length} desbloqueadas`} />
      <Bar pct={done / ACHIEVEMENTS.length} color="linear-gradient(90deg,#f59e0b,#ec4899)" className="mb-4" />
      <div className="grid sm:grid-cols-2 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const got = !!p.achievements[a.id];
          const pr = a.progress?.(snap);
          return (
            <Card key={a.id} className={`p-3 flex items-center gap-3 ${got ? 'border-amber-300/40 bg-amber-400/10' : ''}`}>
              <div className={`w-12 h-12 rounded-2xl grid place-items-center text-2xl ${got ? 'bg-amber-400/30' : 'bg-black/30 grayscale opacity-60'}`}>{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold">{a.name}</div>
                <div className="text-xs text-white/60">{a.desc}</div>
                {!got && pr && (
                  <div className="mt-1">
                    <Bar pct={pr[0] / pr[1]} h="h-1.5" />
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {Math.min(pr[0], pr[1])}/{pr[1]}
                    </div>
                  </div>
                )}
                {got && <div className="text-[11px] text-amber-200 mt-0.5">Desbloqueada em {new Date(p.achievements[a.id]).toLocaleDateString('pt-BR')}</div>}
              </div>
              <div className="text-right text-[11px] shrink-0">
                {a.xp > 0 && <div className="text-violet-300">+{a.xp} XP</div>}
                {a.coins > 0 && <div className="text-amber-300">+{a.coins} 🪙</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function MissionsScreen() {
  const store = useStore();
  const p = store.player!;
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const hours = Math.max(0, Math.round((midnight.getTime() - Date.now()) / 3600_000));
  return (
    <div className="pb-10">
      <Header title="Missões diárias" subtitle={`Novas missões em ~${hours} h`} />
      <div className="space-y-3">
        {p.daily.missions.map((m) => {
          const t = MISSION_BY_ID[m.id];
          if (!t) return null;
          const complete = m.progress >= t.goal;
          return (
            <Card key={m.id} className={`p-4 ${complete && !m.claimed ? 'border-emerald-400/50 animate-pulseRing' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="text-3xl">{m.claimed ? '✅' : complete ? '🎁' : '🎯'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold">{t.text}</div>
                  <Bar pct={m.progress / t.goal} color={complete ? '#22c55e' : '#8b5cf6'} className="mt-1.5" />
                  <div className="text-xs text-white/50 mt-1">
                    {m.progress}/{t.goal} · Recompensa: +{t.reward.xp} XP · +{t.reward.coins} 🪙 {t.reward.item && `· ${POWERUP[t.reward.item].icon} ${POWERUP[t.reward.item].name}`}
                  </div>
                </div>
                {complete && !m.claimed && (
                  <Btn variant="success" onClick={() => store.claimMissionReward(m.id)}>
                    Resgatar
                  </Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-white/40 mt-4 text-center">Itens e moedas nunca são vendidos por dinheiro real. Tudo se conquista jogando.</p>
    </div>
  );
}

export function ShopScreen() {
  const store = useStore();
  const p = store.player!;
  const [tab, setTab] = useState<'items' | CosmeticKind>('items');
  const level = levelFromXp(p.xp).level;
  const buyItem = (id: (typeof POWERUPS)[number]['id']) => {
    const next = buyPowerUp(p, id);
    if (next) {
      store.updatePlayer(() => next);
      sfx.coin();
    }
  };
  const buyCos = (id: string) => {
    const next = buyCosmetic(p, id);
    if (next) {
      store.updatePlayer(() => equipCosmetic(next, id));
      sfx.coin();
    }
  };
  return (
    <div className="pb-10">
      <Header title="Loja" subtitle="Moedas só se ganham jogando" right={<Coins n={p.coins} className="text-lg" />} />
      <div className="flex items-center gap-3 mb-4">
        <Avatar player={p} size={64} />
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { v: 'items', label: '🎒 Itens' },
            { v: 'avatar', label: '🙂 Avatares' },
            { v: 'frame', label: '🖼️ Molduras' },
            { v: 'effect', label: '✨ Efeitos' },
            { v: 'title', label: '🏷️ Títulos' },
          ]}
        />
      </div>
      {tab === 'items' ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {POWERUPS.map((pu) => (
            <Card key={pu.id} className="p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/25 grid place-items-center text-2xl">{pu.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold">
                  {pu.name} <span className="text-xs text-white/50">(você tem {p.inventory[pu.id]})</span>
                </div>
                <div className="text-xs text-white/60">{pu.desc}</div>
              </div>
              <Btn variant="gold" disabled={p.coins < pu.price} onClick={() => buyItem(pu.id)}>
                🪙 {pu.price}
              </Btn>
            </Card>
          ))}
          <p className="text-xs text-white/40 sm:col-span-2">No ranqueado, no máximo 2 itens por partida — habilidade vale mais que inventário.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COSMETICS.filter((c) => c.kind === tab).map((c) => {
            const owned = ownsCosmetic(p, c.id);
            const equipped = p.cosmetics[c.kind] === c.id;
            const locked = !!c.minLevel && level < c.minLevel;
            return (
              <Card key={c.id} className={`p-3 text-center ${equipped ? 'border-violet-400/70' : ''}`}>
                <div className="h-16 grid place-items-center">
                  {c.kind === 'avatar' && <span className="text-5xl">{c.value}</span>}
                  {c.kind === 'frame' && <Avatar player={p} frame={c.value} size={60} />}
                  {c.kind === 'effect' && <span className="text-4xl" style={{ color: c.value === 'multi' ? undefined : c.value }}>✦✦✦</span>}
                  {c.kind === 'title' && <span className="text-sm text-amber-200">{c.value || '—'}</span>}
                </div>
                <div className="font-display text-sm font-semibold mt-1 truncate">{c.name}</div>
                <div className="mt-2">
                  {equipped ? (
                    <span className="text-xs text-violet-300">Equipado ✔</span>
                  ) : owned ? (
                    <Btn variant="secondary" className="w-full" onClick={() => store.updatePlayer((x) => equipCosmetic(x, c.id))}>
                      Equipar
                    </Btn>
                  ) : locked ? (
                    <span className="text-xs text-white/40">🔒 Nível {c.minLevel}</span>
                  ) : (
                    <Btn variant="gold" className="w-full" disabled={p.coins < c.price} onClick={() => buyCos(c.id)}>
                      🪙 {c.price}
                    </Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
