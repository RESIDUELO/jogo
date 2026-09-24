// Motor do jogo: funções puras que recebem o save e devolvem um novo save + eventos.
// Nenhuma dependência de React — facilita testes e mover lógica para um servidor no futuro.
import type {
  AttrKey, BattleState, Card, ClassId, GameEvent, Grade, Item, Quest, QuestKind, Rarity, Reward, SaveData, Slot,
} from '../types';
import { CLASS_BY_ID, SHOP, SKILLS, STREAK_MILESTONES } from '../data/content';
import { DEMO_CARDS } from '../data/demoCards';
import { REGIONS, REGION_BY_ID } from '../data/world';
import { ACHIEVEMENTS, LEVEL_TITLES } from './achievements';
import { baseDamage, bossPhaseFor, hitsWeakness, spawnEnemy } from './enemies';
import { generateItem, requiredLevel, rollRarity } from './loot';
import { comboTier, derived, levelFromXp, POINTS_PER_LEVEL, streakBonus } from './progression';
import { generateDaily, generateWeekly } from './quests';
import { newCardFields, schedule, shouldMarkHard } from './srs';
import { addDays, clamp, dayKey, daysBetween, rand, randInt, uid, weekKey } from './util';

export const SAVE_VERSION = 1;
export const STREAK_MIN_CARDS = 10; // cards no dia para contar a sequência
const SESSION_BONUS_MIN = 10;
const LOG_LIMIT = 30000;

export interface Result { s: SaveData; events: GameEvent[] }

class Ctx {
  events: GameEvent[] = [];
  constructor(public s: SaveData) {}
  emit(e: GameEvent) { this.events.push(e); }
  done(): Result { return { s: this.s, events: this.events }; }
}

const draft = (s: SaveData) => new Ctx(structuredClone(s));

/* =====================================================================
 * Criação
 * ===================================================================== */
export function newGame(name: string, classId: ClassId): SaveData {
  const now = Date.now();
  const decks = new Map<string, string>();
  const cards: Card[] = DEMO_CARDS.map(([deckName, front, back, tags], i) => {
    if (!decks.has(deckName)) decks.set(deckName, uid());
    return { id: uid(), deckId: decks.get(deckName)!, front, back, tags, createdAt: now + i, ...newCardFields() };
  });
  const cls = CLASS_BY_ID[classId];
  const s: SaveData = {
    version: SAVE_VERSION,
    player: {
      name: name.trim() || 'Aventureiro', classId, level: 1, xp: 0, gold: 50, hp: 1, mana: 1,
      baseAttrs: { ...cls.base }, freePoints: 0, titleId: null, combo: 0, createdAt: now,
    },
    equipment: { capacete: null, armadura: null, luvas: null, calcas: null, botas: null, anel: null, amuleto: null, arma: null },
    items: [],
    consumables: { hpPotion: 3, manaPotion: 1, fragments: 0, chests: { comum: 1 } },
    decks: [...decks].map(([n, id]) => ({ id, name: n, createdAt: now })),
    cards,
    log: [],
    regions: Object.fromEntries(REGIONS.map((r, i) => [r.id, { unlocked: i === 0, kills: 0, totalKills: 0, bossDefeated: 0 }])),
    currentRegion: REGIONS[0].id,
    battle: null,
    stats: { enemiesDefeated: 0, bossesDefeated: 0, maxCombo: 0, totalXp: 0, totalGold: 0, studyMs: 0, sessions: 0, hardConquered: 0, itemsLooted: 0 },
    streak: { current: 0, best: 0, lastDay: null, shields: 0 },
    quests: { day: dayKey(now), daily: generateDaily(1), week: weekKey(now), weekly: generateWeekly(1) },
    achievements: [],
    titles: [],
    today: { day: dayKey(now), answered: 0, correct: 0, xp: 0, kills: 0, newByDeck: {}, healed: true },
    settings: { newPerDay: 20, dailyGoal: 50, weaknesses: true, sound: true },
  };
  // equipamento inicial
  const weapon = generateItem(1, 'comum', 'arma');
  weapon.name = 'Bisturi Enferrujado';
  const coat = generateItem(1, 'comum', 'armadura');
  coat.name = 'Jaleco de Calouro';
  s.items.push(weapon, coat);
  s.equipment.arma = weapon.id;
  s.equipment.armadura = coat.id;
  const d = derived(s);
  s.player.hp = d.maxHp;
  s.player.mana = d.maxMana;
  return s;
}

/* =====================================================================
 * Virada de dia: sequência, cura diária, quests
 * ===================================================================== */
