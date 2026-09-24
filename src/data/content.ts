import type { AttrKey, Attrs, ClassId, Rarity, Slot } from '../types';

/* ---------- Classes ---------- */
export interface ClassDef {
  id: ClassId;
  name: string;
  icon: string;
  description: string;
  perks: string[];
  base: Attrs;
  unlockLevel: number;
  // modificadores de gameplay
  hpMult: number;
  xpMult: number;
  comboMult: number;
  critBonus: number;     // chance extra (0–1)
  critMult: number;      // multiplicador de dano crítico
  healOnCorrect: number; // fração do HP máximo curada por acerto
  hurtMult: number;      // dano recebido
  hardCardMult: number;  // XP extra em cards difíceis
}

export const CLASSES: ClassDef[] = [
  {
    id: 'guerreiro', name: 'Guerreiro', icon: '🛡️', unlockLevel: 1,
    description: 'Resistente e constante. Aguenta os erros e mantém o ritmo.',
    perks: ['+25% HP', '−25% dano recebido', '+25% bônus de combo'],
    base: { INT: 4, SAB: 6, VIT: 8, PRE: 4, CON: 4 },
    hpMult: 1.25, xpMult: 1, comboMult: 1.25, critBonus: 0, critMult: 2, healOnCorrect: 0.02, hurtMult: 0.75, hardCardMult: 1,
  },
  {
    id: 'mago', name: 'Mago', icon: '🔮', unlockLevel: 1,
    description: 'Estudioso por natureza. Converte conhecimento em poder bruto.',
    perks: ['+15% XP', '+30% mana', 'INT e CON iniciais altos'],
    base: { INT: 8, SAB: 5, VIT: 3, PRE: 4, CON: 6 },
    hpMult: 0.9, xpMult: 1.15, comboMult: 1, critBonus: 0, critMult: 2, healOnCorrect: 0.02, hurtMult: 1, hardCardMult: 1,
  },
  {
    id: 'assassino', name: 'Assassino', icon: '🗡️', unlockLevel: 1,
    description: 'Preciso e letal. Cada acerto pode ser um golpe fatal.',
    perks: ['+10% chance de crítico', 'Crítico causa 2,5× dano'],
    base: { INT: 4, SAB: 4, VIT: 4, PRE: 9, CON: 5 },
    hpMult: 0.95, xpMult: 1, comboMult: 1, critBonus: 0.1, critMult: 2.5, healOnCorrect: 0.02, hurtMult: 1.05, hardCardMult: 1,
  },
  {
    id: 'clerigo', name: 'Clérigo', icon: '✨', unlockLevel: 1,
    description: 'Recupera-se a cada acerto. Ideal para sessões longas.',
    perks: ['Cura 6% do HP por acerto', 'Poções curam o dobro'],
    base: { INT: 5, SAB: 7, VIT: 6, PRE: 3, CON: 5 },
    hpMult: 1.05, xpMult: 1, comboMult: 1, critBonus: 0, critMult: 2, healOnCorrect: 0.06, hurtMult: 0.95, hardCardMult: 1,
  },
  {
    id: 'medico', name: 'Médico', icon: '⚕️', unlockLevel: 15,
    description: 'Classe especial para quem leva o estudo a sério. Brilha nos cards difíceis.',
    perks: ['+10% XP', '+50% XP em cards difíceis', 'Recompensa dobrada ao superar cards difíceis', 'Desbloqueia no nível 15'],
    base: { INT: 6, SAB: 6, VIT: 5, PRE: 5, CON: 6 },
    hpMult: 1.05, xpMult: 1.1, comboMult: 1.1, critBonus: 0.03, critMult: 2, healOnCorrect: 0.03, hurtMult: 0.9, hardCardMult: 1.5,
  },
];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c])) as Record<ClassId, ClassDef>;

/* ---------- Atributos ---------- */
export const ATTRS: { key: AttrKey; name: string; effect: string }[] = [
  { key: 'INT', name: 'Inteligência', effect: '+1% de XP por ponto' },
  { key: 'SAB', name: 'Sabedoria', effect: '+2% no bônus de combo por ponto' },
  { key: 'VIT', name: 'Vitalidade', effect: '+10 HP máximo por ponto' },
  { key: 'PRE', name: 'Precisão', effect: '+0,5% de chance de crítico por ponto' },
  { key: 'CON', name: 'Conhecimento', effect: '+2% de XP e ouro em cards "Dominei" por ponto' },
];

/* ---------- Raridades ---------- */
export const RARITIES: { id: Rarity; name: string; mult: number; weight: number; lines: number }[] = [
  { id: 'comum', name: 'Comum', mult: 1, weight: 560, lines: 1 },
  { id: 'incomum', name: 'Incomum', mult: 1.25, weight: 270, lines: 2 },
  { id: 'raro', name: 'Raro', mult: 1.6, weight: 120, lines: 2 },
  { id: 'epico', name: 'Épico', mult: 2.1, weight: 40, lines: 3 },
  { id: 'lendario', name: 'Lendário', mult: 2.8, weight: 9, lines: 4 },
  { id: 'mitico', name: 'Mítico', mult: 3.8, weight: 1, lines: 5 },
];
export const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r])) as Record<Rarity, (typeof RARITIES)[number]>;

