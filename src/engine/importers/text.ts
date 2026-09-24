// Parser de provas em texto (TXT ou texto extraído de PDF).
// Detecta número da questão, enunciado, alternativas (A–E) e gabarito.
import type { CategoryId, Difficulty, Letter } from '../../types';
import { classify, estimateDifficulty } from '../classify';

export interface ImportDraft {
  key: string;
  number: number;
  text: string;
  alternatives: Partial<Record<Letter, string>>;
  answer: Letter | null;
  annulled: boolean;
  category: CategoryId;
  subtopic: string;
  difficulty: Difficulty;
  confidence: number;
  warnings: string[];
  approved: boolean;
  images?: string[];
}

const Q_START = /^\s*(?:quest[aã]o\s*)?(\d{1,3})\s*(?:\)|\.|-|–|:)\s*(.*)$/i;
const ALT = /^\s*\(?([A-Ea-e])\s*(?:\)|\.|-|–)\s*(.*)$/;

function joinLines(lines: string[]): string {
  let out = '';
  for (const l of lines) {
    if (out.endsWith('-') && !out.endsWith(' -')) out += l;
    else out = out ? out + ' ' + l : l;
  }
  return out.replace(/\s+/g, ' ').replace(/(\w)- ([a-zà-ú])/g, '$1$2').trim();
}

/** Lê o gabarito em vários formatos: "1-A 2-B", "1) A", grade "1 11 21 ... A C D ...". X/* = anulada. */
export function parseAnswerKey(text: string): Map<number, Letter | 'X'> {
  const map = new Map<number, Letter | 'X'>();
  const tokens = text.match(/\b(\d{1,3}|[A-EX])\b|\*/g) ?? [];
  // grade: 10 números em PA de razão 10 seguidos de 10 letras
  for (let i = 0; i + 20 <= tokens.length; i++) {
    const nums = tokens.slice(i, i + 10);
    const lets = tokens.slice(i + 10, i + 20);
    if (nums.every((n) => /^\d+$/.test(n)) && lets.every((l) => /^[A-EX*]$/.test(l))) {
      const n0 = nums.map(Number);
      if (n0.every((n, k) => n === n0[0] + 10 * k)) {
        n0.forEach((n, k) => map.set(n, (lets[k] === '*' ? 'X' : lets[k]) as Letter | 'X'));
        i += 19;
      }
    }
  }
  // pares "12 - C", "12) C", "12.C", "12 C"
  const re = /\b(\d{1,3})\s*[-–).:]?\s*([A-EX])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (!map.has(n)) map.set(n, m[2] as Letter | 'X');
  }
  return map;
}

export interface ParseOptions {
  answerKey?: string; // texto do gabarito, se separado
  ranges?: { from: number; to: number; cat: CategoryId }[]; // faixas de categoria
}

export function parseRanges(s: string): { from: number; to: number; cat: CategoryId }[] {
  // formato: "1-20 CLI; 21-40 CIR; 41-60 PED"
  const out: { from: number; to: number; cat: CategoryId }[] = [];
  const re = /(\d+)\s*-\s*(\d+)\s*[:=]?\s*(GO|CLI|CIR|PRE|PED)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push({ from: +m[1], to: +m[2], cat: m[3].toUpperCase() as CategoryId });
  return out;
}

export function parseExamText(raw: string, opts: ParseOptions = {}): ImportDraft[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // gabarito embutido no fim ("GABARITO")
  let keyText = opts.answerKey ?? '';
  const gi = lines.findIndex((l) => /^gabarito\b/i.test(l));
  if (gi >= 0 && !opts.answerKey) {
    // gabarito costuma estar no fim; em grade, o título pode vir depois dos dados
    const after = lines.slice(gi).join(' ');
    const tail = lines.slice(Math.max(0, gi - 220), gi).join(' ');
    keyText = tail + ' ' + after;
  }
  const key = parseAnswerKey(keyText);

  type Cur = { n: number; stem: string[]; alts: Partial<Record<Letter, string[]>>; part: 'stem' | Letter };
  const qs: Cur[] = [];
  let cur: Cur | null = null;
  let expect = 1;
  for (const l of lines) {
    const q = Q_START.exec(l);
    if (q && Number(q[1]) === expect) {
      cur = { n: expect, stem: q[2] ? [q[2]] : [], alts: {}, part: 'stem' };
      qs.push(cur);
      expect++;
      continue;
    }
    if (!cur) continue;
    const a = ALT.exec(l);
    const nextLetter = 'ABCDE'[Object.keys(cur.alts).length] as Letter | undefined;
    if (a && nextLetter && a[1].toUpperCase() === nextLetter && (cur.part !== 'stem' || cur.stem.length > 0)) {
      cur.part = nextLetter;
      cur.alts[nextLetter] = [a[2]];
      continue;
    }
    if (/^gabarito\b/i.test(l)) {
      cur = null;
      continue;
    }
    if (cur.part === 'stem') cur.stem.push(l);
    else cur.alts[cur.part]!.push(l);
  }

  return qs.map((c) => {
    const alternatives: Partial<Record<Letter, string>> = {};
    for (const [k, v] of Object.entries(c.alts)) alternatives[k as Letter] = joinLines(v!);
    const text = joinLines(c.stem);
    const k = key.get(c.n);
    const range = opts.ranges?.find((r) => c.n >= r.from && c.n <= r.to);
    const cls = classify(text + ' ' + Object.values(alternatives).join(' '), range?.cat);
    const warnings: string[] = [];
    const nAlt = Object.keys(alternatives).length;
    if (nAlt < 4) warnings.push(`Apenas ${nAlt} alternativas detectadas`);
    if (!k) warnings.push('Resposta não encontrada no gabarito');
    if (k === 'X') warnings.push('Questão ANULADA no gabarito');
    if (text.length < 15) warnings.push('Enunciado muito curto — verifique');
    if (/(imagem|figura|a seguir|abaixo|ilustra)/i.test(text)) warnings.push('Pode depender de imagem/tabela');
    return {
      key: `n${c.n}`,
      number: c.n,
      text,
      alternatives,
      answer: k && k !== 'X' ? k : null,
      annulled: k === 'X',
      category: cls.category,
      subtopic: cls.subtopic,
      difficulty: estimateDifficulty(text, Object.values(alternatives) as string[]),
      confidence: range ? 1 : cls.confidence,
      warnings,
      approved: false,
    };
  });
}
