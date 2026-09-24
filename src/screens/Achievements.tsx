import { useGame } from '../state/store';
import { Panel } from '../components/ui';
import { ACHIEVEMENTS } from '../engine/achievements';
import { TITLES } from '../data/content';
import { setTitle } from '../engine/game';

export function Achievements() {
  const { s, run } = useGame();
  const got = ACHIEVEMENTS.filter(a => s.achievements.includes(a.id)).length;
  return (
    <div className="ach-screen">
      <Panel title={`🏆 Conquistas (${got}/${ACHIEVEMENTS.length})`}>
        <div className="ach-grid">
          {ACHIEVEMENTS.map(a => {
            const ok = s.achievements.includes(a.id);
            return (
              <div key={a.id} className={`ach${ok ? ' got' : ''}`}>
                <span className="ach-icon">{ok ? a.icon : '🔒'}</span>
                <div><b>{a.name}</b><small>{a.desc}</small></div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="🏷️ Títulos">
        <div className="titles">
          {TITLES.map(t => {
            const ok = s.titles.includes(t.id);
            const active = s.player.titleId === t.id;
            return (
              <button key={t.id} disabled={!ok} className={`title-chip${active ? ' active' : ''}`} onClick={() => run(x => setTitle(x, active ? null : t.id))}>
                <b>{ok ? t.name : '???'}</b>
                <small>{t.how}</small>
              </button>
            );
          })}
        </div>
        <p className="muted small">Clique em um título desbloqueado para exibi-lo ao lado do seu nome.</p>
      </Panel>
    </div>
  );
}
