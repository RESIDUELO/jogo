import { useGame } from '../state/store';
import { Panel } from '../components/ui';
import { REGIONS } from '../data/world';
import { canFightBoss, startBattle } from '../engine/game';

export function WorldMap() {
  const { s, run, go } = useGame();
  const enter = (id: string, boss = false) => {
    run(x => startBattle(x, id, x.battle?.deckId ?? null, boss));
    go('battle');
  };
  return (
    <div className="map-screen">
      <Panel title="🗺️ Mapa do Mundo">
        <p className="muted">Derrote inimigos para invocar o boss de cada região. Vencer o boss (e ter o nível recomendado) abre o caminho para a próxima.</p>
        <div className="world">
          {REGIONS.map((r, i) => {
            const rp = s.regions[r.id];
            const prevBoss = i === 0 || s.regions[REGIONS[i - 1].id].bossDefeated > 0;
            const here = s.currentRegion === r.id;
            return (
              <div key={r.id} className={`region${rp.unlocked ? '' : ' locked'}${here ? ' here' : ''}`}>
                {i > 0 && <div className={`path${rp.unlocked ? ' open' : ''}`} />}
                <div className="region-node">
                  <div className="region-icon">{rp.unlocked ? r.icon : '🔒'}</div>
                  <div className="region-info">
                    <h3 className="cinzel">{r.name} {here && <span className="tag">Você está aqui</span>}</h3>
                    <div className="muted small">Nível recomendado {r.level} · {r.description}</div>
                    {rp.unlocked ? (
                      <>
                        <div className="region-enemies">
                          {r.enemies.map(e => <span key={e.id} title={e.name}>{e.icon} {e.name}</span>)}
                          <span className="boss-chip">☠️ {r.boss.name}{rp.bossDefeated ? ` ✔×${rp.bossDefeated}` : ''}</span>
                        </div>
                        <div className="region-progress">
                          Boss: {Math.min(rp.kills, r.killsForBoss)}/{r.killsForBoss} abates · {rp.totalKills} inimigos derrotados
                        </div>
                        <div className="row">
                          <button className="btn btn-sm btn-primary" onClick={() => enter(r.id)}>Explorar</button>
                          {canFightBoss(s, r.id) && <button className="btn btn-sm btn-boss" onClick={() => enter(r.id, true)}>Desafiar boss</button>}
                        </div>
                      </>
                    ) : (
                      <div className="unlock-req">
                        Requer: <span className={prevBoss ? 'good' : 'bad'}>derrotar {REGIONS[i - 1].boss.name}</span> ·{' '}
                        <span className={s.player.level >= r.level ? 'good' : 'bad'}>nível {r.level}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
