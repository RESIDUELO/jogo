// Títulos temáticos de progressão. O nível é numérico e ilimitado;
// o título muda por faixas de nível.
export const LEVEL_TITLES: { from: number; title: string; icon: string }[] = [
  { from: 1, title: 'Calouro', icon: '📚' },
  { from: 3, title: 'Monitor de Anatomia', icon: '🦴' },
  { from: 5, title: 'Interno', icon: '🥼' },
  { from: 8, title: 'Doutorando', icon: '🎓' },
  { from: 11, title: 'Médico Recém-formado', icon: '🩺' },
  { from: 14, title: 'Plantonista', icon: '🚑' },
  { from: 17, title: 'Residente R1', icon: '🏥' },
  { from: 21, title: 'Residente R2', icon: '💉' },
  { from: 25, title: 'Residente R3', icon: '🧬' },
  { from: 29, title: 'Chefe de Residência', icon: '📋' },
  { from: 33, title: 'Especialista', icon: '⭐' },
  { from: 38, title: 'Preceptor', icon: '🧑‍🏫' },
  { from: 44, title: 'Professor Titular', icon: '🏛️' },
  { from: 50, title: 'Lenda da Medicina', icon: '👑' },
];

export interface League {
  id: string;
  name: string;
  min: number;
  color: string;
  icon: string;
}

export const LEAGUES: League[] = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#c2773c', icon: '🥉' },
  { id: 'prata', name: 'Prata', min: 1100, color: '#cbd5e1', icon: '🥈' },
  { id: 'ouro', name: 'Ouro', min: 1250, color: '#facc15', icon: '🥇' },
  { id: 'platina', name: 'Platina', min: 1400, color: '#5eead4', icon: '💠' },
  { id: 'diamante', name: 'Diamante', min: 1550, color: '#60a5fa', icon: '💎' },
  { id: 'mestre', name: 'Mestre', min: 1700, color: '#c084fc', icon: '🔮' },
  { id: 'grao-mestre', name: 'Grão-Mestre', min: 1850, color: '#f43f5e', icon: '🏆' },
];

export const START_RATING = 1000;
