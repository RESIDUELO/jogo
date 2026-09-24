import type { Quest } from '../types';
import { useGame } from '../state/store';
import { Bar, Panel } from '../components/ui';
import { claimQuest } from '../engine/game';
import { describeReward } from '../engine/quests';

export function Quests() {
  const { s } = useGame();
  const hoursLeft = Math.ceil((new Date().setHours(24, 0, 0, 0) - Date.now()) / 3_600_000);
  return (
    <div className="quests-screen">
      <Panel title="📜 Missões diárias" right={<span className="muted small">renovam em {hoursLeft}h</span>}>
        <QuestList quests={s.quests.daily} />
      </Panel>
      <Panel title="🗓️ Missões semanais" right={<span className="muted small">renovam na segunda-feira</span>}>
        <QuestList quests={s.quests.weekly} />
      </Panel>
    </div>
  );
}

function QuestList({ quests }: { quests: Quest[] }) {
  const { run } = useGame();
  return (
    <ul className="quest-list">
      {quests.map(q => {
        const done = q.progress >= q.target;
        return (
          <li key={q.id} className={`quest${q.claimed ? ' claimed' : done ? ' ready' : ''}`}>
            <div className="quest-body">
              <b>{q.title}</b>
              <Bar kind="plain" value={q.progress} max={q.target} label={`${Math.min(q.progress, q.target)} / ${q.target}`} />
              <small className="muted">Recompensa: {describeReward(q.reward)}</small>
            </div>
            <button className="btn btn-primary" disabled={!done || q.claimed} onClick={() => run(x => claimQuest(x, q.id))}>
              {q.claimed ? '✔' : done ? 'Resgatar' : 'Em andamento'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