export function rollover(prev: SaveData): Result {
  const today = dayKey();
  const week = weekKey();
  if (prev.today.day === today && prev.quests.day === today && prev.quests.week === week) return { s: prev, events: [] };
  const c = draft(prev);
  const s = c.s;

  if (s.today.day !== today) {
    // sequência: perder um único dia consome um Escudo, sem punição
    if (s.streak.lastDay) {
      const gap = daysBetween(new Date(s.streak.lastDay + 'T12:00').getTime(), Date.now());
      if (gap >= 2) {
        if (gap === 2 && s.streak.shields > 0) {
          s.streak.shields--;
          s.streak.lastDay = dayKey(addDays(Date.now(), -1));
          c.emit({ type: 'info', text: '🛡️ Um Escudo de Sequência protegeu seus dias seguidos!' });
        } else if (s.streak.current > 0) {
          c.emit({ type: 'info', text: `Sua sequência de ${s.streak.current} dias terminou. Recomece hoje — seu recorde fica salvo!` });
          s.streak.current = 0;
        }
      }
    }
    s.today = { day: today, answered: 0, correct: 0, xp: 0, kills: 0, newByDeck: {}, healed: true };
    const d = derived(s);
    s.player.hp = d.maxHp;
    s.player.mana = d.maxMana;
    s.player.combo = 0;
  }
  if (s.quests.day !== today) {
    s.quests.day = today;
    s.quests.daily = generateDaily(s.player.level);
    c.emit({ type: 'quest', title: 'Novas missões diárias disponíveis!' });
  }
  if (s.quests.week !== week) {
    s.quests.week = week;
    s.quests.weekly = generateWeekly(s.player.level);
  }
  return c.done();
}

/* =====================================================================
 * Fila de cards
 * ===================================================================== */
function inScope(s: SaveData, deckId: string | null) {
  return deckId ? s.cards.filter(c => c.deckId === deckId) : s.cards;
}

export function newRemaining(s: SaveData, deckId: string): number {
  return Math.max(0, s.settings.newPerDay - (s.today.newByDeck[deckId] ?? 0));
}

export function queueCounts(s: SaveData, deckId: string | null, now = Date.now()) {
  const cards = inScope(s, deckId);
  const learning = cards.filter(c => c.state === 'learning').length;
  const review = cards.filter(c => c.state === 'review' && c.due <= now).length;
  const deckIds = deckId ? [deckId] : s.decks.map(d => d.id);
  let fresh = 0;
  for (const id of deckIds) {
    const n = cards.filter(c => c.deckId === id && c.state === 'new').length;
    fresh += Math.min(n, newRemaining(s, id));
  }
  return { learning, review, fresh, total: learning + review + fresh };
}

function pickNext(s: SaveData, b: BattleState, now = Date.now()): Card | null {
  const cards = inScope(s, b.deckId);
  const last = b.cardId;
  const notLast = (c: Card) => c.id !== last;

  const learningNow = cards.filter(c => c.state === 'learning' && c.due <= now).sort((a, z) => a.due - z.due);
  const reviews = cards.filter(c => c.state === 'review' && c.due <= now).sort((a, z) => a.due - z.due);
  const news = cards
    .filter(c => c.state === 'new' && newRemaining(s, c.deckId) > 0)
    .sort((a, z) => a.createdAt - z.createdAt);

  const first = (arr: Card[]) => arr.find(notLast) ?? null;
  const ln = first(learningNow);
  if (ln) return ln;
  if (reviews.length && news.length) {
    return b.session.answered % 4 === 3 ? first(news) ?? first(reviews) : first(reviews) ?? first(news);
  }
  const rv = first(reviews) ?? first(news);
  if (rv) return rv;
  // só restam cards aprendendo para daqui a pouco: adianta o próximo
  const later = cards.filter(c => c.state === 'learning').sort((a, z) => a.due - z.due);
  if (later.length) return first(later) ?? later[0];
  if (learningNow.length) return learningNow[0];

  if (b.practice && cards.length) {
    // treino livre: prioriza cards difíceis e de menor facilidade
    const pool = cards.filter(notLast);
    if (!pool.length) return cards[0];
    const weighted = pool.map(c => ({ c, w: (c.hard ? 4 : 1) * (3 - Math.min(2.9, c.ease - 0.5)) + Math.random() }));
    weighted.sort((a, z) => z.w - a.w);
    return weighted[randInt(0, Math.min(4, weighted.length - 1))].c;
  }
  return null;
}

/* =====================================================================
 * Batalha
 * ===================================================================== */
export function canFightBoss(s: SaveData, regionId: string) {
  return s.regions[regionId].kills >= REGION_BY_ID[regionId].killsForBoss;
}

