import { useEffect, useState } from 'react';
import { BOT_BY_ID } from '../data/bots';
import { leagueFor, levelFromXp } from '../engine/progression';
import { fmtInt, fmtPct, fmtSec } from '../engine/util';
import { useStore, type MatchLaunch, type TrainingLaunch } from '../state/store';
import type { MatchSummary } from '../types';
import { Bar, Btn, CatBadge } from '../ui/common';
import { Particles } from '../ui/Particles';

export function ResultScreen({ summary, rematch, retrain }: { summary: MatchSummary; rematch?: MatchLaunch; retrain?: TrainingLaunch }) {
  const store = useStore();
  const player = store.player!;
  const [burst, setBurst] = useState(0);
  const win = summary.result === 'win';
  const training = summary.result === 'treino';
  useEffect(() => {
    if (win || (training && summary.total && summary.correct / summary.total >= 0.7)) setBurst(1);
  }, [win, training, summary]);

  const lvl = levelFromXp(player.xp);
  const title = training ? 'TREINO CONCLUÍDO' : win ? 'VOCÊ VENCEU!' : summary.result === 'draw' ? 'EMPATE!' : 'VOCÊ PERDEU';
  const emoji = training ? '📚' : win ? '🏆' : summary.result === 'draw' ? '🤝' : '💔';
  const bot = summary.botId ? BOT_BY_ID[summary.botId] : undefined;
  const acc = summary.total ? summary.correct / summary.total : 0;
  const wrongQs = summary.wrongIds.map((id) => store.qById.get(id)).filter(Boolean);

  return (
    <div className="pb-10 pt-6 max-w-xl mx-auto">
      <div className="text-center animate-pop">
        <div className={`text-7xl ${win ? 'animate-glow' : ''}`}>{emoji}</div>
        <h1 className={`font-display text-4xl sm:text-5xl font-bold mt-2 ${win ? 'text-amber-300' : training ? 'text-violet-300' : summary.result === 'draw' ? 'text-sky-300' : 'text-rose-300'}`}>{title}</h1>
        {!training && (
          <p className="text-white/60 mt-1">
            vs {summary.opponentName} · 👑 {summary.crowns} × {summary.oppCrowns} · {fmtInt(summary.score)} × {fmtInt(summary.oppScore)} pts
          </p>
        )}
        {bot && !training && <p className="text-white/50 italic text-sm mt-2">“{win ? bot.taunts.lose : bot.taunts.win}”</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
        <ResultTile label="Pontuação" value={fmtInt(summary.score)} delay={0} />
        <ResultTile label="Acertos" value={`${summary.correct}/${summary.total}`} delay={1} />
        <ResultTile label="Precisão" value={fmtPct(acc)} delay={2} color={acc >= 0.7 ? '#4ade80' : acc >= 0.5 ? '#facc15' : '#f87171'} />
        <ResultTile label="Tempo médio" value={fmtSec(summary.avgMs)} delay={3} />
        <ResultTile label="XP" value={`+${summary.xp}`} delay={4} color="#c4b5fd" />
        <ResultTile label="Coins" value={`+${summary.coins}`} delay={5} color="#fcd34d" />
        {summary.mode === 'ranked' && (
          <ResultTile label="Rating" value={`${summary.ratingDelta >= 0 ? '+' : ''}${summary.ratingDelta}`} delay={6} color={summary.ratingDelta >= 0 ? '#4ade80' : '#f87171'} />
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-ink-800/70 border border-white/10 p-4">
        <div className="flex justify-between text-sm mb-1">
          <span>
            {lvl.icon} Nível {lvl.level} · {lvl.title}
          </span>
          <span className="text-white/50">
            {fmtInt(lvl.into)}/{fmtInt(lvl.need)} XP
          </span>
        </div>
        <Bar pct={lvl.pct} color="linear-gradient(90deg,#8b5cf6,#ec4899)" h="h-3" />
        {summary.mode === 'ranked' && (
          <div className="mt-3 text-sm text-white/70">
            {leagueFor(player.rating).icon} Liga {leagueFor(player.rating).name} · Rating <b>{player.rating}</b>
          </div>
        )}
      </div>

      {wrongQs.length > 0 && (
        <div className="mt-4 rounded-2xl bg-rose-500/10 border border-rose-400/20 p-4">
          <div className="font-display font-semibold mb-2">Questões erradas ({wrongQs.length})</div>
          <div className="space-y-1.5 mb-3">
            {wrongQs.slice(0, 5).map((q) => (
              <div key={q!.id} className="flex items-center gap-2 text-sm">
                <CatBadge cat={q!.category} small />
                <span className="truncate text-white/70">{q!.subtopic}</span>
              </div>
            ))}
          </div>
          <Btn variant="danger" className="w-full" onClick={() => store.nav({ name: 'trainingRun', config: { count: wrongQs.length, categories: [], wrongOnly: false, questionIds: summary.wrongIds } })}>
            🔁 Revisar questões erradas
          </Btn>
        </div>
      )}

      <div className="mt-6 grid gap-2">
        {rematch && (
          <Btn big variant="gold" onClick={() => store.nav({ name: 'match', config: rematch })}>
            ⚔️ REVANCHE
          </Btn>
        )}
        {retrain && (
          <Btn big onClick={() => store.nav({ name: 'trainingRun', config: { ...retrain, questionIds: undefined } })}>
            📚 Treinar de novo
          </Btn>
        )}
        <Btn variant="secondary" onClick={() => store.nav({ name: 'home' })}>
          Voltar ao início
        </Btn>
      </div>
      <Particles burst={burst} count={140} />
    </div>
  );
}

function ResultTile({ label, value, color, delay }: { label: string; value: string; color?: string; delay: number }) {
  return (
    <div className="rounded-2xl bg-ink-800/80 border border-white/10 p-3 text-center animate-rise" style={{ animationDelay: `${200 + delay * 90}ms` }}>
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="font-display text-2xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
