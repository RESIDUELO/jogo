import { useMemo } from 'react';
import { CAT, CATEGORY_IDS } from '../data/categories';
import { MISSION_BY_ID } from '../data/missions';
import { POWERUP } from '../data/shop';
import { dailyRewardFor } from '../engine/player';
import { leagueFor, levelFromXp } from '../engine/progression';
import { computeStats, rate, recommendation } from '../engine/stats';
import { addDays, dayKey, fmtInt } from '../engine/util';
import { useStore, type Screen } from '../state/store';
import { Avatar, Bar, Btn, Card, Coins } from '../ui/common';

const MENU: { s: Screen; label: string; icon: string; color: string }[] = [
  { s: { name: 'training' }, label: 'TREINO', icon: '📚', color: '#8b5cf6' },
  { s: { name: 'ranked' }, label: 'RANQUEADO', icon: '🏆', color: '#f59e0b' },
  { s: { name: 'missions' }, label: 'MISSÕES', icon: '🎯', color: '#ec4899' },
  { s: { name: 'wrong' }, label: 'QUESTÕES ERRADAS', icon: '🔁', color: '#ef4444' },
  { s: { name: 'stats' }, label: 'MEU DESEMPENHO', icon: '📊', color: '#3b82f6' },
  { s: { name: 'ranking' }, label: 'RANKING', icon: '🥇', color: '#eab308' },
  { s: { name: 'profile' }, label: 'PERFIL', icon: '🪪', color: '#22c55e' },
  { s: { name: 'achievements' }, label: 'CONQUISTAS', icon: '🏅', color: '#f97316' },
  { s: { name: 'shop' }, label: 'LOJA', icon: '🛍️', color: '#14b8a6' },
  { s: { name: 'bank' }, label: 'BANCO DE QUESTÕES', icon: '🗂️', color: '#6366f1' },
  { s: { name: 'admin' }, label: 'ADMIN', icon: '🛠️', color: '#64748b' },
  { s: { name: 'settings' }, label: 'AJUSTES', icon: '⚙️', color: '#475569' },
];

