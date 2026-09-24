import type { CategoryId, Difficulty } from '../types';

export interface CategoryDef {
  id: CategoryId;
  name: string; // nome curto (roleta)
  full: string;
  icon: string;
  color: string; // cor principal
  dark: string; // cor escura (gradiente)
  tw: string; // classe de texto tailwind
  crownTitle: string; // título da conquista da categoria
}

// Para alterar/adicionar categorias: edite esta lista e o tipo CategoryId em src/types.
export const CATEGORIES: CategoryDef[] = [
  { id: 'GO', name: 'GO', full: 'Ginecologia e Obstetrícia', icon: '🤰', color: '#ec4899', dark: '#9d174d', tw: 'text-go', crownTitle: 'Obstetra de Plantão' },
  { id: 'CLI', name: 'CLÍNICA', full: 'Clínica Médica', icon: '🩺', color: '#3b82f6', dark: '#1e40af', tw: 'text-cli', crownTitle: 'Clínico de Elite' },
  { id: 'CIR', name: 'CIRURGIA', full: 'Cirurgia', icon: '✂️', color: '#f97316', dark: '#9a3412', tw: 'text-cir', crownTitle: 'Cirurgião' },
  { id: 'PRE', name: 'PREVENTIVA', full: 'Medicina Preventiva / Saúde Coletiva', icon: '🛡️', color: '#22c55e', dark: '#166534', tw: 'text-pre', crownTitle: 'Guardião da Preventiva' },
  { id: 'PED', name: 'PEDIATRIA', full: 'Pediatria', icon: '🧸', color: '#eab308', dark: '#854d0e', tw: 'text-ped', crownTitle: 'Pediatra Nato' },
];

export const CAT: Record<CategoryId, CategoryDef> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, CategoryDef>;
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: 'Fácil', 2: 'Média', 3: 'Difícil', 4: 'Muito difícil' };
export const DIFFICULTY_COLOR: Record<Difficulty, string> = { 1: '#22c55e', 2: '#3b82f6', 3: '#f97316', 4: '#ef4444' };

export function emptyCatRecord<T>(v: T): Record<CategoryId, T> {
  return { GO: v, CLI: v, CIR: v, PRE: v, PED: v };
}
