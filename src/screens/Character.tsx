import { useGame } from '../state/store';
import { Bar, ItemIcon, Panel } from '../components/ui';
import { ATTRS, CLASSES, CLASS_BY_ID, SLOTS, TITLES } from '../data/content';
import { allocate, changeClass, CLASS_CHANGE_COST, setTitle } from '../engine/game';
import { derived, levelProgress } from '../engine/progression';
import { fmt } from '../engine/util';

export function Character() {
  const { s, run, go } = useGame();
  const p = s.player;
  const d = derived(s);
  const lp = levelProgress(p.xp);
  const cls = CLASS_BY_ID[p.classId];

  return (
    <div className="char-screen">
      <Panel title="Personagem" className="char-sheet">
        <div className="char-head">
          <div className="char-avatar">{cls.icon}</div>
          <div>
            <h2 className="cinzel">{p.name}</h2>
            <div className="muted">{cls.name} · Nível {p.level}</div>
            <select className="title-select" value={p.titleId ?? ''} onChange={e => run(x => setTitle(x, e.target.value || null))}>
              <option value="">Sem título</option>
              {TITLES.filter(t => s.titles.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <ul className="kv">
          <li><span>XP</span><b>{fmt(lp.current)} / {fmt(lp.needed)}</b></li>
          <li><span>HP</span><b>{fmt(p.hp)} / {fmt(d.maxHp)}</b></li>
          <li><span>Mana</span><b>{fmt(p.mana)} / {fmt(d.maxMana)}</b></li>
          <li><span>Ataque (arma)</span><b>{d.atk}</b></li>
          <li><span>Defesa</span><b>{d.def} <small className="muted">(−{Math.round(100 - 10000 / (100 + d.def))}% dano)</small></b></li>
          <li><span>Chance de crítico</span><b>{(d.critChance * 100).toFixed(1)}%</b></li>
          <li><span>Multiplicador de XP</span><b>×{d.xpMult.toFixed(2)}</b></li>
        </ul>
        <Bar kind="xp" value={lp.current} max={lp.needed} />
      </Panel>

      <Panel title="Atributos" right={p.freePoints > 0 && <span className="points">{p.freePoints} ponto(s) livre(s)</span>}>
        <ul className="attrs">
          {ATTRS.map(a => (
            <li key={a.key}>
              <div className="attr-name"><b>{a.key}</b><span>{a.name}</span></div>
              <div className="attr-val">
                {d.attrs[a.key]}
                {d.attrs[a.key] !== p.baseAttrs[a.key] && <small className="up"> (+{d.attrs[a.key] - p.baseAttrs[a.key]})</small>}
              </div>
              <small className="muted attr-eff">{a.effect}</small>
              <button className="btn btn-sm" disabled={p.freePoints <= 0} onClick={() => run(x => allocate(x, a.key))}>+</button>
            </li>
          ))}
        </ul>
        <p className="muted small">Você ganha 3 pontos por nível. Os atributos amplificam recompensas — o conhecimento real vem dos cards.</p>
      </Panel>

      <Panel title="Equipamento" right={<button className="link" onClick={() => go('inventory')}>abrir inventário</button>}>
        <div className="paperdoll mini">
          {SLOTS.map(sl => {
            const it = s.items.find(i => i.id === s.equipment[sl.id]);
            return (
              <div key={sl.id} className="pd-slot">
                {it ? <ItemIcon item={it} onClick={() => go('inventory')} /> : <div className="empty-slot">{sl.icon}</div>}
                <small>{it ? it.name : sl.name}</small>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Classe">
        <div className="class-list">
          {CLASSES.map(c => {
            const current = c.id === p.classId;
            const locked = p.level < c.unlockLevel;
            return (
              <div key={c.id} className={`class-row${current ? ' current' : ''}`}>
                <span className="class-icon">{locked ? '🔒' : c.icon}</span>
                <div>
                  <b>{c.name}</b>
                  <small className="muted">{c.perks.join(' · ')}</small>
                </div>
                {current ? <span className="tag">Atual</span> : (
                  <button className="btn btn-sm" disabled={locked || p.gold < CLASS_CHANGE_COST}
                    onClick={() => confirm(`Mudar para ${c.name} por ${CLASS_CHANGE_COST} ouro?`) && run(x => changeClass(x, c.id))}>
                    {locked ? `Nível ${c.unlockLevel}` : `Trocar (${CLASS_CHANGE_COST}🪙)`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