export function startBattle(prev: SaveData, regionId: string, deckId: string | null, boss = false): Result {
  const c = draft(prev);
  const s = c.s;
  if (!s.regions[regionId]?.unlocked) return { s: prev, events: [{ type: 'info', text: 'Região bloqueada.' }] };
  if (boss && !canFightBoss(s, regionId)) boss = false;
  const counts = queueCounts(s, deckId);
  s.currentRegion = regionId;
  s.battle = {
    regionId, deckId,
    enemy: spawnEnemy(regionId, s.player.level, boss),
    practice: counts.total === 0,
    focus: false, ward: false,
    cardId: null,
    session: { startedAt: Date.now(), answered: 0, correct: 0, xp: 0, gold: 0, kills: 0, loot: [], maxCombo: 0 },
  };
  s.battle.cardId = pickNext(s, s.battle)?.id ?? null;
  if (s.battle.practice) c.emit({ type: 'info', text: 'Nenhum card pendente — modo Treino Livre (recompensas reduzidas).' });
  if (boss && s.battle.enemy.taunt) c.emit({ type: 'phase', name: s.battle.enemy.phases[0], taunt: s.battle.enemy.taunt });
  return c.done();
}

export function enterPractice(prev: SaveData): Result {
  if (!prev.battle) return { s: prev, events: [] };
  const c = draft(prev);
  c.s.battle!.practice = true;
  c.s.battle!.cardId = pickNext(c.s, c.s.battle!)?.id ?? null;
  c.emit({ type: 'info', text: 'Treino Livre: 25% de XP e ouro, sem loot. A revisão de verdade vale mais!' });
  return c.done();
}

export function challengeBoss(prev: SaveData): Result {
  const b = prev.battle;
  if (!b || !canFightBoss(prev, b.regionId) || b.enemy.isBoss) return { s: prev, events: [] };
  const c = draft(prev);
  const nb = c.s.battle!;
  nb.enemy = spawnEnemy(nb.regionId, c.s.player.level, true);
  c.emit({ type: 'phase', name: nb.enemy.phases[0], taunt: nb.enemy.taunt ?? '' });
  return c.done();
}

const BASE_XP: Record<Grade, number> = { 1: 1, 2: 5, 3: 8, 4: 11 };
const DMG_MULT: Record<Grade, number> = { 1: 0, 2: 0.6, 3: 1, 4: 1.4 };

