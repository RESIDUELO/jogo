import { useMemo } from 'react';
import { useGame } from '../state/store';
import { Panel, Stat } from '../components/ui';
import { isMastered } from '../engine/srs';
import { addDays, fmt, fmtDuration, startOfDay } from '../engine/util';

export function Stats() {
  const { s } = useGame();
  const data = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(now);
    const week = addDays(now, -6);
    const month = addDays(now, -29);
    const log = s.log;
    const inRange = (t0: number) => log.filter(r => r.t >= t0);
    const acc = (arr: typeof log) => (arr.length ? arr.filter(r => r.grade > 1).length / arr.length : 0);
    const days = Array.from({ length: 30 }, (_, i) => {
      const t0 = addDays(now, i - 29);
      const t1 = addDays(now, i - 28);
      const rs = log.filter(r => r.t >= t0 && r.t < t1);
      return { t: t0, n: rs.length, ok: rs.filter(r => r.grade > 1).length, xp: rs.reduce((a, r) => a + r.xp, 0) };
    });
    const byDeck = new Map<string, number>();
    for (const r of log) byDeck.set(r.deckId, (byDeck.get(r.deckId) ?? 0) + 1);
    const topDeckId = [...byDeck].sort((a, b) => b[1] - a[1])[0]?.[0];
    const hardest = [...s.cards]
      .filter(c => c.correct + c.wrong >= 2)
      .sort((a, b) => b.wrong / (b.correct + b.wrong) - a.wrong / (a.correct + a.wrong) || b.wrong - a.wrong)
      .slice(0, 8);
    const grades = [1, 2, 3, 4].map(g => log.filter(r => r.grade === g).length);
    const forecast = Array.from({ length: 14 }, (_, i) => {
      const t0 = i === 0 ? 0 : addDays(now, i);
      const t1 = addDays(now, i + 1);
      return s.cards.filter(c => c.state === 'review' && c.due >= t0 && c.due < t1).length;
    });
    return {
      today: inRange(today), week: inRange(week), month: inRange(month), acc: acc(log), days, grades, forecast,
      topDeck: s.decks.find(d => d.id === topDeckId)?.name ?? '—', hardest,
      mastered: s.cards.filter(isMastered).length,
    };
  }, [s]);

  const maxDay = Math.max(1, ...data.days.map(d => d.n));
  const maxFc = Math.max(1, ...data.forecast);
  const totalGrades = Math.max(1, data.grades.reduce((a, b) => a + b, 0));
  const gradeInfo = [
    { label: 'Errei', cls: 'g-again' }, { label: 'Difícil', cls: 'g-hard' }, { label: 'Acertei', cls: 'g-good' }, { label: 'Dominei', cls: 'g-easy' },
  ];

  return (
    <div className="stats-screen">
      <div className="stat-grid">
        <Stat icon="📅" label="Cards hoje" value={data.today.length} />
        <Stat icon="🗓️" label="Nesta semana" value={data.week.length} />
        <Stat icon="📆" label="Nos últimos 30 dias" value={data.month.length} />
        <Stat icon="🎯" label="Taxa de acerto" value={`${Math.round(data.acc * 100)}%`} />
        <Stat icon="⏱️" label="Tempo estudado" value={fmtDuration(s.stats.studyMs)} />
        <Stat icon="✨" label="XP total" value={fmt(s.stats.totalXp)} />
        <Stat icon="⚡" label="Maior combo" value={s.stats.maxCombo} />
        <Stat icon="⚔️" label="Inimigos derrotados" value={s.stats.enemiesDefeated} />
        <Stat icon="☠️" label="Bosses derrotados" value={s.stats.bossesDefeated} />
        <Stat icon="🧠" label="Cards dominados" value={data.mastered} />
        <Stat icon="📚" label="Deck mais estudado" value={<span className="small-val">{data.topDeck}</span>} />
        <Stat icon="🔥" label="Maior sequência" value={`${s.streak.best} dias`} />
      </div>

      <Panel title="Revisões nos últimos 30 dias">
        <div className="chart">
          {data.days.map(d => (
            <div key={d.t} className="chart-col" title={`${new Date(d.t).toLocaleDateString('pt-BR')}: ${d.n} cards, ${d.ok} acertos, ${d.xp} XP`}>
              <div className="chart-bar" style={{ height: `${(100 * d.n) / maxDay}%` }}>
                <div className="chart-ok" style={{ height: d.n ? `${(100 * d.ok) / d.n}%` : 0 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="chart-legend"><span><i className="lg-ok" />acertos</span><span><i className="lg-bad" />erros</span></div>
      </Panel>

      <div className="two-col">
        <Panel title="Distribuição das respostas">
          <div className="dist">
            {gradeInfo.map((g, i) => (
              <div key={g.label} className="dist-row">
                <span>{g.label}</span>
                <div className="dist-bar"><div className={g.cls} style={{ width: `${(100 * data.grades[i]) / totalGrades}%` }} /></div>
                <b>{data.grades[i]}</b>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Previsão de revisões (14 dias)">
          <div className="chart small">
            {data.forecast.map((n, i) => (
              <div key={i} className="chart-col" title={`${i === 0 ? 'Hoje (incl. atrasados)' : `+${i} dia(s)`}: ${n}`}>
                <div className="chart-bar fc" style={{ height: `${(100 * n) / maxFc}%` }} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="⚠️ Cards mais difíceis">
        {data.hardest.length === 0 ? <p className="muted">Responda mais cards para ver esta lista.</p> : (
          <ul className="hardest">
            {data.hardest.map(c => (
              <li key={c.id}>
                <span>{c.hard && <b className="bad">DIFÍCIL </b>}{c.front}</span>
                <small className="muted">{c.correct} acertos · {c.wrong} erros</small>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
