import { useEffect, useState } from 'react';
import { BOT_BY_ID } from '../data/bots';
import { leagueFor, levelFromXp } from '../engine/progression';
import { fmtInt, fmtPct, fmtSec } from '../engine/util';
import { useStore, type MatchLaunch, type TrainingLaunch } from '../state/store';
import { CAT } from '../data/categories';
import type { CategoryId, Letter, MatchSummary, Question, ReportItem } from '../types';
import { LETTERS } from '../types';
import { Bar, Btn, Card, CatBadge, Header } from '../ui/common';
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

      {(summary.report?.length || wrongQs.length > 0) && (
        <div className="mt-4 rounded-2xl bg-ink-800/70 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display font-semibold">📋 Relatório da partida</div>
            <span className="text-xs text-white/50">
              ✔ {summary.correct} · ✖ {summary.total - summary.correct}
            </span>
          </div>
          <MatchReport summary={summary} limit={4} />
          <Btn className="w-full mt-3" onClick={() => store.nav({ name: 'report', summary })}>
            Ver relatório completo {summary.report && summary.report.length > 4 ? `(${summary.report.length} questões)` : ''}
          </Btn>
          {wrongQs.length > 0 && (
            <Btn variant="danger" className="w-full mt-2" onClick={() => store.nav({ name: 'trainingRun', config: { count: wrongQs.length, categories: [], wrongOnly: false, questionIds: summary.wrongIds } })}>
              🔁 Revisar questões erradas ({wrongQs.length})
            </Btn>
          )}
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

// ---------------------------------------------------------------- Relatório
function reportItems(summary: MatchSummary): ReportItem[] {
  if (summary.report?.length) return summary.report;
  // partidas antigas (sem relatório): só as erradas
  return summary.wrongIds.map((qid) => ({ qid, cat: 'CLI', chosen: null, correct: false, ms: 0, points: 0 }));
}

export function MatchReport({ summary, limit }: { summary: MatchSummary; limit?: number }) {
  const store = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const items = reportItems(summary);
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="space-y-2">
      {shown.map((it, i) => {
        const q = store.qById.get(it.qid);
        if (!q) return null;
        const isOpen = open === it.qid + i;
        return (
          <div key={it.qid + i} className={`report-item rounded-2xl border p-3 ${it.correct ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-rose-400/30 bg-rose-500/5'}`}>
            <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : it.qid + i)}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-display font-bold ${it.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {i + 1}. {it.correct ? '✔ Acertou' : it.chosen ? '✖ Errou' : '⏰ Sem resposta'}
                </span>
                <CatBadge cat={q.category} small />
                {it.crown && <span className="text-xs text-amber-300">👑 coroa</span>}
                <span className="text-xs text-white/50">{q.subtopic}</span>
                <span className="ml-auto text-[11px] text-white/40">
                  {q.institution} {q.year} · Q{q.number}
                </span>
              </div>
              <div className="text-sm mt-1">
                Sua resposta: <b className={it.correct ? 'text-emerald-300' : 'text-rose-300'}>{it.chosen ?? '—'}</b> · Correta: <b className="text-emerald-300">{q.answer}</b>
                {it.ms > 0 && <span className="text-white/40"> · {fmtSec(it.ms)}</span>}
              </div>
              {!isOpen && <p className="text-sm text-white/60 mt-1 line-clamp-2 no-print">{q.text}</p>}
            </button>
            <div className={isOpen ? '' : 'hidden print-block'}>
              <QuestionFull q={q} chosen={it.chosen} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionFull({ q, chosen }: { q: Question; chosen: Letter | null }) {
  const [orig, setOrig] = useState(false);
  return (
    <div className="mt-2 space-y-2 text-sm">
      <p className="text-white/90 whitespace-pre-line">{q.text}</p>
      {q.images?.map((img) => <img key={img} src={`${import.meta.env.BASE_URL}banco/img/${img}`} alt="" className="max-h-60 rounded-lg bg-white" />)}
      {LETTERS.filter((l) => q.alternatives[l]).map((l) => (
        <div key={l} className={`rounded-lg px-2 py-1 ${l === q.answer ? 'bg-emerald-500/15 text-emerald-200' : l === chosen ? 'bg-rose-500/15 text-rose-200' : 'text-white/70'}`}>
          <b>{l})</b> {q.alternatives[l]} {l === q.answer ? '✔' : l === chosen ? '✖' : ''}
        </div>
      ))}
      <div className="rounded-lg bg-violet-500/10 p-2 text-white/80">{q.explanationFull || q.explanation}</div>
      {q.original?.length ? (
        <div className="no-print">
          <button className="text-xs underline text-sky-300" onClick={() => setOrig(!orig)}>
            {orig ? 'ocultar' : '📄 ver questão original (PDF)'}
          </button>
          {orig && q.original.map((o) => <img key={o} src={`${import.meta.env.BASE_URL}banco/orig/${o}`} alt="Questão original" className="mt-2 w-full rounded-lg bg-white" />)}
        </div>
      ) : null}
    </div>
  );
}

export function ReportScreen({ summary }: { summary: MatchSummary }) {
  const store = useStore();
  const items = reportItems(summary);
  const correct = items.filter((i) => i.correct).length;
  const byCat = new Map<string, { n: number; c: number }>();
  items.forEach((it) => {
    const q = store.qById.get(it.qid);
    const k = q?.category ?? it.cat;
    const x = byCat.get(k) ?? { n: 0, c: 0 };
    x.n++;
    if (it.correct) x.c++;
    byCat.set(k, x);
  });
  return (
    <div className="pb-10 print-area">
      <div className="no-print">
        <Header title="Relatório da partida" subtitle={new Date(summary.at).toLocaleString('pt-BR')} right={<Btn variant="secondary" onClick={() => window.print()}>🖨️ PDF</Btn>} />
      </div>
      <div className="print-only font-display text-2xl font-bold mb-2">Residuelo — Relatório da partida</div>
      <Card className="p-4 mb-4">
        <div className="text-sm text-white/70">
          {summary.mode === 'treino' ? 'Treino' : `vs ${summary.opponentName}`} · {new Date(summary.at).toLocaleString('pt-BR')} ·{' '}
          <b>{summary.result === 'win' ? 'Vitória' : summary.result === 'loss' ? 'Derrota' : summary.result === 'draw' ? 'Empate' : 'Treino'}</b>
        </div>
        <div className="font-display text-3xl font-bold mt-1">
          {correct}/{items.length} acertos <span className="text-lg text-white/60">({items.length ? Math.round((correct / items.length) * 100) : 0}%)</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {[...byCat.entries()].map(([c, v]) => (
            <span key={c} className="text-xs rounded-full px-2 py-1" style={{ background: CAT[c as CategoryId].color + '33', color: CAT[c as CategoryId].color }}>
              {CAT[c as CategoryId].icon} {CAT[c as CategoryId].name}: {v.c}/{v.n}
            </span>
          ))}
        </div>
      </Card>
      <MatchReport summary={summary} />
      <div className="no-print mt-4 grid gap-2">
        {items.some((i) => !i.correct) && (
          <Btn variant="danger" onClick={() => store.nav({ name: 'trainingRun', config: { count: items.filter((i) => !i.correct).length, categories: [], wrongOnly: false, questionIds: items.filter((i) => !i.correct).map((i) => i.qid) } })}>
            🔁 Refazer as que errei
          </Btn>
        )}
        <Btn variant="secondary" onClick={() => window.print()}>
          🖨️ Salvar relatório em PDF / imprimir
        </Btn>
      </div>
    </div>
  );
}