export function answer(prev: SaveData, grade: Grade, ms: number): Result {
  const b0 = prev.battle;
  if (!b0 || !b0.cardId) return { s: prev, events: [] };
  const c = draft(prev);
  const s = c.s;
  const b = s.battle!;
  const card = s.cards.find(x => x.id === b.cardId);
  if (!card) { b.cardId = pickNext(s, b)?.id ?? null; return c.done(); }

  const now = Date.now();
  const p = s.player;
  const cls = CLASS_BY_ID[p.classId];
  const d = derived(s);
  const enemy = b.enemy;
  const correct = grade >= 2;
  const practice = b.practice && card.state === 'review' && card.due > now;
  const rewardMult = practice ? 0.25 : 1;
  const wasHard = card.hard;
  const reviewDue = card.state === 'review' && card.due <= now;
  const deckName = s.decks.find(x => x.id === card.deckId)?.name ?? '';

  // --- Agendamento e estatísticas do card ---
  if (card.state === 'new') s.today.newByDeck[card.deckId] = (s.today.newByDeck[card.deckId] ?? 0) + 1;
  if (!practice) Object.assign(card, schedule(card, grade, now));
  card.lastReviewed = now;
  if (correct) { card.correct++; card.streak++; } else { card.wrong++; card.streak = 0; }

  // --- Combo ---
  if (correct) {
    p.combo++;
  } else if (b.ward) {
    b.ward = false;
    c.emit({ type: 'info', text: '🔰 Segunda Chance! Seu combo foi preservado.' });
  } else {
    p.combo = 0;
  }
  s.stats.maxCombo = Math.max(s.stats.maxCombo, p.combo);
  b.session.maxCombo = Math.max(b.session.maxCombo, p.combo);
  const tier = comboTier(p.combo);
  const comboBonus = tier ? tier.bonus * (1 + d.attrs.SAB * 0.02) * cls.comboMult : 0;

  // --- Crítico ---
  let crit = false;
  let perfect = false;
  if (correct) {
    const chance = d.critChance + Math.min(p.combo, 20) * 0.005;
    const roll = Math.random() < chance;
    if (grade === 4) { crit = true; perfect = roll || b.focus; }
    else if (grade === 3) crit = roll || b.focus;
    else crit = b.focus || Math.random() < chance / 2;
    b.focus = false;
  }

  // --- XP ---
  let xpMult = d.xpMult * (1 + comboBonus) * (1 + streakBonus(s.streak.current));
  if (grade === 4) xpMult *= 1 + d.attrs.CON * 0.02;
  if (wasHard && correct) xpMult *= 1.3 * cls.hardCardMult;
  if (perfect) xpMult *= 2; else if (crit) xpMult *= 1.5;
  const xp = Math.max(correct ? 1 : 0, Math.round(BASE_XP[grade] * (1 + p.level * 0.05) * xpMult * rewardMult));

  // --- Ouro ---
  let gold = 0;
  if (correct) {
    gold = rand(1, 3) + p.level / 5;
    if (grade === 4) gold *= 1 + d.attrs.CON * 0.02;
    gold = Math.round(gold * rewardMult);
  }

  // --- Dano no inimigo ---
  if (correct) {
    const weak = s.settings.weaknesses && hitsWeakness(enemy, deckName, card.tags);
    let dmg = (baseDamage(p.level) + d.atk) * DMG_MULT[grade] * rand(0.9, 1.1);
    if (perfect) dmg *= 3; else if (crit) dmg *= cls.critMult;
    if (weak) dmg *= 1.2;
    dmg = Math.max(1, Math.round(dmg));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    c.emit({ type: 'damage', amount: dmg, crit, perfect, weak });
    if (grade === 4) enemy.dropBonus += 0.05;

    const heal = Math.round(d.maxHp * cls.healOnCorrect);
    if (heal > 0 && p.hp < d.maxHp) { p.hp = Math.min(d.maxHp, p.hp + heal); }
    p.mana = Math.min(d.maxMana, p.mana + 4);

    const newPhase = bossPhaseFor(enemy);
    if (enemy.hp > 0 && newPhase > enemy.phase) {
      enemy.phase = newPhase;
      enemy.atk = Math.round(enemy.atk * 1.25);
      const def = REGION_BY_ID[b.regionId].boss;
      enemy.taunt = def.taunts[newPhase] ?? def.taunts[0];
      c.emit({ type: 'phase', name: enemy.phases[newPhase], taunt: enemy.taunt });
    }
  } else {
    c.emit({ type: 'miss' });
  }

  // --- Dano no jogador ---
  const warded = !correct && b0.ward;
  if (!correct && !warded) {
    // errar um card novo é parte do aprendizado: metade do dano
    const learningMult = prev.cards.find(x => x.id === card.id)!.state === 'new' ? 0.5 : 1;
    const hurt = Math.round(enemy.atk * (100 / (100 + d.def)) * cls.hurtMult * learningMult * rand(0.9, 1.1));
    p.hp -= hurt;
    c.emit({ type: 'hurt', amount: hurt });
  } else if (grade === 2 && enemy.hp > 0) {
    const hurt = Math.round(enemy.atk * 0.2 * (100 / (100 + d.def)) * cls.hurtMult);
    p.hp -= hurt;
    c.emit({ type: 'hurt', amount: hurt });
  }
  p.mana = Math.min(d.maxMana, p.mana + (correct ? 0 : 1));

  if (correct && tier && p.combo >= 3) c.emit({ type: 'combo', value: p.combo, label: tier.label });

  // --- Registro ---
  card.xpEarned += xp;
  s.log.push({ t: now, cardId: card.id, deckId: card.deckId, grade, xp, ms, overdue: reviewDue });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
  s.stats.studyMs += ms;
  s.today.answered++;
  if (correct) s.today.correct++;
  b.session.answered++;
  if (correct) b.session.correct++;
  b.session.xp += xp;
  b.session.gold += gold;
  addGold(c, gold);
  if (xp) c.emit({ type: 'xp', amount: xp });
  if (gold) c.emit({ type: 'gold', amount: gold });

  // --- Quests ---
  bumpQuest(c, 'answer', 1);
  if (correct) bumpQuest(c, 'correct', 1);
  if (reviewDue) bumpQuest(c, 'overdue', 1);
  if (grade === 4) bumpQuest(c, 'mastered', 1);
  if (wasHard && correct) bumpQuest(c, 'hardCards', 1);
  setQuestMax(c, 'combo', p.combo);

  // --- Card difícil ---
  if (!card.hard && shouldMarkHard(card)) {
    card.hard = true;
    c.emit({ type: 'hardCard' });
  } else if (card.hard && card.streak >= 3 && grade >= 3) {
    card.hard = false;
    card.conquered++;
    s.stats.hardConquered++;
    const mult = cls.id === 'medico' ? 2 : 1;
    const bonusXp = Math.round((40 + p.level * 6) * mult);
    s.consumables.fragments += 5 * mult;
    addChest(s, 'raro');
    c.emit({ type: 'conquered', text: `Card difícil superado! +${bonusXp} XP, ${5 * mult} fragmentos e um Baú Raro` });
    gainXp(c, bonusXp);
  }

  gainXp(c, xp);
  countStreak(c);

  // --- Derrota ---
  if (p.hp <= 0) {
    p.hp = Math.round(d.maxHp * 0.5);
    p.combo = 0;
    enemy.hp = enemy.maxHp;
    if (enemy.isBoss) {
      enemy.phase = 0;
      enemy.atk = spawnEnemy(b.regionId, p.level, true).atk;
    }
    c.emit({ type: 'faint' });
  }

  // --- Vitória ---
  if (enemy.hp <= 0) onKill(c, practice);

  checkAchievements(c);
  b.cardId = pickNext(s, b)?.id ?? null;
  return c.done();
}