/* ---------- Equipamentos ---------- */
export const SLOTS: { id: Slot; name: string; icon: string }[] = [
  { id: 'capacete', name: 'Capacete', icon: '⛑️' },
  { id: 'amuleto', name: 'Amuleto', icon: '📿' },
  { id: 'armadura', name: 'Armadura', icon: '🥼' },
  { id: 'arma', name: 'Arma', icon: '🗡️' },
  { id: 'luvas', name: 'Luvas', icon: '🧤' },
  { id: 'anel', name: 'Anel', icon: '💍' },
  { id: 'calcas', name: 'Calças', icon: '👖' },
  { id: 'botas', name: 'Botas', icon: '🥾' },
];
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s])) as Record<Slot, (typeof SLOTS)[number]>;

export const ITEM_BASES: Record<Slot, string[]> = {
  arma: ['Bisturi', 'Lâmina Cirúrgica', 'Cajado de Asclépio', 'Martelo de Reflexos', 'Tesoura de Metzenbaum', 'Trocarte Sombrio'],
  capacete: ['Capuz de Linho', 'Elmo do Plantonista', 'Máscara de Peste', 'Coroa de Hipócrates', 'Gorro Cirúrgico Rúnico'],
  armadura: ['Jaleco Reforçado', 'Cota de Malha Estéril', 'Manto do Residente', 'Couraça do Cirurgião', 'Avental de Chumbo'],
  luvas: ['Luvas Estéreis', 'Manoplas de Látex', 'Luvas do Anatomista', 'Braçadeiras de Garrote'],
  calcas: ['Calças de Plantão', 'Grevas do Pronto-Socorro', 'Calças de Couro Curtido', 'Perneiras do Maqueiro'],
  botas: ['Botas de Enfermaria', 'Botas do Corredor', 'Botas do Viajante Noturno', 'Tamancos do Centro Cirúrgico'],
  anel: ['Anel do Juramento', 'Anel de Sinete', 'Anel da Vigília', 'Aliança do Plantão'],
  amuleto: ['Estetoscópio Rúnico', 'Amuleto de Asclépio', 'Pingente do Caduceu', 'Crachá Encantado'],
};

export const ATTR_SUFFIX: Record<AttrKey, string> = {
  INT: 'da Mente',
  SAB: 'do Sábio',
  VIT: 'da Vitalidade',
  PRE: 'da Precisão',
  CON: 'do Erudito',
};

/* ---------- Combo ---------- */
export const COMBO_TIERS = [
  { at: 50, bonus: 0.5, label: 'COMBO ABSURDO' },
  { at: 20, bonus: 0.35, label: 'COMBO LENDÁRIO' },
  { at: 10, bonus: 0.2, label: 'COMBO ÉPICO' },
  { at: 5, bonus: 0.1, label: 'COMBO' },
  { at: 3, bonus: 0.05, label: 'COMBO' },
];

/* ---------- Títulos ---------- */
export interface TitleDef { id: string; name: string; how: string }
export const TITLES: TitleDef[] = [
  { id: 'aprendiz', name: 'Aprendiz', how: '7 dias de sequência' },
  { id: 'estudante', name: 'Estudante', how: 'Alcançar o nível 5' },
  { id: 'academico', name: 'Acadêmico', how: 'Alcançar o nível 10' },
  { id: 'discipulo', name: 'Discípulo', how: '30 dias de sequência' },
  { id: 'pesquisador', name: 'Pesquisador', how: 'Alcançar o nível 20' },
  { id: 'veterano', name: 'Veterano', how: '60 dias de sequência' },
  { id: 'especialista', name: 'Especialista', how: 'Dominar 200 cards' },
  { id: 'mestre', name: 'Mestre', how: '100 dias de sequência' },
  { id: 'doutor', name: 'Doutor', how: 'Derrotar o Rei do Choque' },
  { id: 'matador', name: 'Matador de Chefes', how: 'Derrotar 10 bosses' },
  { id: 'lenda', name: 'Lenda', how: '365 dias de sequência' },
];
export const TITLE_BY_ID = Object.fromEntries(TITLES.map(t => [t.id, t])) as Record<string, TitleDef>;

export const STREAK_MILESTONES: { days: number; gold: number; title?: string }[] = [
  { days: 3, gold: 100 },
  { days: 7, gold: 300, title: 'aprendiz' },
  { days: 14, gold: 600 },
  { days: 30, gold: 1500, title: 'discipulo' },
  { days: 60, gold: 3000, title: 'veterano' },
  { days: 100, gold: 5000, title: 'mestre' },
  { days: 365, gold: 20000, title: 'lenda' },
];

/* ---------- Loja (apenas consumíveis — ouro vem do estudo) ---------- */
export const SHOP = {
  hpPotion: 40,
  manaPotion: 50,
  chestComum: 400,
};

/* ---------- Habilidades ---------- */
export interface SkillDef { id: 'foco' | 'cura' | 'protecao'; name: string; icon: string; mana: number; level: number; desc: string }
export const SKILLS: SkillDef[] = [
  { id: 'foco', name: 'Foco Absoluto', icon: '🎯', mana: 30, level: 3, desc: 'O próximo acerto é garantidamente crítico.' },
  { id: 'cura', name: 'Primeiros Socorros', icon: '💚', mana: 40, level: 5, desc: 'Recupera 35% do HP máximo.' },
  { id: 'protecao', name: 'Segunda Chance', icon: '🔰', mana: 50, level: 8, desc: 'O próximo erro não zera o combo nem causa dano.' },
];