export function Home() {
  const store = useStore();
  const player = store.player!;
  const lvl = levelFromXp(player.xp);
  const league = leagueFor(player.rating);
  const stats = useMemo(() => computeStats(store.answers), [store.answers]);
  const rec = recommendation(stats);
  const today = dayKey();
  const playedToday = player.playDays.includes(today);
  const streak = store.streakDays;
  const reward = dailyRewardFor(streak + (playedToday ? 0 : 1));
  const missionsDone = player.daily.missions.filter((m) => m.progress >= (MISSION_BY_ID[m.id]?.goal ?? 1)).length;
  const toClaim = player.daily.missions.filter((m) => !m.claimed && m.progress >= (MISSION_BY_ID[m.id]?.goal ?? 1)).length;

  return (
    <div className="pb-12 pt-3 space-y-4">
      {/* topo */}
      <div className="flex items-center gap-3">
        <button onClick={() => store.nav({ name: 'profile' })} className="shrink-0">
          <Avatar player={player} size={58} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold truncate">{player.name}</span>
            <span className="text-[11px] rounded-full bg-violet-500/30 text-violet-200 px-2 py-0.5 whitespace-nowrap">Nv {lvl.level}</span>
          </div>
          <div className="text-xs text-white/50 truncate">
            {lvl.icon} {lvl.title} · {league.icon} {league.name} {player.rating}
          </div>
          <Bar pct={lvl.pct} color="linear-gradient(90deg,#8b5cf6,#ec4899)" className="mt-1.5" />
        </div>
        <div className="text-right shrink-0">
          <Coins n={player.coins} className="text-lg" />
          <div className={`text-sm font-semibold ${playedToday ? 'text-orange-300' : 'text-white/40'}`}>🔥 {streak} dia{streak === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* logo + jogar */}
      <div className="relative rounded-[28px] overflow-hidden p-5 sm:p-7 border border-white/10 bg-gradient-to-br from-violet-600/40 via-ink-800 to-fuchsia-600/30">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-48 h-48 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative">
          <div className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Resi<span className="text-amber-300">duelo</span>
          </div>
          <p className="text-white/70 text-sm mt-1">Duelos de questões reais de residência. Gire, responda, conquiste as 5 coroas.</p>
          <div className="flex gap-1.5 mt-3">
            {CATEGORY_IDS.map((c) => (
              <span key={c} className="w-9 h-9 rounded-full grid place-items-center text-lg animate-bob" style={{ background: CAT[c].color, animationDelay: `${CATEGORY_IDS.indexOf(c) * 150}ms` }}>
                {CAT[c].icon}
              </span>
            ))}
          </div>
          <Btn big variant="gold" className="w-full mt-5 text-2xl py-5" onClick={() => store.nav({ name: 'play' })}>
            ⚔️ JOGAR
          </Btn>
          <div className="text-center text-[11px] text-white/40 mt-2">{fmtInt(store.questions.filter((q) => q.status === 'ativa').length)} questões ativas · {store.exams.length} provas</div>
        </div>
      </div>

      {/* streak diário */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-semibold">🔥 Sequência diária</div>
          {!player.daily.claimedDailyReward ? (
            <Btn variant="gold" onClick={store.claimDaily}>
              Resgatar dia {reward.day}: <span className="coin ml-1" /> {reward.coins} + {POWERUP[reward.item].icon}
            </Btn>
          ) : (
            <span className="text-xs text-emerald-300">Recompensa de hoje resgatada ✔</span>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(today, i - 6);
            const on = player.playDays.includes(d);
            const isToday = d === today;
            return (
              <div key={d} className={`rounded-xl py-2 text-center border ${on ? 'bg-orange-500/25 border-orange-400/50' : 'bg-black/20 border-white/5'} ${isToday ? 'ring-2 ring-violet-400/60' : ''}`}>
                <div className="text-lg">{on ? '🔥' : '·'}</div>
                <div className="text-[10px] text-white/50">{isToday ? 'hoje' : ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][new Date(d + 'T12:00').getDay()]}</div>
              </div>
            );
          })}
        </div>
        {!playedToday && <p className="text-xs text-white/50 mt-2">Responda uma questão hoje para manter sua sequência.</p>}
      </Card>

      {/* menu */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {MENU.map((m) => (
          <button
            key={m.label}
            onClick={() => store.nav(m.s)}
            className="relative rounded-2xl p-3 pt-4 text-center bg-ink-800/80 border border-white/10 hover:-translate-y-1 hover:border-white/25 active:translate-y-0 transition shadow-lg"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl grid place-items-center text-2xl shadow-inner" style={{ background: `linear-gradient(145deg, ${m.color}, ${m.color}88)` }}>
              {m.icon}
            </div>
            <div className="mt-2 text-[11px] font-display font-semibold leading-tight">{m.label}</div>
            {m.label === 'MISSÕES' && toClaim > 0 && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-500 text-[10px] grid place-items-center animate-bounce">{toClaim}</span>}
          </button>
        ))}
      </div>

      {/* feedback pedagógico */}
      <Card className="p-4">
        <div className="font-display font-semibold mb-2">📈 Seu desempenho nesta semana</div>
        {stats.week.total.n === 0 ? (
          <p className="text-sm text-white/60">Ainda sem questões nesta semana. Uma partida rápida = ~10 questões de residência.</p>
        ) : (
          <div className="space-y-1.5">
            {CATEGORY_IDS.map((c) => {
              const a = stats.week.byCat[c];
              return (
                <div key={c} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0" style={{ color: CAT[c].color }}>
                    {CAT[c].icon} {CAT[c].name}
                  </span>
                  <Bar pct={rate(a)} color={CAT[c].color} />
                  <span className="w-12 text-right shrink-0 text-white/70">{a.n ? `${Math.round(rate(a) * 100)}%` : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
        {stats.weakSubs.length > 0 && (
          <div className="mt-3 text-sm">
            <div className="text-white/60">Você apresentou maior dificuldade em:</div>
            <ul className="mt-1 space-y-0.5">
              {stats.weakSubs.slice(0, 3).map((s) => (
                <li key={s.cat + s.sub}>
                  • <span style={{ color: CAT[s.cat].color }}>{s.sub}</span> <span className="text-white/40">({s.acc.c}/{s.acc.n})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rec && (
          <div className="mt-3 rounded-xl bg-violet-500/15 border border-violet-400/30 p-3 flex items-center gap-3">
            <div className="text-2xl">{CAT[rec.cat].icon}</div>
            <div className="flex-1 text-sm">
              <b>Recomendação:</b> {rec.count} questões de {CAT[rec.cat].full} <span className="text-white/50">({rec.reason})</span>
            </div>
            <Btn onClick={() => store.nav({ name: 'trainingRun', config: { count: rec.count, categories: [rec.cat], wrongOnly: false } })}>Treinar</Btn>
          </div>
        )}
      </Card>

      {/* missões resumo */}
      <Card className="p-4" onClick={() => store.nav({ name: 'missions' })}>
        <div className="flex items-center justify-between">
          <div className="font-display font-semibold">🎯 Missões diárias</div>
          <span className="text-xs text-white/50">
            {missionsDone}/{player.daily.missions.length}
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {player.daily.missions.slice(0, 3).map((m) => {
            const t = MISSION_BY_ID[m.id];
            if (!t) return null;
            return (
              <div key={m.id} className="text-sm">
                <div className="flex justify-between">
                  <span className={m.claimed ? 'line-through text-white/40' : ''}>{t.text}</span>
                  <span className="text-white/50">
                    {m.progress}/{t.goal}
                  </span>
                </div>
                <Bar pct={m.progress / t.goal} color={m.progress >= t.goal ? '#22c55e' : '#8b5cf6'} h="h-1.5" className="mt-1" />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="text-center text-[11px] text-white/30">
        Jogando como {player.name} ·{' '}
        <button className="underline" onClick={() => store.nav({ name: 'players' })}>
          trocar perfil
        </button>
      </div>
    </div>
  );
}
