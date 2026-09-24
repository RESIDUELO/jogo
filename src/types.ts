// Tipos centrais do jogo. O SaveData é o documento único persistido —
// pensado para ser serializável e fácil de mover para um backend depois.

export type Grade = 1 | 2 | 3 | 4; // 1 Errei · 2 Acertei c/ dificuldade · 3 Acertei · 4 Dominei

export type AttrKey = 'INT' | 'SAB' | 'VIT' | 'PRE' | 'CON';
export type Attrs = Record<AttrKey, number>;

export type Slot = 'capacete' | 'armadura' | 'luvas' | 'calcas' | 'botas' | 'anel' | 'amuleto' | 'arma';
export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario' | 'mitico';

export type ClassId = 'guerreiro' | 'mago' | 'assassino' | 'clerigo' | 'medico';

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  tags: string[];
  createdAt: number;
  // repetição espaçada
  state: 'new' | 'learning' | 'review';
  due: number;        // timestamp da próxima revisão
  interval: number;   // dias
  ease: number;       // fator de facilidade
  // desempenho
  correct: number;
  wrong: number;
  streak: number;     // acertos seguidos neste card
  xpEarned: number;
  hard: boolean;      // marcado como CARD DIFÍCIL
  conquered: number;  // quantas vezes um card difícil foi superado
  lastReviewed: number | null;
}

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
}

export interface Item {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  level: number;
  attrs: Partial<Attrs>;
  atk: number;
  def: number;
  value: number;
  icon: string;
}

export interface Enemy {
  defId: string;
  name: string;
  icon: string;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  isBoss: boolean;
  phase: number;          // índice da fase atual (bosses)
  phases: string[];       // nomes das fases
  weakness: string[];
  dropBonus: number;      // aumenta com respostas "Dominei"
  taunt?: string;
}

export interface BattleState {
  regionId: string;
  deckId: string | null;  // null = todos os decks
  enemy: Enemy;
  practice: boolean;      // treino livre (sem cards vencidos): recompensa reduzida
  focus: boolean;         // habilidade Foco ativa
  ward: boolean;          // habilidade Segunda Chance ativa
  session: SessionStats;
  cardId: string | null;  // card sendo mostrado
}

export interface SessionStats {
  startedAt: number;
  answered: number;
  correct: number;
  xp: number;
  gold: number;
  kills: number;
  loot: string[];         // nomes de itens obtidos
  maxCombo: number;
}

export interface ReviewEntry {
  t: number;
  cardId: string;
  deckId: string;
  grade: Grade;
  xp: number;
  ms: number;
  overdue: boolean;
}

export type QuestKind =
  | 'answer' | 'correct' | 'kills' | 'combo' | 'overdue' | 'mastered' | 'boss' | 'hardCards' | 'streakDays' | 'sessions';

export interface Reward {
  xp?: number;
  gold?: number;
  chest?: Rarity;
  hpPotion?: number;
  manaPotion?: number;
  fragments?: number;
}

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  target: number;
  progress: number;
  reward: Reward;
  claimed: boolean;
}

export interface RegionProgress {
  unlocked: boolean;
  kills: number;          // desde o último boss
  totalKills: number;
  bossDefeated: number;   // vezes que o boss foi derrotado
}

export interface Player {
  name: string;
  classId: ClassId;
  level: number;
  xp: number;              // XP total acumulado
  gold: number;
  hp: number;
  mana: number;
  baseAttrs: Attrs;        // pontos distribuídos
  freePoints: number;
  titleId: string | null;
  combo: number;
  createdAt: number;
}

export interface Settings {
  newPerDay: number;
  dailyGoal: number;
  weaknesses: boolean;
  sound: boolean;
}

export interface SaveData {
  version: number;
  player: Player;
  equipment: Record<Slot, string | null>;
  items: Item[];
  consumables: { hpPotion: number; manaPotion: number; fragments: number; chests: Partial<Record<Rarity, number>> };
  decks: Deck[];
  cards: Card[];
  log: ReviewEntry[];
  regions: Record<string, RegionProgress>;
  currentRegion: string;
  battle: BattleState | null;
  stats: {
    enemiesDefeated: number;
    bossesDefeated: number;
    maxCombo: number;
    totalXp: number;
    totalGold: number;
    studyMs: number;
    sessions: number;
    hardConquered: number;
    itemsLooted: number;
  };
  streak: { current: number; best: number; lastDay: string | null; shields: number };
  quests: { day: string; daily: Quest[]; week: string; weekly: Quest[] };
  achievements: string[];
  titles: string[];
  today: { day: string; answered: number; correct: number; xp: number; kills: number; newByDeck: Record<string, number>; healed: boolean };
  settings: Settings;
}

// Eventos gerados pelo motor — a UI transforma em efeitos visuais.
export type GameEvent =
  | { type: 'damage'; amount: number; crit: boolean; perfect: boolean; weak: boolean }
  | { type: 'hurt'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'xp'; amount: number }
  | { type: 'gold'; amount: number }
  | { type: 'combo'; value: number; label?: string }
  | { type: 'miss' }
  | { type: 'kill'; name: string; boss: boolean }
  | { type: 'phase'; name: string; taunt: string }
  | { type: 'levelup'; level: number }
  | { type: 'loot'; item: Item }
  | { type: 'drop'; text: string }
  | { type: 'quest'; title: string }
  | { type: 'achievement'; name: string }
  | { type: 'region'; name: string }
  | { type: 'faint' }
  | { type: 'hardCard' }
  | { type: 'conquered'; text: string }
  | { type: 'streak'; days: number }
  | { type: 'info'; text: string };
