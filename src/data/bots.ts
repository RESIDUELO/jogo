import type { CategoryId } from '../types';

export type BotTier = 'interno' | 'r1' | 'r2' | 'r3' | 'especialista';

export interface BotTierDef {
  id: BotTier;
  label: string;
  baseAccuracy: number; // probabilidade de acerto em questão "média"
  meanMs: number; // tempo médio de resposta
  rating: number;
  level: number;
}

export const BOT_TIERS: Record<BotTier, BotTierDef> = {
  interno: { id: 'interno', label: 'Interno', baseAccuracy: 0.45, meanMs: 21000, rating: 900, level: 6 },
  r1: { id: 'r1', label: 'R1', baseAccuracy: 0.56, meanMs: 18500, rating: 1120, level: 17 },
  r2: { id: 'r2', label: 'R2', baseAccuracy: 0.65, meanMs: 16500, rating: 1300, level: 22 },
  r3: { id: 'r3', label: 'R3', baseAccuracy: 0.74, meanMs: 14500, rating: 1480, level: 27 },
  especialista: { id: 'especialista', label: 'Especialista', baseAccuracy: 0.83, meanMs: 12500, rating: 1720, level: 35 },
};

export interface BotPersona {
  id: string;
  name: string;
  avatar: string;
  tier: BotTier;
  /** Ajuste de acurácia por categoria (pontos fortes/fracos → bot não parece aleatório). */
  skill: Partial<Record<CategoryId, number>>;
  taunts: { win: string; lose: string };
}

export const BOTS: BotPersona[] = [
  { id: 'bot-lucas', name: 'Lucas (Interno)', avatar: '🧑‍🎓', tier: 'interno', skill: { PRE: 0.08, CIR: -0.08 }, taunts: { win: 'Estudei a noite toda pra isso!', lose: 'Vou voltar pro livro...' } },
  { id: 'bot-bia', name: 'Bia (Interna)', avatar: '👩‍🎓', tier: 'interno', skill: { PED: 0.1, CLI: -0.05 }, taunts: { win: 'Sorte de principiante? Nada disso.', lose: 'Revanche amanhã!' } },
  { id: 'bot-rafa', name: 'Dr. Rafa (R1 Clínica)', avatar: '👨‍⚕️', tier: 'r1', skill: { CLI: 0.12, GO: -0.1 }, taunts: { win: 'Diagnóstico: vitória.', lose: 'Boa! Vou pedir mais exames.' } },
  { id: 'bot-carla', name: 'Dra. Carla (R1 GO)', avatar: '👩‍⚕️', tier: 'r1', skill: { GO: 0.14, CIR: -0.06 }, taunts: { win: 'Parto normal, sem intercorrências.', lose: 'Você me pegou de surpresa.' } },
  { id: 'bot-ana', name: 'Dra. Ana (R2 Pediatria)', avatar: '👩🏽‍⚕️', tier: 'r2', skill: { PED: 0.14, CIR: -0.08 }, taunts: { win: 'Criança não é adulto pequeno!', lose: 'Mandou bem, colega.' } },
  { id: 'bot-joao', name: 'Dr. João (R2 Cirurgia)', avatar: '👨🏻‍⚕️', tier: 'r2', skill: { CIR: 0.15, PRE: -0.1 }, taunts: { win: 'Na dúvida, laparotomia.', lose: 'Hemostasia falhou hoje.' } },
  { id: 'bot-marta', name: 'Dra. Marta (R3 Preventiva)', avatar: '👩🏾‍⚕️', tier: 'r3', skill: { PRE: 0.15, PED: -0.05 }, taunts: { win: 'Prevenir é melhor que perder.', lose: 'Viés de seleção, certeza.' } },
  { id: 'bot-paulo', name: 'Dr. Paulo (R3 Clínica)', avatar: '🧔', tier: 'r3', skill: { CLI: 0.12, GO: -0.08 }, taunts: { win: 'Pense em zebra, mas trate o cavalo.', lose: 'Excelente raciocínio clínico!' } },
  { id: 'bot-helena', name: 'Profa. Helena (Especialista)', avatar: '👩🏼‍🏫', tier: 'especialista', skill: { GO: 0.06, CLI: 0.04 }, taunts: { win: 'Volte ao Williams e tente de novo.', lose: 'Aluno que supera a professora. Parabéns!' } },
  { id: 'bot-otavio', name: 'Prof. Otávio (Especialista)', avatar: '👨🏽‍🏫', tier: 'especialista', skill: { CIR: 0.06, PED: 0.03 }, taunts: { win: 'Experiência conta.', lose: 'Você está pronto para a prova.' } },
];

export const BOT_BY_ID: Record<string, BotPersona> = Object.fromEntries(BOTS.map((b) => [b.id, b]));
