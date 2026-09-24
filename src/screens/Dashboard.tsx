import { useGame } from '../state/store';
import { Bar, Panel, Stat } from '../components/ui';
import { CLASS_BY_ID, STREAK_MILESTONES } from '../data/content';
import { REGIONS, REGION_BY_ID } from '../data/world';
import { queueCounts, startBattle, STREAK_MIN_CARDS } from '../engine/game';
import { levelProgress, streakBonus } from '../engine/progression';
import { describeReward } from '../engine/quests';
import { fmt } from '../engine/util';

export function Dashboard() {
  const { s, run, go } = useGame();
  const p = s.player;
  const lp = levelProgress(p.xp);
  const counts = queueCounts(s, null);
  const region = REGION_BY_ID[s.currentRegion];
  const rp = s.regions[s.currentRegion];
  const nextMilestone = STREAK_MILESTONES.find(m => m.days > s.streak.current);
  const nextRegion = REGIONS.find(r => !s.regions[r.id].unlocked);
  const goalPct = Math.min(1, s.today.answered / s.settings.dailyGoal);
  const accToday = s.today.answered ? Math.round((100 * s.today.correct) / s.today.answered) : 0;

  const adventure = () => {
    if (!s.battle) run(x => startBattle(x, x.currentRegion, null));
    go('battle');
  };

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero-left">
          <div className="hero-class">{CLASS_BY_ID[p.classId].icon}</div>
          <div>
            <div className="muted small">Bem-vindo de volta,</div>
            <h1 className="cinzel">{p.name}</h1>
            <div className="hero-level">NÍVEL {p.level}</div>
            <Bar kind="xp" big value={lp.current} max={lp.needed} label={`${fmt(lp.current)} / ${fmt(lp.needed)} XP`} />
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary btn-big" onClick={adventure}>
            ⚔️ {s.battle ? 'Continuar aventura' : 'Iniciar aventura'}
            <small>{counts.total ? `${counts.total} cards esperando` : 'Nada pendente — treino livre'}</small>
          </button>
          <div className="hero-grid">
            <button className="btn" onClick={() => go('decks')}>📚 Estudar cards</button>
            <button className="btn" onClick={() => go('character')}>🧙 Personagem</button>
            <button className="btn" onClick={() => go('inventory')}>🎒 Inventário</button>
            <button className="btn" onClick={() => go('map')}>🗺️ Mapa</button>
            <button className="btn" onClick={() => go('quests')}>📜 Missões</button>
            <button className="btn" onClick={() => go('stats')}>📊 Estatísticas</button>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <Panel title="🔥 Sequência">
          <div className="streak-big">{s.streak.current} <small>dia{s.streak.current === 1 ? '' : 's'}</small></div>
          <div className="streak-days">
            {Array.from({ length: 7 }, (_, i) => {
              const filled = i < (s.streak.current % 7 || (s.streak.current ? 7 : 0));
              return <span key={i} className={filled ? 'on' : ''}>{i + 1}</span>;
            })}
          </div>
          <p className="muted small">
            Bônus atual: +{Math.round(streakBonus(s.streak.current) * 100)}% XP · Escudos: {'🛡️'.repeat(s.streak.shields) || '—'}
            {nextMilestone && <><br />Próximo marco: {nextMilestone.days} dias (+{fmt(nextMilestone.gold)} ouro)</>}
          </p>
          {s.streak.lastDay !== s.today.day && (
            <p className="hint-box">Responda {Math.max(0, STREAK_MIN_CARDS - s.today.answered)} cards hoje para manter a sequência.</p>
          )}
        </Panel>

        <Panel title="📅 Hoje">
          <div className="today-goal">
            <div className="today-num">{s.today.answered} <small>/ {s.settings.dailyGoal} cards</small></div>
            <Bar kind="plain" value={goalPct} max={1} />
          </div>
          <div className="stat-row">
            <Stat label="XP hoje" value={fmt(s.today.xp)} />
            <Stat label="Abates" value={s.today.kills} />
            <Stat label="Acertos" value={`${accToday}%`} />
            <Stat label="Combo máx." value={s.stats.maxCombo} />
            <Stat label="Ouro" value={<span className="gold-text">{fmt(p.gold)}</span>} />
          </div>
        </Panel>

        <Panel title="📜 Missões diárias" right={<button className="link" onClick={() => go('quests')}>ver todas</button>}>
          <ul className="quest-mini">
            {s.quests.daily.map(q => (
              <li key={q.id} className={q.claimed ? 'claimed' : q.progress >= q.target ? 'ready' : ''}>
                <div className="qm-top"><span>{q.title}</span><b>{Math.min(q.progress, q.target)}/{q.target}</b></div>
                <Bar kind="plain" value={q.progress} max={q.target} />
                <small className="muted">{q.claimed ? '✔ Resgatada' : describeReward(q.reward)}</small>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="🎯 Objetivos">
          <ul className="goals">
            <li><span>Curto prazo</span>Faltam <b>{fmt(lp.needed - lp.current)} XP</b> para o nível {p.level + 1}</li>
            <li>
              <span>Médio prazo</span>
              {rp.kills >= region.killsForBoss
                ? <>O boss <b>{region.boss.name}</b> está esperando!</>
                : <>Derrote <b>{region.killsForBoss - rp.kills}</b> inimigo(s) em {region.name} para enfrentar o boss</>}
            </li>
            <li>
              <span>Longo prazo</span>
              {nextRegion
                ? <>Desbloquear <b>{nextRegion.name}</b> (nível {nextRegion.level} + boss anterior)</>
                : <>Todas as regiões liberadas. Rumo à lenda!</>}
            </li>
          </ul>
          <div className="queue-line">
            <span className="c-new">{counts.fresh} novos</span>
            <span className="c-learn">{counts.learning} aprendendo</span>
            <span className="c-due">{counts.review} revisões</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