function onKill(c: Ctx, practice: boolean) {
  const s = c.s;
  const b = s.battle!;
  const e = b.enemy;
  const mult = practice ? 0.25 : 1;
  const big = e.isBoss ? 4 : 1;
  const xp = Math.round((15 + e.level * 4) * big * mult);
  const gold = Math.round((5 + e.level * 2) * big * mult);
  c.emit({ type: 'kill', name: e.name, boss: e.isBoss });
  s.stats.enemiesDefeated++;
  s.today.kills++;
  b.session.kills++;
  const rp = s.regions[b.regionId];
  rp.totalKills++;
  if (e.isBoss) {
    rp.bossDefeated++;
    rp.kills = 0;
    s.stats.bossesDefeated++;
    bumpQuest(c, 'boss', 1);
  } else {
    rp.kills++;
    if (rp.kills === REGION_BY_ID[b.regionId].killsForBoss) c.emit({ type: 'info', text: `⚠️ O boss ${REGION_BY_ID[b.regionId].boss.name} apareceu!` });
  }
  bumpQuest(c, 'kills', 1);
  addGold(c, gold);
  b.session.gold += gold;
  b.session.xp += xp;
  c.emit({ type: 'gold', amount: gold });

  if (!practice) {
    const chance = e.isBoss ? 1 : Math.min(0.8, 0.3 + e.dropBonus);
    if (Math.random() < chance) {
      const rarity = rollRarity(e.isBoss ? 1.5 : 0.2 + e.dropBonus, e.isBoss ? 'raro' : 'comum');
      const item = generateItem(e.level, rarity);
      s.items.push(item);
      s.stats.itemsLooted++;
      b.session.loot.push(item.name);
      c.emit({ type: 'loot', item });
    }
    const frags = e.isBoss ? 5 : randInt(0, 2);
    if (frags) { s.consumables.fragments += frags; c.emit({ type: 'drop', text: `+${frags} fragmento${frags > 1 ? 's' : ''}` }); }
    if (Math.random() < (e.isBoss ? 1 : 0.15)) {
      if (Math.random() < 0.6) s.consumables.hpPotion++; else s.consumables.manaPotion++;
      c.emit({ type: 'drop', text: 'Poção encontrada!' });
    }
    if (e.isBoss) addChest(s, 'epico');
  }
  gainXp(c, xp);
  unlockRegions(c);
  b.enemy = spawnEnemy(b.regionId, s.player.level, false);
}

export function endSession(prev: SaveData): Result {
  const b = prev.battle;
  if (!b) return { s: prev, events: [] };
  const c = draft(prev);
  const s = c.s;
  if (b.session.answered >= SESSION_BONUS_MIN) {
    const xp = Math.round(b.session.xp * 0.1) + 20;
    const gold = Math.round(b.session.gold * 0.1) + 10;
    s.stats.sessions++;
    bumpQuest(c, 'sessions', 1);
    addGold(c, gold);
    c.emit({ type: 'info', text: `Sessão concluída! Bônus: +${xp} XP, +${gold} ouro` });
    gainXp(c, xp);
    checkAchievements(c);
  }
  s.battle = null;
  return c.done();
}

/* =====================================================================
 * Progressão
 * ===================================================================== */
function addGold(c: Ctx, n: number) {
  c.s.player.gold += n;
  c.s.stats.totalGold += n;
}

function addChest(s: SaveData, r: Rarity) {
  s.consumables.chests[r] = (s.consumables.chests[r] ?? 0) + 1;
}

function gainXp(c: Ctx, n: number) {
  if (n <= 0) return;
  const s = c.s;
  const p = s.player;
  p.xp += n;
  s.stats.totalXp += n;
  s.today.xp += n;
  const lvl = levelFromXp(p.xp);
  while (p.level < lvl) {
    p.level++;
    p.freePoints += POINTS_PER_LEVEL;
    const bonus = 25 * p.level;
    addGold(c, bonus);
    if (p.level % 5 === 0) addChest(s, p.level % 10 === 0 ? 'epico' : 'raro');
    c.emit({ type: 'levelup', level: p.level });
    for (const lt of LEVEL_TITLES) if (p.level === lt.level) grantTitle(c, lt.title);
  }
  if (lvl > levelFromXp(p.xp - n)) {
    const d = derived(s);
    p.hp = d.maxHp;
    p.mana = d.maxMana;
    unlockRegions(c);
  }
}

