import { useMemo, useState } from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import { CAT, CATEGORY_IDS } from '../data/categories';
import { COSMETIC } from '../data/shop';
import { catLevelFromXp, leagueFor, levelFromXp } from '../engine/progression';
import { computeStats, rate } from '../engine/stats';
import { fmtInt, fmtPct, fmtSec } from '../engine/util';
import { useStore } from '../state/store';
import { Avatar, Bar, Btn, Card, Header, Stat } from '../ui/common';

export function Profile() {
  const store = useStore();
  const p = store.player!;
  const lvl = levelFromXp(p.xp);
  const league = leagueFor(p.rating);
  const s = useMemo(() => computeStats(store.answers), [store.answers]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const title = COSMETIC[p.cosmetics.title]?.value;
  const history = store.matches.slice().reverse();
  const unlocked = ACHIEVEMENTS.filter((a) => p.achievements[a.id]);

  return (
    <div className="pb-10">
      <Header title="Perfil" />
      <Card className="p-5 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-violet-600/40 via-fuchsia-600/30 to-sky-600/40" />
        <div className="relative">
          <Avatar player={p} size={96} className="mx-auto" />
          {editing ? (
            <div className="flex gap-2 justify-center mt-3">
              <input className="input max-w-[220px]" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
              <Btn
                onClick={() => {
                  if (name.trim()) store.updatePlayer((x) => ({ ...x, name: name.trim() }));
                  setEditing(false);
                }}
              >
                Salvar
              </Btn>
            </div>
          ) : (
            <h2 className="font-display text-2xl font-bold mt-2">
              {p.name}{' '}
              <button onClick={() => setEditing(true)} className="text-sm text-white/40 hover:text-white">
                ✏️
              </button>
            </h2>
          )}
          {title && <div className="text-sm text-amber-200">{title}</div>}
          <div className="text-white/60 text-sm mt-1">
            {lvl.icon} Nível {lvl.level} · {lvl.title}
          </div>
          <div className="max-w-sm mx-auto mt-2">
            <Bar pct={lvl.pct} color="linear-gradient(90deg,#8b5cf6,#ec4899)" h="h-3" />
            <div className="text-xs text-white/50 mt-1">
              {fmtInt(lvl.into)}/{fmtInt(lvl.need)} XP · total {fmtInt(p.xp)} XP
            </div>
          </div>
          <div className="mt-2 text-sm">
            {league.icon} <span style={{ color: league.color }}>{league.name}</span> · rating {p.rating}
          </div>
          <Btn variant="ghost" className="mt-3" onClick={() => store.nav({ name: 'shop' })}>
            🎨 Personalizar
          </Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Stat label="Vitórias" value={p.wins} icon="🏆" color="#4ade80" />
        <Stat label="Derrotas" value={p.losses} icon="💔" color="#f87171" />
        <Stat label="Taxa de acerto" value={fmtPct(rate(s.total))} icon="🎯" />
        <Stat label="Respondidas" value={fmtInt(s.total.n)} icon="📝" />
        <Stat label="Acertadas" value={fmtInt(s.total.c)} icon="✅" />
        <Stat label="Melhor sequência" value={p.bestAnswerStreak} icon="🔥" />
        <Stat label="Tempo médio" value={s.total.n ? fmtSec(s.total.ms / s.total.n) : '—'} icon="⏱️" />
        <Stat label="Série de vitórias" value={`${p.winStreak} (máx ${p.bestWinStreak})`} icon="⚡" />
        <Stat label="Mais forte" value={s.strongest ? `${CAT[s.strongest].icon} ${CAT[s.strongest].name}` : '—'} icon="💪" />
        <Stat label="Mais fraca" value={s.weakest ? `${CAT[s.weakest].icon} ${CAT[s.weakest].name}` : '—'} icon="🩹" />
        <Stat label="Conquistas" value={`${unlocked.length}/${ACHIEVEMENTS.length}`} icon="🏅" />
        <Stat label="Sequência diária" value={`${store.streakDays} dias`} icon="📅" />
      </div>

      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-3">Nível por categoria</div>
        <div className="space-y-3">
          {CATEGORY_IDS.map((c) => {
            const cl = catLevelFromXp(p.catXp[c]);
            return (
              <div key={c}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: CAT[c].color }}>
                    {CAT[c].icon} {CAT[c].full}
                  </span>
                  <span className="font-display">Nível {cl.level}</span>
                </div>
                <Bar pct={cl.pct} color={CAT[c].color} className="mt-1" />
                <div className="text-[11px] text-white/40 mt-0.5">
                  {s.byCat[c].n ? `${fmtPct(rate(s.byCat[c]))} de acerto em ${s.byCat[c].n} cartões` : 'Nenhum cartão ainda'}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {unlocked.length > 0 && (
        <Card className="p-4 mt-4">
          <div className="font-display font-semibold mb-2">Conquistas</div>
          <div className="flex flex-wrap gap-2">
            {unlocked.map((a) => (
              <span key={a.id} title={a.desc} className="rounded-xl bg-amber-400/15 border border-amber-300/30 px-2 py-1 text-sm">
                {a.icon} {a.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-2">Histórico de partidas <span className="text-xs text-white/40 font-sans">(toque para ver o relatório)</span></div>
        {history.length === 0 && <p className="text-sm text-white/50">Nenhuma partida ainda.</p>}
        <div className="divide-y divide-white/5">
          {history.slice(0, 30).map((m) => (
            <button key={m.id} onClick={() => store.nav({ name: 'report', summary: m })} className="w-full text-left py-2 flex items-center gap-3 text-sm hover:bg-white/5 rounded-lg">
              <span className="text-lg">{m.result === 'win' ? '🏆' : m.result === 'loss' ? '💔' : m.result === 'draw' ? '🤝' : '📚'}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  {m.mode === 'treino' ? 'Treino' : `vs ${m.opponentName}`} <span className="text-white/40">· {m.mode === 'ranked' ? 'Ranqueado' : m.mode === 'pvp-local' ? 'Local' : m.mode === 'pvp-bot' ? 'vs BOT' : m.mode === 'pvp-online' ? 'Online' : ''}</span>
                </div>
                <div className="text-[11px] text-white/40">
                  {new Date(m.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {m.correct}/{m.total} acertos
                  {m.mode !== 'treino' && ` · 👑 ${m.crowns}×${m.oppCrowns}`}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-violet-300">+{m.xp} XP</div>
                {m.ratingDelta !== 0 && <div className={m.ratingDelta > 0 ? 'text-emerald-300' : 'text-rose-300'}>{m.ratingDelta > 0 ? '+' : ''}{m.ratingDelta}</div>}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
