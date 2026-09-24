import { useGame, type Screen } from '../state/store';
import { CLASS_BY_ID, TITLE_BY_ID } from '../data/content';
import { derived, levelProgress } from '../engine/progression';
import { fmt } from '../engine/util';
import { Bar } from './ui';

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Início', icon: '🏠' },
  { id: 'battle', label: 'Batalha', icon: '⚔️' },
  { id: 'decks', label: 'Decks', icon: '📚' },
  { id: 'map', label: 'Mapa', icon: '🗺️' },
  { id: 'character', label: 'Personagem', icon: '🧙' },
  { id: 'inventory', label: 'Inventário', icon: '🎒' },
  { id: 'quests', label: 'Missões', icon: '📜' },
  { id: 'stats', label: 'Estatísticas', icon: '📊' },
  { id: 'achievements', label: 'Conquistas', icon: '🏆' },
  { id: 'settings', label: 'Opções', icon: '⚙️' },
];

export function Hud() {
  const { s, screen, go } = useGame();
  const p = s.player;
  const d = derived(s);
  const lp = levelProgress(p.xp);
  const cls = CLASS_BY_ID[p.classId];
  const claimable = [...s.quests.daily, ...s.quests.weekly].filter(q => !q.claimed && q.progress >= q.target).length;

  return (
    <header className="hud">
      <div className="hud-main">
        <button className="hud-portrait" onClick={() => go('character')} title="Personagem">
          <span>{cls.icon}</span>
          <b>{p.level}</b>
        </button>
        <div className="hud-id">
          <div className="hud-name">
            {p.name}
            {p.titleId && <span className="hud-title">«{TITLE_BY_ID[p.titleId]?.name}»</span>}
          </div>
          <div className="hud-bars">
            <Bar kind="hp" value={p.hp} max={d.maxHp} label={`${fmt(p.hp)} / ${fmt(d.maxHp)}`} />
            <Bar kind="mana" value={p.mana} max={d.maxMana} label={`${fmt(p.mana)} / ${fmt(d.maxMana)}`} />
          </div>
        </div>
        <div className="hud-xp">
          <div className="hud-xp-top"><b>NÍVEL {p.level}</b><span>{fmt(lp.current)} / {fmt(lp.needed)} XP</span></div>
          <Bar kind="xp" value={lp.current} max={lp.needed} />
        </div>
        <div className="hud-res">
          <span title="Ouro" className="gold-text">🪙 {fmt(p.gold)}</span>
          <span title="Sequência de dias" className="streak-text">🔥 {s.streak.current}</span>
          {p.combo >= 3 && <span className="combo-mini">x{p.combo}</span>}
        </div>
      </div>
      <nav className="hud-nav">
        {NAV.map(n => (
          <button key={n.id} className={screen === n.id ? 'active' : ''} onClick={() => go(n.id)}>
            <span>{n.icon}</span><em>{n.label}</em>
            {n.id === 'quests' && claimable > 0 && <i className="badge-dot">{claimable}</i>}
            {n.id === 'character' && p.freePoints > 0 && <i className="badge-dot">+</i>}
          </button>
        ))}
      </nav>
    </header>
  );
}