function unlockRegions(c: Ctx) {
  const s = c.s;
  REGIONS.forEach((r, i) => {
    if (i === 0 || s.regions[r.id].unlocked) return;
    const prevDone = s.regions[REGIONS[i - 1].id].bossDefeated > 0;
    if (prevDone && s.player.level >= r.level) {
      s.regions[r.id].unlocked = true;
      c.emit({ type: 'region', name: r.name });
    }
  });
}

function grantTitle(c: Ctx, id: string) {
  if (c.s.titles.includes(id)) return;
  c.s.titles.push(id);
  c.emit({ type: 'info', text: `🏷️ Novo título desbloqueado!` });
}

function countStreak(c: Ctx) {
  const s = c.s;
  const today = dayKey();
  if (s.streak.lastDay === today || s.today.answered < STREAK_MIN_CARDS) return;
  const yesterday = dayKey(addDays(Date.now(), -1));
  s.streak.current = s.streak.lastDay === yesterday ? s.streak.current + 1 : 1;
  s.streak.lastDay = today;
  s.streak.best = Math.max(s.streak.best, s.streak.current);
  if (s.streak.current % 7 === 0) s.streak.shields = Math.min(2, s.streak.shields + 1);
  bumpQuest(c, 'streakDays', 1);
  c.emit({ type: 'streak', days: s.streak.current });
  const m = STREAK_MILESTONES.find(x => x.days === s.streak.current);
  if (m) {
    addGold(c, m.gold);
    c.emit({ type: 'info', text: `🔥 ${m.days} dias seguidos! +${m.gold} ouro` });
    if (m.title) grantTitle(c, m.title);
  }
}

function checkAchievements(c: Ctx) {
  for (const a of ACHIEVEMENTS) {
    if (c.s.achievements.includes(a.id) || !a.test(c.s)) continue;
    c.s.achievements.push(a.id);
    c.emit({ type: 'achievement', name: a.name });
    if (a.title) grantTitle(c, a.title);
  }
}

/* ---------- Quests ---------- */
function allQuests(s: SaveData): Quest[] {
  return [...s.quests.daily, ...s.quests.weekly];
}

function bumpQuest(c: Ctx, kind: QuestKind, n: number) {
  for (const q of allQuests(c.s)) {
    if (q.kind !== kind || q.claimed || q.progress >= q.target) continue;
    q.progress = Math.min(q.target, q.progress + n);
    if (q.progress >= q.target) c.emit({ type: 'quest', title: `Missão concluída: ${q.title}` });
  }
}

function setQuestMax(c: Ctx, kind: QuestKind, v: number) {
  for (const q of allQuests(c.s)) {
    if (q.kind !== kind || q.claimed || q.progress >= q.target || v <= q.progress) continue;
    q.progress = Math.min(q.target, v);
    if (q.progress >= q.target) c.emit({ type: 'quest', title: `Missão concluída: ${q.title}` });
  }
}

export function claimQuest(prev: SaveData, id: string): Result {
  const q = allQuests(prev).find(x => x.id === id);
  if (!q || q.claimed || q.progress < q.target) return { s: prev, events: [] };
  const c = draft(prev);
  const nq = allQuests(c.s).find(x => x.id === id)!;
  nq.claimed = true;
  applyReward(c, nq.reward);
  checkAchievements(c);
  return c.done();
}

function applyReward(c: Ctx, r: Reward) {
  const s = c.s;
  if (r.gold) { addGold(c, r.gold); c.emit({ type: 'gold', amount: r.gold }); }
  if (r.chest) { addChest(s, r.chest); c.emit({ type: 'drop', text: 'Baú recebido! Abra no inventário.' }); }
  if (r.hpPotion) s.consumables.hpPotion += r.hpPotion;
  if (r.manaPotion) s.consumables.manaPotion += r.manaPotion;
  if (r.fragments) s.consumables.fragments += r.fragments;
  if (r.xp) { c.emit({ type: 'xp', amount: r.xp }); gainXp(c, r.xp); }
}

/* =====================================================================
 * Habilidades e consumíveis
 * ===================================================================== */
export function useSkill(prev: SaveData, id: 'foco' | 'cura' | 'protecao'): Result {
  const sk = SKILLS.find(x => x.id === id)!;
  if (prev.player.level < sk.level || prev.player.mana < sk.mana) return { s: prev, events: [] };
  const c = draft(prev);
  const s = c.s;
  s.player.mana -= sk.mana;
  if (id === 'foco' && s.battle) s.battle.focus = true;
  if (id === 'protecao' && s.battle) s.battle.ward = true;
  if (id === 'cura') {
    const d = derived(s);
    const heal = Math.round(d.maxHp * 0.35);
    s.player.hp = Math.min(d.maxHp, s.player.hp + heal);
    c.emit({ type: 'heal', amount: heal });
  }
  c.emit({ type: 'info', text: `${sk.icon} ${sk.name}!` });
  return c.done();
}

