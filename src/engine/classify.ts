// Classificação automática (heurística, sem IA) de categoria, subtema e dificuldade.
// Sempre editável manualmente na revisão/admin.
import type { CategoryId, Difficulty } from '../types';
import { clamp, normalize } from './util';

interface Rule {
  cat: CategoryId;
  sub: string;
  kw: string[];
}

// Palavras-chave já normalizadas (sem acento, minúsculas).
const RULES: Rule[] = [
  // GO
  { cat: 'GO', sub: 'Síndromes hipertensivas na gestação', kw: ['pre-eclampsia', 'eclampsia', 'hellp', 'sulfato de magnesio', 'hipertensao gestacional'] },
  { cat: 'GO', sub: 'Sangramentos da 1ª metade', kw: ['ectopica', 'abortamento', 'aborto', 'mola', 'doenca trofoblastica', 'beta hcg', 'beta-hcg'] },
  { cat: 'GO', sub: 'Sangramentos da 2ª metade', kw: ['placenta previa', 'descolamento prematuro', 'dpp', 'rotura uterina', 'vasa previa'] },
  { cat: 'GO', sub: 'Assistência ao parto', kw: ['trabalho de parto', 'partograma', 'dilatacao', 'apresentacao cefalica', 'cesarea', 'cesariana', 'distocia', 'forcipe'] },
  { cat: 'GO', sub: 'Pré-natal', kw: ['pre-natal', 'prenatal', 'idade gestacional', 'gestante', 'primigesta', 'dum'] },
  { cat: 'GO', sub: 'Diabetes gestacional', kw: ['diabetes gestacional', 'dmg', 'totg'] },
  { cat: 'GO', sub: 'Puerpério', kw: ['puerperio', 'puerpera', 'pos-parto', 'hemorragia pos-parto', 'lactacao'] },
  { cat: 'GO', sub: 'Anticoncepção', kw: ['anticoncep', 'contracep', 'diu', 'criterios de elegibilidade', 'pilula'] },
  { cat: 'GO', sub: 'Infecções genitais', kw: ['vaginose', 'candidiase', 'tricomon', 'ulcera genital', 'cervicite', 'doenca inflamatoria pelvica', 'dip '] },
  { cat: 'GO', sub: 'Oncologia ginecológica', kw: ['colo uterino', 'papanicolau', 'citologia oncotica', 'nic ', 'endometrio', 'cancer de ovario', 'cancer de mama', 'mamografia', 'birads', 'bi-rads'] },
  { cat: 'GO', sub: 'Endometriose', kw: ['endometriose'] },
  { cat: 'GO', sub: 'Climatério', kw: ['climaterio', 'menopausa', 'terapia hormonal'] },
  { cat: 'GO', sub: 'Amenorreia e endocrinologia ginecológica', kw: ['amenorreia', 'ovarios policisticos', 'sop', 'hiperprolactinemia', 'infertilidade'] },
  // Pediatria
  { cat: 'PED', sub: 'Neonatologia', kw: ['recem-nascido', 'recem nascido', 'neonat', 'apgar', 'reanimacao neonatal', 'ictericia neonatal', 'prematuro'] },
  { cat: 'PED', sub: 'Aleitamento materno', kw: ['aleitamento', 'amamentacao', 'leite materno'] },
  { cat: 'PED', sub: 'Imunizações', kw: ['vacina', 'vacinal', 'imunizacao', 'calendario vacinal'] },
  { cat: 'PED', sub: 'Crescimento e desenvolvimento', kw: ['desenvolvimento motor', 'marcos do desenvolvimento', 'crescimento', 'curva de', 'escore z', 'puberdade'] },
  { cat: 'PED', sub: 'Doenças exantemáticas', kw: ['exantema', 'sarampo', 'rubeola', 'escarlatina', 'varicela', 'eritema infeccioso', 'roseola', 'kawasaki'] },
  { cat: 'PED', sub: 'Diarreia e desidratação', kw: ['desidratacao', 'diarreia aguda', 'soro de reidratacao', 'plano b', 'plano c'] },
  { cat: 'PED', sub: 'Infecções respiratórias na infância', kw: ['bronquiolite', 'laringite', 'crupe', 'otite', 'amigdalite', 'faringite', 'pneumonia na crianca', 'lactente sibilante'] },
  { cat: 'PED', sub: 'Emergências pediátricas', kw: ['pals', 'parada cardiorrespiratoria pediatrica', 'choque septico pediatrico', 'corpo estranho'] },
  // Cirurgia
  { cat: 'CIR', sub: 'Trauma', kw: ['trauma', 'politraumatizado', 'atls', 'acidente', 'ferimento por arma', 'fast', 'queda', 'colisao', 'vitima'] },
  { cat: 'CIR', sub: 'Abdome agudo', kw: ['apendicite', 'abdome agudo', 'obstrucao intestinal', 'diverticulite', 'perfuracao', 'volvo'] },
  { cat: 'CIR', sub: 'Vias biliares e pâncreas', kw: ['colecistite', 'colelitiase', 'coledoco', 'colangite', 'pancreatite', 'cpre', 'vesicula biliar'] },
  { cat: 'CIR', sub: 'Hérnias', kw: ['hernia'] },
  { cat: 'CIR', sub: 'Coloproctologia', kw: ['hemorroid', 'fissura anal', 'fistula perianal', 'colonoscopia', 'colorretal', 'polipo'] },
  { cat: 'CIR', sub: 'Pré e pós-operatório', kw: ['pos-operatorio', 'pre-operatorio', 'cicatrizacao', 'ileo', 'deiscencia', 'infeccao de sitio', 'antissepsia', 'assepsia'] },
  { cat: 'CIR', sub: 'Cirurgia vascular', kw: ['aneurisma', 'isquemia', 'tornozelo-braquial', 'varizes', 'trombose venosa'] },
  { cat: 'CIR', sub: 'Cirurgia do aparelho digestivo', kw: ['esofago', 'gastrectomia', 'gist', 'acalasia', 'hemorragia digestiva', 'varizes esofagicas'] },
  { cat: 'CIR', sub: 'Queimaduras', kw: ['queimadura', 'queimado', 'parkland'] },
  { cat: 'CIR', sub: 'Urologia', kw: ['escroto', 'escrotal', 'testiculo', 'torcao', 'prostata', 'litiase renal', 'calculo ureteral'] },
  // Preventiva
  { cat: 'PRE', sub: 'SUS e políticas de saúde', kw: ['sus', 'lei 8080', 'lei 8.080', 'lei 8142', 'conferencia', 'conselho de saude', 'atencao basica', 'pnab', 'estrategia saude da familia', 'esf'] },
  { cat: 'PRE', sub: 'Epidemiologia e estudos', kw: ['estudo de coorte', 'caso-controle', 'ensaio clinico', 'transversal', 'seccional', 'odds ratio', 'risco relativo', 'vies', 'incidencia', 'prevalencia'] },
  { cat: 'PRE', sub: 'Testes diagnósticos', kw: ['sensibilidade', 'especificidade', 'valor preditivo', 'curva roc'] },
  { cat: 'PRE', sub: 'Vigilância em saúde', kw: ['notificacao', 'sinan', 'vigilancia epidemiologica', 'surto', 'epidemia', 'endemia'] },
  { cat: 'PRE', sub: 'Saúde do trabalhador', kw: ['trabalhador', 'ocupacional', 'cat ', 'acidente de trabalho', 'ler/dort'] },
  { cat: 'PRE', sub: 'Indicadores de saúde', kw: ['mortalidade infantil', 'coeficiente', 'indicador', 'razao de mortalidade', 'anos de vida'] },
  { cat: 'PRE', sub: 'Medicina de família e comunidade', kw: ['medicina de familia', 'genograma', 'ecomapa', 'visita domiciliar', 'atencao domiciliar', 'prevencao quaternaria'] },
  // Clínica
  { cat: 'CLI', sub: 'Cardiologia', kw: ['insuficiencia cardiaca', 'infarto', 'sindrome coronariana', 'fibrilacao atrial', 'bloqueio', 'eletrocardiograma', 'ecg', 'hipertensao arterial', 'arritmia', 'endocardite'] },
  { cat: 'CLI', sub: 'Pneumologia', kw: ['dpoc', 'asma', 'pneumonia', 'tromboembolismo', 'derrame pleural', 'tuberculose', 'espirometria'] },
  { cat: 'CLI', sub: 'Endocrinologia', kw: ['diabete', 'diabetes', 'tireoide', 'hipotireoidismo', 'hipertireoidismo', 'cetoacidose', 'insulina', 'adrenal', 'cushing'] },
  { cat: 'CLI', sub: 'Nefrologia', kw: ['insuficiencia renal', 'lesao renal aguda', 'sindrome nefrotica', 'sindrome nefritica', 'dialise', 'glomerulo', 'potassio', 'hipercalemia', 'hiponatremia', 'acidose'] },
  { cat: 'CLI', sub: 'Gastroenterologia e hepatologia', kw: ['cirrose', 'hepatite', 'ascite', 'encefalopatia hepatica', 'doenca inflamatoria intestinal', 'crohn', 'retocolite', 'pancreatite cronica'] },
  { cat: 'CLI', sub: 'Infectologia', kw: ['hiv', 'meningite', 'sepse', 'dengue', 'leptospirose', 'antibiotico', 'sifilis', 'malaria', 'chikungunya'] },
  { cat: 'CLI', sub: 'Reumatologia', kw: ['lupus', 'artrite', 'gota', 'vasculite', 'espondilite', 'fan ', 'fator reumatoide'] },
  { cat: 'CLI', sub: 'Hematologia', kw: ['anemia', 'linfoma', 'leucemia', 'plaquetopenia', 'coagulacao', 'mieloma', 'hemoglobina'] },
  { cat: 'CLI', sub: 'Neurologia', kw: ['avc', 'acidente vascular', 'cefaleia', 'epilepsia', 'convulsao', 'parkinson', 'demencia', 'morte encefalica'] },
  { cat: 'CLI', sub: 'Emergências clínicas', kw: ['parada cardiorrespiratoria', 'reanimacao', 'intoxicacao', 'choque', 'animais peconhentos', 'escorpiao'] },
  { cat: 'CLI', sub: 'Geriatria', kw: ['idoso', 'polifarmacia', 'criterios de beers', 'fragilidade'] },
];

