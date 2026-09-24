import { useMemo, useState } from 'react';
import { CAT, CATEGORY_IDS, DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '../data/categories';
import { computeStats, rate, recommendation } from '../engine/stats';
import { fmtPct, fmtSec } from '../engine/util';
import { useStore } from '../state/store';
import type { CategoryId, Difficulty } from '../types';
import { Bar, Btn, Card, Empty, Header, Seg, Stat } from '../ui/common';
import { Donut, LineChart } from '../ui/Charts';

export function StatsScreen() {
  const store = useStore();
  const s = useMemo(() => computeStats(store.answers), [store.answers]);
  const rec = recommendation(s);
  const [subCat, setSubCat] = useState<CategoryId | 'ALL'>('ALL');
  const [range, setRange] = useState<14 | 30 | 90>(30);

  if (s.total.n === 0)
    return (
      <div>
        <Header title="Meu desempenho" />
        <Empty icon="📊" text="Responda algumas questões para ver suas estatísticas.">
          <Btn onClick={() => store.nav({ name: 'play' })}>Jogar agora</Btn>
        </Empty>
      </div>
    );

  const days = s.byDay.slice(-range);
  const subs = s.bySub.filter((x) => subCat === 'ALL' || x.cat === subCat);
  const wrongCount = new Set(store.answers.filter((a) => !a.correct).map((a) => a.qid)).size;
  const distinct = new Set(store.answers.map((a) => a.qid)).size;

  return (
    <div className="pb-10">
      <Header title="Meu desempenho" subtitle="Seu estudo transformado em dados" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Respondidas" value={s.total.n} icon="📝" />
        <Stat label="Questões distintas" value={distinct} icon="🧩" />
        <Stat label="Acerto geral" value={fmtPct(rate(s.total))} icon="🎯" color="#4ade80" />
        <Stat label="Tempo médio" value={fmtSec(s.total.ms / s.total.n)} icon="⏱️" />
        <Stat label="Questões erradas" value={wrongCount} icon="❌" color="#f87171" />
        <Stat label="Difíceis acertadas" value={`${(s.byDiff[3]?.c ?? 0) + (s.byDiff[4]?.c ?? 0)}`} icon="🧗" />
        <Stat label="Nunca respondidas" value={store.questions.filter((q) => q.status === 'ativa' && !store.history.has(q.id)).length} icon="🆕" />
        <Stat label="Nesta semana" value={s.week.total.n} icon="📅" />
      </div>

      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-3">Acertos por categoria</div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 justify-items-center">
          {CATEGORY_IDS.map((c) => (
            <div key={c} className="text-center">
              <Donut value={rate(s.byCat[c])} color={CAT[c].color} label={`${s.byCat[c].c}/${s.byCat[c].n}`} />
              <div className="text-xs mt-1" style={{ color: CAT[c].color }}>
                {CAT[c].icon} {CAT[c].name}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="font-display font-semibold">Evolução ao longo do tempo</div>
          <Seg value={range} onChange={setRange} options={[{ v: 14, label: '14d' }, { v: 30, label: '30d' }, { v: 90, label: '90d' }]} />
        </div>
        <LineChart points={days.map((d) => ({ label: d.day.slice(5).split('-').reverse().join('/'), v: rate(d.acc) }))} bars={days.map((d) => d.acc.n)} />
        <div className="text-[11px] text-white/40">Linha: % de acerto por dia · barras: questões respondidas.</div>
      </Card>

      {(s.weakSubs.length > 0 || rec) && (
        <Card className="p-4 mt-4 border-rose-400/20">
          <div className="font-display font-semibold mb-2">🩹 Onde você mais erra</div>
          {s.weakSubs.length === 0 && <p className="text-sm text-white/60">Nenhum subtema com baixo desempenho (mín. 2 respostas).</p>}
          <div className="space-y-2">
            {s.weakSubs.map((w) => (
              <div key={w.cat + w.sub} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full" style={{ background: CAT[w.cat].color }} />
                <span className="flex-1 truncate">{w.sub}</span>
                <span className="text-rose-300">{fmtPct(rate(w.acc))}</span>
                <span className="text-white/40 text-xs">
                  ({w.acc.c}/{w.acc.n})
                </span>
              </div>
            ))}
          </div>
          {rec && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-violet-500/15 border border-violet-400/30 p-3">
              <div className="flex-1 text-sm">
                <b>Recomendação de estudo:</b> {rec.count} questões de {CAT[rec.cat].full}.
              </div>
              <Btn onClick={() => store.nav({ name: 'trainingRun', config: { count: rec.count, categories: [rec.cat], wrongOnly: false } })}>Treinar</Btn>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-2">Por dificuldade</div>
        <div className="space-y-2">
          {([1, 2, 3, 4] as Difficulty[]).map((d) => {
            const a = s.byDiff[d];
            return (
              <div key={d} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0" style={{ color: DIFFICULTY_COLOR[d] }}>
                  {DIFFICULTY_LABEL[d]}
                </span>
                <Bar pct={rate(a)} color={DIFFICULTY_COLOR[d]} />
                <span className="w-24 text-right shrink-0 text-white/60 text-xs">{a.n ? `${fmtPct(rate(a))} (${a.n})` : '—'}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="font-display font-semibold">Acertos por subtema</div>
          <select className="input !w-auto !py-1.5" value={subCat} onChange={(e) => setSubCat(e.target.value as CategoryId | 'ALL')}>
            <option value="ALL">Todas as áreas</option>
            {CATEGORY_IDS.map((c) => (
              <option key={c} value={c}>
                {CAT[c].name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {subs.map((x) => (
            <div key={x.cat + x.sub} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">
                  <span style={{ color: CAT[x.cat].color }}>●</span> {x.sub}
                </span>
                <span className="text-white/60 shrink-0">
                  {fmtPct(rate(x.acc))} · {x.acc.n}
                </span>
              </div>
              <Bar pct={rate(x.acc)} color={CAT[x.cat].color} h="h-1.5" className="mt-1" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
