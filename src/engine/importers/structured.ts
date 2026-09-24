// Importação de CSV e JSON.
import type { CategoryId, Difficulty, Letter, Question } from '../../types';
import { classify, estimateDifficulty } from '../classify';
import type { ImportDraft } from './text';

/** Parser CSV com aspas, separador , ; ou TAB. */
export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] ?? '';
  const sep = first.includes('\t') ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const CAT_ALIASES: Record<string, CategoryId> = {
  go: 'GO', ginecologia: 'GO', obstetricia: 'GO', 'ginecologia e obstetricia': 'GO',
  cli: 'CLI', clinica: 'CLI', 'clinica medica': 'CLI',
  cir: 'CIR', cirurgia: 'CIR',
  pre: 'PRE', preventiva: 'PRE', 'saude coletiva': 'PRE', 'medicina preventiva': 'PRE',
  ped: 'PED', pediatria: 'PED',
};

export function toCategory(s: string | undefined): CategoryId | undefined {
  if (!s) return undefined;
  const k = s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return CAT_ALIASES[k];
}

export function toDifficulty(s: string | number | undefined): Difficulty | undefined {
  if (s === undefined || s === '') return undefined;
  const n = Number(s);
  if (n >= 1 && n <= 4) return n as Difficulty;
  const k = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (k.startsWith('facil')) return 1;
  if (k.startsWith('media')) return 2;
  if (k.startsWith('muito')) return 4;
  if (k.startsWith('dificil')) return 3;
  return undefined;
}

/**
 * CSV com cabeçalho. Colunas reconhecidas (qualquer ordem):
 * numero, enunciado|texto|pergunta, a, b, c, d, e, resposta|gabarito,
 * categoria, subtema, dificuldade, explicacao, explicacao_completa, referencia
 */
export function csvToDrafts(text: string): ImportDraft[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const ci = {
    n: col('numero', 'n', 'id', 'number'),
    text: col('enunciado', 'texto', 'pergunta', 'questao', 'text'),
    a: col('a', 'alternativa a'),
    b: col('b', 'alternativa b'),
    c: col('c', 'alternativa c'),
    d: col('d', 'alternativa d'),
    e: col('e', 'alternativa e'),
    ans: col('resposta', 'gabarito', 'answer', 'correta'),
    cat: col('categoria', 'area', 'category'),
    sub: col('subtema', 'tema', 'subtopic'),
    diff: col('dificuldade', 'difficulty'),
    exp: col('explicacao', 'explanation'),
    full: col('explicacao_completa', 'explicacao completa', 'explanationfull'),
    ref: col('referencia', 'reference'),
  };
  return rows.slice(1).map((r, i) => {
    const get = (k: number) => (k >= 0 ? (r[k] ?? '').trim() : '');
    const alternatives: Partial<Record<Letter, string>> = {};
    (['a', 'b', 'c', 'd', 'e'] as const).forEach((l) => {
      const v = get(ci[l]);
      if (v) alternatives[l.toUpperCase() as Letter] = v;
    });
    const txt = get(ci.text);
    const ansRaw = get(ci.ans).toUpperCase();
    const cls = classify(txt, toCategory(get(ci.cat)));
    const d: ImportDraft & { explanation?: string; explanationFull?: string; reference?: string } = {
      key: `csv${i}`,
      number: Number(get(ci.n)) || i + 1,
      text: txt,
      alternatives,
      answer: /^[A-E]$/.test(ansRaw) ? (ansRaw as Letter) : null,
      annulled: ansRaw === 'X' || ansRaw === 'ANULADA',
      category: toCategory(get(ci.cat)) ?? cls.category,
      subtopic: get(ci.sub) || cls.subtopic,
      difficulty: toDifficulty(get(ci.diff)) ?? estimateDifficulty(txt, Object.values(alternatives) as string[]),
      confidence: toCategory(get(ci.cat)) ? 1 : cls.confidence,
      warnings: [],
      approved: false,
      explanation: get(ci.exp) || undefined,
      explanationFull: get(ci.full) || undefined,
      reference: get(ci.ref) || undefined,
    };
    if (!d.answer && !d.annulled) d.warnings.push('Sem resposta');
    if (Object.keys(alternatives).length < 4) d.warnings.push('Menos de 4 alternativas');
    return d;
  });
}

/** JSON: array de Question (formato do banco) ou { questions: [...] }. */
export function jsonToQuestions(text: string): Partial<Question>[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [];
  return arr as Partial<Question>[];
}
