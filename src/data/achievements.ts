import type { CategoryId } from '../types';

/** Dados agregados usados para avaliar conquistas e missões. */
export interface ProgressSnapshot {
  answered: number;
  correct: number;
  catCorrect: Record<CategoryId, number>;
  catAnswered: Record<CategoryId, number>;
  wins: number;
  rankedWins: number;
  matches: number;
  bestAnswerStreak: number;
  bestWinStreak: number;
  dayStreak: number;
  level: number;
  rating: number;
  perfectMatches: number;
  crownsTotal: number;
  hardCorrect: number; // acertos em difícil/muito difícil
  fastCorrect: number; // acertos em < 8 s
  shopItems: number;
  studySessions: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  xp: number;
  coins: number;
  check: (s: ProgressSnapshot) => boolean;
  progress?: (s: ProgressSnapshot) => [number, number];
}

const catAch = (cat: CategoryId, name: string, icon: string): AchievementDef => ({
  id: `esp-${cat}`,
  name,
  desc: `Acerte 100 cartões de ${cat === 'GO' ? 'GO' : cat === 'CLI' ? 'Clínica' : cat === 'CIR' ? 'Cirurgia' : cat === 'PRE' ? 'Preventiva' : 'Pediatria'}.`,
  icon,
  xp: 400,
  coins: 200,
  check: (s) => s.catCorrect[cat] >= 100,
  progress: (s) => [s.catCorrect[cat], 100],
});

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-answer', name: 'Primeiro plantão', desc: 'Responda seu primeiro cartão.', icon: '🩺', xp: 20, coins: 20, check: (s) => s.answered >= 1 },
  { id: 'first-win', name: 'Primeira vitória', desc: 'Vença sua primeira partida PvP.', icon: '🏅', xp: 80, coins: 50, check: (s) => s.wins >= 1 },
  { id: 'wins-10', name: '10 vitórias', desc: 'Vença 10 partidas.', icon: '🎖️', xp: 200, coins: 120, check: (s) => s.wins >= 10, progress: (s) => [s.wins, 10] },
  { id: 'wins-50', name: 'Veterano de duelos', desc: 'Vença 50 partidas.', icon: '⚔️', xp: 600, coins: 300, check: (s) => s.wins >= 50, progress: (s) => [s.wins, 50] },
  { id: 'q-100', name: '100 cartões', desc: 'Responda 100 cartões.', icon: '📘', xp: 150, coins: 80, check: (s) => s.answered >= 100, progress: (s) => [s.answered, 100] },
  { id: 'q-500', name: '500 cartões', desc: 'Responda 500 cartões.', icon: '📗', xp: 500, coins: 250, check: (s) => s.answered >= 500, progress: (s) => [s.answered, 500] },
  { id: 'q-1000', name: '1000 cartões', desc: 'Responda 1000 cartões.', icon: '📕', xp: 1000, coins: 500, check: (s) => s.answered >= 1000, progress: (s) => [s.answered, 1000] },
  { id: 'streak-5', name: 'Pegando fogo', desc: '5 acertos seguidos.', icon: '🔥', xp: 60, coins: 30, check: (s) => s.bestAnswerStreak >= 5, progress: (s) => [s.bestAnswerStreak, 5] },
  { id: 'streak-10', name: 'Imparável', desc: '10 acertos seguidos.', icon: '☄️', xp: 200, coins: 100, check: (s) => s.bestAnswerStreak >= 10, progress: (s) => [s.bestAnswerStreak, 10] },
  { id: 'streak-20', name: 'Modo R1 aprovado', desc: '20 acertos seguidos.', icon: '🚀', xp: 500, coins: 250, check: (s) => s.bestAnswerStreak >= 20, progress: (s) => [s.bestAnswerStreak, 20] },
  { id: 'winstreak-3', name: 'Série invicta', desc: 'Vença 3 partidas seguidas.', icon: '🏆', xp: 150, coins: 80, check: (s) => s.bestWinStreak >= 3, progress: (s) => [s.bestWinStreak, 3] },
  { id: 'days-3', name: 'Hábito saudável', desc: 'Jogue 3 dias seguidos.', icon: '📅', xp: 80, coins: 50, check: (s) => s.dayStreak >= 3, progress: (s) => [s.dayStreak, 3] },
  { id: 'days-7', name: 'Semana completa', desc: 'Jogue 7 dias seguidos.', icon: '🗓️', xp: 250, coins: 150, check: (s) => s.dayStreak >= 7, progress: (s) => [s.dayStreak, 7] },
  { id: 'days-30', name: 'Disciplina de residente', desc: 'Jogue 30 dias seguidos.', icon: '🧘', xp: 1000, coins: 600, check: (s) => s.dayStreak >= 30, progress: (s) => [s.dayStreak, 30] },
  { id: 'perfect', name: 'Gabaritou!', desc: 'Termine uma partida sem errar nenhum cartão.', icon: '💯', xp: 200, coins: 100, check: (s) => s.perfectMatches >= 1 },
  { id: 'crowns-25', name: 'Colecionador de coroas', desc: 'Conquiste 25 coroas.', icon: '👑', xp: 250, coins: 120, check: (s) => s.crownsTotal >= 25, progress: (s) => [s.crownsTotal, 25] },
  { id: 'hard-25', name: 'Casca grossa', desc: 'Acerte 25 cartões que você já tinha errado.', icon: '🧗', xp: 300, coins: 150, check: (s) => s.hardCorrect >= 25, progress: (s) => [s.hardCorrect, 25] },
  { id: 'fast-20', name: 'Raciocínio rápido', desc: 'Acerte 20 cartões em menos de 8 segundos.', icon: '⚡', xp: 150, coins: 80, check: (s) => s.fastCorrect >= 20, progress: (s) => [s.fastCorrect, 20] },
  { id: 'ranked-1', name: 'Estreia ranqueada', desc: 'Vença uma partida ranqueada.', icon: '🎯', xp: 100, coins: 60, check: (s) => s.rankedWins >= 1 },
  { id: 'gold', name: 'Liga Ouro', desc: 'Alcance 1250 de rating.', icon: '🥇', xp: 400, coins: 200, check: (s) => s.rating >= 1250 },
  { id: 'diamond', name: 'Liga Diamante', desc: 'Alcance 1550 de rating.', icon: '💎', xp: 1000, coins: 500, check: (s) => s.rating >= 1550 },
  { id: 'lvl-10', name: 'Doutorando', desc: 'Alcance o nível 10.', icon: '🎓', xp: 0, coins: 200, check: (s) => s.level >= 10, progress: (s) => [s.level, 10] },
  { id: 'lvl-20', name: 'Residente', desc: 'Alcance o nível 20.', icon: '🏥', xp: 0, coins: 500, check: (s) => s.level >= 20, progress: (s) => [s.level, 20] },
  { id: 'shopper', name: 'Estilo próprio', desc: 'Compre um item na loja.', icon: '🛍️', xp: 40, coins: 0, check: (s) => s.shopItems >= 1 },
  { id: 'study-5', name: 'Estudo dirigido', desc: 'Complete 5 treinos.', icon: '📝', xp: 120, coins: 60, check: (s) => s.studySessions >= 5, progress: (s) => [s.studySessions, 5] },
  catAch('GO', 'Rainha/Rei da GO', '🤰'),
  catAch('CLI', 'Especialista em Clínica', '🩺'),
  catAch('CIR', 'Cirurgião', '✂️'),
  catAch('PRE', 'Rainha/Rei da Preventiva', '🛡️'),
  catAch('PED', 'Pediatra de coração', '🧸'),
];
