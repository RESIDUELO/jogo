import type { SaveData } from '../types';
import { isMastered } from './srs';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  test: (s: SaveData) => boolean;
  title?: string; // título desbloqueado junto
}

const mastered = (s: SaveData) => s.cards.filter(isMastered).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primeiro-sangue', name: 'Primeiro Sangue', icon: '🩸', desc: 'Derrote o primeiro inimigo', test: s => s.stats.enemiesDefeated >= 1 },
  { id: 'primeira-sessao', name: 'Plantão Concluído', icon: '📋', desc: 'Conclua uma sessão de estudo', test: s => s.stats.sessions >= 1 },
  { id: 'centuriao', name: 'Centurião', icon: '💯', desc: 'Responda 100 cards', test: s => s.log.length >= 100 },
  { id: 'quinhentos', name: 'Maratonista', icon: '🏃', desc: 'Responda 500 cards', test: s => s.log.length >= 500 },
  { id: 'infinito', name: 'Conhecimento Infinito', icon: '♾️', desc: 'Responda 1.000 cards', test: s => s.log.length >= 1000 },
  { id: 'combo10', name: 'Em Chamas', icon: '🔥', desc: 'Faça um combo de 10', test: s => s.stats.maxCombo >= 10 },
  { id: 'combo25', name: 'Implacável', icon: '⚡', desc: 'Faça um combo de 25', test: s => s.stats.maxCombo >= 25 },
  { id: 'sem-errar', name: 'Sem Errar', icon: '🎯', desc: '50 acertos consecutivos', test: s => s.stats.maxCombo >= 50 },
  { id: 'streak7', name: 'Hábito Formado', icon: '📅', desc: '7 dias de sequência', test: s => s.streak.best >= 7 },
  { id: 'veterano', name: 'Veterano', icon: '🎖️', desc: '30 dias de sequência', test: s => s.streak.best >= 30 },
  { id: 'boss1', name: 'Caçador de Chefes', icon: '👹', desc: 'Derrote seu primeiro boss', test: s => s.stats.bossesDefeated >= 1 },
  { id: 'boss10', name: 'Matador de Boss', icon: '🐉', desc: 'Derrote 10 bosses', test: s => s.stats.bossesDefeated >= 10, title: 'matador' },
  { id: 'kills100', name: 'Exterminador', icon: '⚔️', desc: 'Derrote 100 inimigos', test: s => s.stats.enemiesDefeated >= 100 },
  { id: 'dominio50', name: 'Memória Sólida', icon: '🧠', desc: 'Domine 50 cards (intervalo ≥ 21 dias)', test: s => mastered(s) >= 50 },
  { id: 'dominio200', name: 'Especialista', icon: '📚', desc: 'Domine 200 cards', test: s => mastered(s) >= 200, title: 'especialista' },
  { id: 'enciclopedia', name: 'Enciclopédia', icon: '📖', desc: 'Domine 500 cards', test: s => mastered(s) >= 500 },
  { id: 'superacao', name: 'Superação', icon: '💪', desc: 'Supere um card difícil', test: s => s.stats.hardConquered >= 1 },
  { id: 'lendario', name: 'Tesouro Lendário', icon: '🌟', desc: 'Obtenha um item lendário ou mítico', test: s => s.items.some(i => i.rarity === 'lendario' || i.rarity === 'mitico') },
  { id: 'nivel10', name: 'Acadêmico', icon: '🎓', desc: 'Alcance o nível 10', test: s => s.player.level >= 10 },
  { id: 'nivel25', name: 'Residente', icon: '🩺', desc: 'Alcance o nível 25', test: s => s.player.level >= 25 },
  { id: 'uti', name: 'Sobrevivente da UTI', icon: '☠️', desc: 'Derrote o Dr. Choque Séptico', test: s => (s.regions.uti?.bossDefeated ?? 0) >= 1 },
  { id: 'residencia', name: 'Aprovado!', icon: '👑', desc: 'Derrote o Rei do Choque', test: s => (s.regions.castelo?.bossDefeated ?? 0) >= 1, title: 'doutor' },
];

/** Títulos por nível. */
export const LEVEL_TITLES: { level: number; title: string }[] = [
  { level: 5, title: 'estudante' },
  { level: 10, title: 'academico' },
  { level: 20, title: 'pesquisador' },
];