export function usePotion(prev: SaveData, kind: 'hp' | 'mana'): Result {
  const key = kind === 'hp' ? 'hpPotion' : 'manaPotion';
  if (prev.consumables[key] <= 0) return { s: prev, events: [] };
  const c = draft(prev);
  const s = c.s;
  const d = derived(s);
  s.consumables[key]--;
  if (kind === 'hp') {
    const heal = Math.round(d.maxHp * (s.player.classId === 'clerigo' ? 0.8 : 0.4));
    s.player.hp = Math.min(d.maxHp, s.player.hp + heal);
    c.emit({ type: 'heal', amount: heal });
  } else {
    s.player.mana = Math.min(d.maxMana, s.player.mana + Math.round(d.maxMana * 0.5));
    c.emit({ type: 'info', text: '🔷 Mana restaurada' });
  }
  return c.done();
}

export function buy(prev: SaveData, what: 'hpPotion' | 'manaPotion' | 'chestComum'): Result {
  const price = SHOP[what];
  if (prev.player.gold < price) return { s: prev, events: [{ type: 'info', text: 'Ouro insuficiente.' }] };
  const c = draft(prev);
  c.s.player.gold -= price;
  if (what === 'chestComum') addChest(c.s, 'comum');
  else c.s.consumables[what]++;
  return c.done();
}

/* =====================================================================
 * Inventário
 * ===================================================================== */
function clampVitals(s: SaveData) {
  const d = derived(s);
  s.player.hp = clamp(s.player.hp, 1, d.maxHp);
  s.player.mana = clamp(s.player.mana, 0, d.maxMana);
}

export function equip(prev: SaveData, itemId: string): Result {
  const it = prev.items.find(i => i.id === itemId);
  if (!it) return { s: prev, events: [] };
  if (prev.player.level < requiredLevel(it)) return { s: prev, events: [{ type: 'info', text: `Requer nível ${requiredLevel(it)}.` }] };
  const c = draft(prev);
  c.s.equipment[it.slot] = it.id;
  clampVitals(c.s);
  return c.done();
}

export function unequip(prev: SaveData, slot: Slot): Result {
  const c = draft(prev);
  c.s.equipment[slot] = null;
  clampVitals(c.s);
  return c.done();
}

export const isEquipped = (s: SaveData, id: string) => Object.values(s.equipment).includes(id);

export function sell(prev: SaveData, ids: string[]): Result {
  const c = draft(prev);
  let total = 0;
  for (const id of ids) {
    if (isEquipped(c.s, id)) continue;
    const it = c.s.items.find(i => i.id === id);
    if (!it) continue;
    total += it.value;
    c.s.items = c.s.items.filter(i => i.id !== id);
  }
  if (total) { c.s.player.gold += total; c.emit({ type: 'gold', amount: total }); }
  return c.done();
}

export function openChest(prev: SaveData, rarity: Rarity): Result {
  if (!prev.consumables.chests[rarity]) return { s: prev, events: [] };
  const c = draft(prev);
  const s = c.s;
  s.consumables.chests[rarity]!--;
  const item = generateItem(s.player.level, rollRarity(0.3, rarity));
  s.items.push(item);
  s.stats.itemsLooted++;
  c.emit({ type: 'loot', item });
  const gold = randInt(10, 30) * (1 + s.player.level / 5);
  addGold(c, Math.round(gold));
  checkAchievements(c);
  return c.done();
}

export const FORGE_COST = 20;
export function forge(prev: SaveData): Result {
  if (prev.consumables.fragments < FORGE_COST) return { s: prev, events: [] };
  const c = draft(prev);
  c.s.consumables.fragments -= FORGE_COST;
  const item: Item = generateItem(c.s.player.level, rollRarity(0.6, 'incomum'));
  c.s.items.push(item);
  c.emit({ type: 'loot', item });
  checkAchievements(c);
  return c.done();
}

/* =====================================================================
 * Personagem
 * ===================================================================== */
export function allocate(prev: SaveData, key: AttrKey): Result {
  if (prev.player.freePoints <= 0) return { s: prev, events: [] };
  const c = draft(prev);
  c.s.player.freePoints--;
  c.s.player.baseAttrs[key]++;
  return c.done();
}