export interface Classification {
  category: CategoryId;
  subtopic: string;
  confidence: number; // 0..1
  scores: Record<CategoryId, number>;
}

export function classify(text: string, hint?: CategoryId): Classification {
  const t = ' ' + normalize(text) + ' ';
  const scores: Record<CategoryId, number> = { GO: 0, CLI: 0, CIR: 0, PRE: 0, PED: 0 };
  let best: { rule: Rule; hits: number } | null = null;
  for (const r of RULES) {
    let hits = 0;
    for (const k of r.kw) if (t.includes(k)) hits += k.length > 6 ? 2 : 1;
    if (!hits) continue;
    scores[r.cat] += hits;
    if (!best || hits > best.hits) best = { rule: r, hits };
  }
  // sinais demográficos ajudam a separar Pediatria/GO
  if (/\b(lactente|pre-escolar|escolar|crianca|menino|menina|adolescente)\b/.test(t)) scores.PED += 3;
  if (/\b(gii|giii|primigesta|gestante|puerpera|\d+ semanas)\b/.test(t)) scores.GO += 3;
  if (hint) scores[hint] += 4;
  const entries = Object.entries(scores) as [CategoryId, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const category = entries[0][1] > 0 ? entries[0][0] : hint ?? 'CLI';
  const total = entries.reduce((s, e) => s + e[1], 0) || 1;
  const subRule = RULES.filter((r) => r.cat === category)
    .map((r) => ({ r, hits: r.kw.filter((k) => t.includes(k)).length }))
    .sort((a, b) => b.hits - a.hits)[0];
  const subtopic = subRule && subRule.hits > 0 ? subRule.r.sub : best && best.rule.cat === category ? best.rule.sub : 'Geral';
  return { category, subtopic, confidence: clamp(entries[0][1] / total, 0, 1), scores };
}

/**
 * Estimativa de dificuldade: tamanho do enunciado, quantidade de dados
 * numéricos (exames), negativas/"exceto", especialização e (opcional)
 * taxa de acerto histórica dos jogadores.
 */
export function estimateDifficulty(text: string, alternatives: string[], historicalAccuracy?: { n: number; rate: number }): Difficulty {
  const t = normalize(text);
  let s = 0;
  const len = text.length + alternatives.join(' ').length;
  if (len > 1400) s += 1.4;
  else if (len > 900) s += 1;
  else if (len > 500) s += 0.5;
  const nums = (text.match(/\d+[.,]?\d*\s*(mg|mmhg|%|g\/dl|meq|mmol|ml|ui|cels|celulas|\/mm)/gi) ?? []).length;
  s += Math.min(1.2, nums * 0.2);
  if (/\b(exceto|incorreta|falsa|nao e)\b/.test(t)) s += 0.4;
  if (/(classificacao|criterio|escore|estadiamento|diretriz|consenso)/.test(t)) s += 0.4;
  const avgAlt = alternatives.reduce((a, b) => a + b.length, 0) / Math.max(1, alternatives.length);
  if (avgAlt > 110) s += 0.6;
  let d = s < 0.8 ? 1 : s < 1.7 ? 2 : s < 2.6 ? 3 : 4;
  if (historicalAccuracy && historicalAccuracy.n >= 10) {
    const r = historicalAccuracy.rate;
    const byData = r > 0.8 ? 1 : r > 0.6 ? 2 : r > 0.4 ? 3 : 4;
    d = Math.round((d + byData * 2) / 3);
  }
  return clamp(d, 1, 4) as Difficulty;
}

/** Subtema dentro de uma categoria já definida (mantém a categoria da prova). */
export function subtopicFor(text: string, cat: CategoryId): string {
  const t = ' ' + normalize(text) + ' ';
  const best = RULES.filter((r) => r.cat === cat)
    .map((r) => ({ r, hits: r.kw.filter((k) => t.includes(k)).length }))
    .sort((a, b) => b.hits - a.hits)[0];
  return best && best.hits > 0 ? best.r.sub : 'Geral';
}
