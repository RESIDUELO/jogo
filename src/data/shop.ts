import type { PowerUpId } from '../types';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  icon: string;
  desc: string;
  price: number;
}

export const POWERUPS: PowerUpDef[] = [
  { id: 'fifty', name: '50/50', icon: '✂️', desc: 'Remove duas alternativas erradas.', price: 60 },
  { id: 'time', name: 'Tempo extra', icon: '⏱️', desc: '+15 segundos no relógio.', price: 40 },
  { id: 'second', name: 'Segunda chance', icon: '🔁', desc: 'Se errar, tenta de novo (pontuação reduzida).', price: 80 },
  { id: 'hint', name: 'Dica', icon: '💡', desc: 'Mostra o tema e elimina uma alternativa errada.', price: 50 },
  { id: 'swap', name: 'Troca de cartão', icon: '🔄', desc: 'Troca por outro cartão da mesma área.', price: 50 },
];
export const POWERUP: Record<PowerUpId, PowerUpDef> = Object.fromEntries(POWERUPS.map((p) => [p.id, p])) as Record<PowerUpId, PowerUpDef>;

/** No ranqueado, limite de itens por partida (anti pay-to-win). */
export const RANKED_POWERUP_LIMIT = 2;

export type CosmeticKind = 'avatar' | 'frame' | 'effect' | 'title';

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  price: number;
  value: string; // emoji, css gradient, cor ou texto
  minLevel?: number;
}

export const COSMETICS: CosmeticDef[] = [
  // avatares (os 6 primeiros são gratuitos)
  { id: 'av-steth', kind: 'avatar', name: 'Estetoscópio', price: 0, value: '🩺' },
  { id: 'av-doc-f', kind: 'avatar', name: 'Médica', price: 0, value: '👩‍⚕️' },
  { id: 'av-doc-m', kind: 'avatar', name: 'Médico', price: 0, value: '👨‍⚕️' },
  { id: 'av-student', kind: 'avatar', name: 'Estudante', price: 0, value: '🧑‍🎓' },
  { id: 'av-brain', kind: 'avatar', name: 'Cérebro', price: 0, value: '🧠' },
  { id: 'av-heart', kind: 'avatar', name: 'Coração', price: 0, value: '🫀' },
  { id: 'av-dna', kind: 'avatar', name: 'DNA', price: 150, value: '🧬' },
  { id: 'av-micro', kind: 'avatar', name: 'Microscópio', price: 150, value: '🔬' },
  { id: 'av-lungs', kind: 'avatar', name: 'Pulmões', price: 200, value: '🫁' },
  { id: 'av-virus', kind: 'avatar', name: 'Vírus', price: 200, value: '🦠' },
  { id: 'av-owl', kind: 'avatar', name: 'Coruja de plantão', price: 300, value: '🦉' },
  { id: 'av-ninja', kind: 'avatar', name: 'Ninja da prova', price: 400, value: '🥷' },
  { id: 'av-robot', kind: 'avatar', name: 'Robô cirurgião', price: 500, value: '🤖' },
  { id: 'av-unicorn', kind: 'avatar', name: 'Zebra diagnóstica', price: 600, value: '🦓' },
  { id: 'av-dragon', kind: 'avatar', name: 'Dragão do R1', price: 900, value: '🐉', minLevel: 15 },
  { id: 'av-crown', kind: 'avatar', name: 'Realeza', price: 1500, value: '🤴', minLevel: 25 },
  // molduras
  { id: 'fr-none', kind: 'frame', name: 'Simples', price: 0, value: 'linear-gradient(135deg,#35307a,#262259)' },
  { id: 'fr-ocean', kind: 'frame', name: 'Oceano', price: 200, value: 'linear-gradient(135deg,#06b6d4,#3b82f6)' },
  { id: 'fr-sunset', kind: 'frame', name: 'Pôr do sol', price: 250, value: 'linear-gradient(135deg,#f97316,#ec4899)' },
  { id: 'fr-forest', kind: 'frame', name: 'Floresta', price: 250, value: 'linear-gradient(135deg,#22c55e,#14532d)' },
  { id: 'fr-gold', kind: 'frame', name: 'Ouro', price: 600, value: 'linear-gradient(135deg,#fde047,#ca8a04,#fde047)', minLevel: 10 },
  { id: 'fr-rainbow', kind: 'frame', name: 'Arco-íris', price: 900, value: 'conic-gradient(#ec4899,#3b82f6,#f97316,#22c55e,#eab308,#ec4899)', minLevel: 15 },
  { id: 'fr-diamond', kind: 'frame', name: 'Diamante', price: 1400, value: 'linear-gradient(135deg,#e0f2fe,#60a5fa,#a78bfa,#e0f2fe)', minLevel: 25 },
  // efeitos de acerto (cor das partículas)
  { id: 'fx-classic', kind: 'effect', name: 'Confete clássico', price: 0, value: 'multi' },
  { id: 'fx-gold', kind: 'effect', name: 'Chuva de ouro', price: 300, value: '#facc15' },
  { id: 'fx-neon', kind: 'effect', name: 'Neon', price: 300, value: '#22d3ee' },
  { id: 'fx-love', kind: 'effect', name: 'Corações', price: 400, value: '#f472b6' },
  // títulos
  { id: 'ti-none', kind: 'title', name: 'Sem título', price: 0, value: '' },
  { id: 'ti-coffee', kind: 'title', name: 'Movido a café', price: 150, value: '☕ Movido a café' },
  { id: 'ti-plantao', kind: 'title', name: 'Sobrevivente do plantão', price: 250, value: '🌙 Sobrevivente do plantão' },
  { id: 'ti-gabarito', kind: 'title', name: 'Gabaritador', price: 500, value: '🎯 Gabaritador', minLevel: 12 },
  { id: 'ti-lenda', kind: 'title', name: 'Lenda do R1', price: 1200, value: '🏆 Lenda do R1', minLevel: 20 },
];

export const COSMETIC: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const FREE_COSMETICS = COSMETICS.filter((c) => c.price === 0).map((c) => c.id);