export const CLASS_CHANGE_COST = 500;
export function changeClass(prev: SaveData, id: ClassId): Result {
  const cls = CLASS_BY_ID[id];
  const p = prev.player;
  if (p.classId === id || p.level < cls.unlockLevel || p.gold < CLASS_CHANGE_COST) return { s: prev, events: [] };
  const c = draft(prev);
  const np = c.s.player;
  const old = CLASS_BY_ID[np.classId];
  for (const k of Object.keys(np.baseAttrs) as AttrKey[]) np.baseAttrs[k] = cls.base[k] + (np.baseAttrs[k] - old.base[k]);
  np.classId = id;
  np.gold -= CLASS_CHANGE_COST;
  clampVitals(c.s);
  c.emit({ type: 'info', text: `Você agora é um ${cls.name}!` });
  return c.done();
}

export function setTitle(prev: SaveData, id: string | null): Result {
  const c = draft(prev);
  c.s.player.titleId = id;
  return c.done();
}

export function rest(prev: SaveData): Result {
  const cost = 10 * prev.player.level;
  if (prev.player.gold < cost) return { s: prev, events: [{ type: 'info', text: 'Ouro insuficiente.' }] };
  const c = draft(prev);
  const d = derived(c.s);
  c.s.player.gold -= cost;
  c.s.player.hp = d.maxHp;
  c.s.player.mana = d.maxMana;
  c.emit({ type: 'heal', amount: d.maxHp });
  return c.done();
}

/* =====================================================================
 * Decks e cards
 * ===================================================================== */
export function addDeck(prev: SaveData, name: string): Result {
  const c = draft(prev);
  c.s.decks.push({ id: uid(), name: name.trim(), createdAt: Date.now() });
  return c.done();
}

export function renameDeck(prev: SaveData, id: string, name: string): Result {
  const c = draft(prev);
  const d = c.s.decks.find(x => x.id === id);
  if (d) d.name = name.trim();
  return c.done();
}

export function deleteDeck(prev: SaveData, id: string): Result {
  const c = draft(prev);
  c.s.decks = c.s.decks.filter(d => d.id !== id);
  c.s.cards = c.s.cards.filter(x => x.deckId !== id);
  if (c.s.battle?.deckId === id) c.s.battle = null;
  return c.done();
}

export function upsertCard(prev: SaveData, data: { id?: string; deckId: string; front: string; back: string; tags: string[] }): Result {
  const c = draft(prev);
  if (data.id) {
    const card = c.s.cards.find(x => x.id === data.id);
    if (card) Object.assign(card, { deckId: data.deckId, front: data.front, back: data.back, tags: data.tags });
  } else {
    c.s.cards.push({ id: uid(), deckId: data.deckId, front: data.front, back: data.back, tags: data.tags, createdAt: Date.now(), ...newCardFields() });
  }
  return c.done();
}

export function deleteCard(prev: SaveData, id: string): Result {
  const c = draft(prev);
  c.s.cards = c.s.cards.filter(x => x.id !== id);
  if (c.s.battle?.cardId === id) c.s.battle.cardId = pickNext(c.s, c.s.battle)?.id ?? null;
  return c.done();
}

export function resetCardProgress(prev: SaveData, deckId: string): Result {
  const c = draft(prev);
  for (const card of c.s.cards) if (card.deckId === deckId) Object.assign(card, newCardFields());
  return c.done();
}

/** Importa linhas já parseadas (frente, verso, deck, tags). Cria decks conforme necessário. */
export function importRows(prev: SaveData, rows: { front: string; back: string; deck: string; tags: string[] }[], fallbackDeck: string): Result & { added: number; decks: number } {
  const c = draft(prev);
  const s = c.s;
  const byName = new Map(s.decks.map(d => [d.name.toLowerCase(), d.id]));
  const existing = new Set(s.cards.map(x => `${x.front}\u0000${x.back}`));
  let added = 0;
  let newDecks = 0;
  const now = Date.now();
  for (const r of rows) {
    const deckName = (r.deck || fallbackDeck).trim() || 'Importados';
    let deckId = byName.get(deckName.toLowerCase());
    if (!deckId) {
      deckId = uid();
      s.decks.push({ id: deckId, name: deckName, createdAt: now });
      byName.set(deckName.toLowerCase(), deckId);
      newDecks++;
    }
    const key = `${r.front}\u0000${r.back}`;
    if (existing.has(key)) continue;
    existing.add(key);
    s.cards.push({ id: uid(), deckId, front: r.front, back: r.back, tags: r.tags, createdAt: now + added, ...newCardFields() });
    added++;
  }
  return { ...c.done(), added, decks: newDecks };
}

export function updateSettings(prev: SaveData, patch: Partial<SaveData['settings']>): Result {
  const c = draft(prev);
  Object.assign(c.s.settings, patch);
  return c.done();
}

export function renamePlayer(prev: SaveData, name: string): Result {
  const c = draft(prev);
  c.s.player.name = name.trim() || c.s.player.name;
  return c.done();
}
