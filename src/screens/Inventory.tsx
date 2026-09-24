import { useState } from 'react';
import type { Rarity, Slot } from '../types';
import { useGame } from '../state/store';
import { ItemCard, ItemIcon, Panel } from '../components/ui';
import { RARITIES, SHOP, SLOTS } from '../data/content';
import { buy, equip, FORGE_COST, forge, isEquipped, openChest, rest, sell, unequip } from '../engine/game';
import { itemPower } from '../engine/loot';
import { chestName } from '../engine/quests';
import { fmt } from '../engine/util';

type Filter = 'all' | Slot;

export function Inventory() {
  const { s, run } = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const selected = s.items.find(i => i.id === sel) ?? null;
  const equippedInSlot = selected ? s.items.find(i => i.id === s.equipment[selected.slot]) ?? null : null;
  const bag = s.items
    .filter(i => !isEquipped(s, i.id))
    .filter(i => filter === 'all' || i.slot === filter)
    .sort((a, b) => RARITIES.findIndex(r => r.id === b.rarity) - RARITIES.findIndex(r => r.id === a.rarity) || b.level - a.level);
  const commons = s.items.filter(i => !isEquipped(s, i.id) && i.rarity === 'comum');
  const chests = (Object.entries(s.consumables.chests) as [Rarity, number][]).filter(([, n]) => n > 0);

  return (
    <div className="inv-screen">
      <Panel title="Equipado" className="inv-equip">
        <div className="paperdoll">
          {SLOTS.map(sl => {
            const it = s.items.find(i => i.id === s.equipment[sl.id]);
            return (
              <div key={sl.id} className={`pd-slot slot-${sl.id}`}>
                {it ? <ItemIcon item={it} size="lg" selected={sel === it.id} onClick={() => setSel(it.id)} equipped /> : <div className="empty-slot lg">{sl.icon}</div>}
                <small>{sl.name}</small>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title={`Inventário (${bag.length})`} className="inv-bag"
        right={commons.length > 0 && <button className="btn btn-sm" onClick={() => confirm(`Vender ${commons.length} itens comuns?`) && run(x => sell(x, commons.map(c => c.id)))}>Vender comuns</button>}>
        <div className="filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button>
          {SLOTS.map(sl => <button key={sl.id} className={filter === sl.id ? 'active' : ''} onClick={() => setFilter(sl.id)} title={sl.name}>{sl.icon}</button>)}
        </div>
        <div className="bag-grid">
          {bag.map(it => {
            const eq = s.items.find(i => i.id === s.equipment[it.slot]);
            const better = itemPower(it) > itemPower(eq);
            return (
              <div key={it.id} className="bag-cell">
                <ItemIcon item={it} selected={sel === it.id} onClick={() => setSel(it.id)} />
                {better && <i className="better" title="Melhor que o equipado">▲</i>}
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, 24 - bag.length) }, (_, i) => <div key={`e${i}`} className="bag-cell empty" />)}
        </div>
      </Panel>

      <div className="inv-detail">
        {selected ? (
          <>
            <ItemCard item={selected} s={s} compare={isEquipped(s, selected.id) ? undefined : equippedInSlot}
              actions={isEquipped(s, selected.id) ? (
                <button className="btn" onClick={() => run(x => unequip(x, selected.slot))}>Desequipar</button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => run(x => equip(x, selected.id))}>Equipar</button>
                  <button className="btn" onClick={() => { run(x => sell(x, [selected.id])); setSel(null); }}>Vender ({fmt(selected.value)}🪙)</button>
                </>
              )} />
            {equippedInSlot && !isEquipped(s, selected.id) && (
              <div className="compare">
                <div className="muted small">Equipado atualmente:</div>
                <ItemCard item={equippedInSlot} s={s} />
              </div>
            )}
          </>
        ) : (
          <Panel title="Detalhes"><p className="muted">Selecione um item para ver detalhes, comparar e equipar.</p></Panel>
        )}

        <Panel title="Consumíveis e baús">
          <ul className="kv">
            <li><span>🧪 Poção de Vida</span><b>×{s.consumables.hpPotion}</b></li>
            <li><span>🔷 Poção de Mana</span><b>×{s.consumables.manaPotion}</b></li>
            <li><span>💠 Fragmentos</span><b>{s.consumables.fragments}</b></li>
          </ul>
          <button className="btn btn-sm full" disabled={s.consumables.fragments < FORGE_COST} onClick={() => run(forge)}>
            ⚒️ Forjar item ({FORGE_COST} fragmentos)
          </button>
          <div className="chests">
            {chests.length === 0 && <p className="muted small">Sem baús. Complete missões e derrote bosses para obtê-los.</p>}
            {chests.map(([r, n]) => (
              <button key={r} className={`btn chest r-${r}`} onClick={() => run(x => openChest(x, r))}>🎁 Abrir Baú {chestName(r)} ×{n}</button>
            ))}
          </div>
        </Panel>

        <Panel title="Mercador">
          <div className="shop">
            <button className="btn btn-sm" onClick={() => run(x => buy(x, 'hpPotion'))}>🧪 Poção de Vida — {SHOP.hpPotion}🪙</button>
            <button className="btn btn-sm" onClick={() => run(x => buy(x, 'manaPotion'))}>🔷 Poção de Mana — {SHOP.manaPotion}🪙</button>
            <button className="btn btn-sm" onClick={() => run(x => buy(x, 'chestComum'))}>🎁 Baú Comum — {SHOP.chestComum}🪙</button>
            <button className="btn btn-sm" onClick={() => run(rest)}>🛏️ Descansar na estalagem — {10 * s.player.level}🪙</button>
          </div>
          <p className="muted small">Todo o ouro vem do estudo. O mercador só vende suprimentos — equipamentos bons vêm de batalhas.</p>
        </Panel>
      </div>
    </div>
  );
}
