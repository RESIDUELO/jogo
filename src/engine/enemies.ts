import type { Enemy } from '../types';
import { REGION_BY_ID } from '../data/world';
import { normalize, pick, randInt } from './util';

/** Dano "médio" de um acerto no nível L (sem equipamento) — base para o HP dos inimigos. */
export const baseDamage = (level: number) => 12 + level * 3;

/** Cria um inimigo comum ou o boss da região. */
export function spawnEnemy(regionId: string, playerLevel: number, boss: boolean): Enemy {
  const region = REGION_BY_ID[regionId];
  // inimigos acompanham o jogador, mas nunca ficam abaixo do nível da região
  const level = Math.max(region.level, Math.min(playerLevel, region.level + 6)) + (boss ? 2 : randInt(0, 2));
  const expectedHit = baseDamage(level) + level * 1.5;
  if (boss) {
    const b = region.boss;
    const hp = Math.round(expectedHit * (14 + b.phases.length * 2));
    return {
      defId: b.id, name: b.name, icon: b.icon, level, maxHp: hp, hp,
      atk: Math.round((12 + level * 6) * 1.5), isBoss: true, phase: 0, phases: b.phases,
      weakness: b.weakness, dropBonus: 0, taunt: b.taunts[0],
    };
  }
  const def = pick(region.enemies);
  const hp = Math.round(expectedHit * randInt(3, 5));
  return {
    defId: def.id, name: def.name, icon: def.icon, level, maxHp: hp, hp,
    atk: 12 + level * 6, isBoss: false, phase: 0, phases: [], weakness: def.weakness, dropBonus: 0,
  };
}

/** Verifica se o card atinge a fraqueza temática do inimigo (deck ou tags). */
export function hitsWeakness(enemy: Enemy, deckName: string, tags: string[]): boolean {
  if (!enemy.weakness.length) return false;
  const keys = [normalize(deckName), ...tags.map(normalize)];
  return enemy.weakness.some(w => keys.includes(w));
}

/** Fase atual do boss a partir do HP restante. */
export function bossPhaseFor(enemy: Enemy): number {
  if (!enemy.isBoss) return 0;
  const n = enemy.phases.length;
  const lost = 1 - enemy.hp / enemy.maxHp;
  return Math.min(n - 1, Math.floor(lost * n));
}
