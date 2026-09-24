// Flashcards → perguntas do jogo. Árvore de temas (área › subtema › sub-subtema),
// filtro pelos temas escolhidos e múltipla escolha automática.
import { CATEGORY_IDS } from '../data/categories';
import type { AnswerFormat, CategoryId, Flashcard, Letter, MatchSetupData, Question } from '../types';
import { LETTERS } from '../types';
import { hash01, normalize, seeded, shuffle } from './util';

export const SEP = '|';
export const cardKey = (c: Pick<Flashcard, 'area' | 'path'>) => [c.area, ...c.path].join(SEP);
export const topicLabel = (key: string) => key.split(SEP).slice(1).join(' › ');

/** O cartão pertence a algum dos temas escolhidos? (vazio = todos) */
export function inTopics(c: Pick<Flashcard, 'area' | 'path'>, topics: string[]): boolean {
  if (!topics.length) return true;
  const k = cardKey(c);
  return topics.some((t) => k === t || k.startsWith(t + SEP));
}

export interface TopicNode {
  key: string;
  label: string;
  area: CategoryId;
  depth: number;
  count: number; // cartões neste nó (incluindo os filhos)
  children: TopicNode[];
}

/** Árvore: uma raiz por área, com os subtemas aninhados. */
export function buildTree(cards: Flashcard[]): TopicNode[] {
  const roots = new Map<string, TopicNode>();
  const all = new Map<string, TopicNode>();
  for (const area of CATEGORY_IDS) {
    const n: TopicNode = { key: area, label: area, area, depth: 0, count: 0, children: [] };
    roots.set(area, n);
    all.set(area, n);
  }
  for (const c of cards) {
    let parent = roots.get(c.area)!;
    parent.count++;
    for (let d = 0; d < c.path.length; d++) {
      const key = [c.area, ...c.path.slice(0, d + 1)].join(SEP);
      let node = all.get(key);
      if (!node) {
        node = { key, label: c.path[d], area: c.area, depth: d + 1, count: 0, children: [] };
        all.set(key, node);
        parent.children.push(node);
      }
      node.count++;
      parent = node;
    }
  }
  const sort = (ns: TopicNode[]) => {
    ns.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    ns.forEach((n) => sort(n.children));
  };
  roots.forEach((r) => sort(r.children));
  return CATEGORY_IDS.map((a) => roots.get(a)!);
}

/** Áreas em disputa (as que têm cartões dentro dos temas escolhidos). */
export function setupAreas(setup: Pick<MatchSetupData, 'topics'>, cards?: Flashcard[]): CategoryId[] {
  const chosen = setup.topics.length ? CATEGORY_IDS.filter((a) => setup.topics.some((t) => t.split(SEP)[0] === a)) : CATEGORY_IDS;
  if (!cards) return chosen;
  const withCards = chosen.filter((a) => cards.some((c) => c.area === a && inTopics(c, setup.topics)));
  return withCards.length ? withCards : chosen;
}

const clean = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();

/** Distratores: versos de outros cartões, do tema mais próximo para o mais distante. */
function distractors(card: Flashcard, deck: Flashcard[], n: number): string[] {
  const rnd = seeded(Math.floor(hash01(card.id) * 1e9));
  const own = clean(card.back);
  const len = card.back.length;
  const tiers: Flashcard[][] = [];
  for (let d = card.path.length; d >= 0; d--) {
    const prefix = [card.area, ...card.path.slice(0, d)].join(SEP);
    tiers.push(deck.filter((c) => c.id !== card.id && (cardKey(c) === prefix || cardKey(c).startsWith(prefix + SEP))));
  }
  const out: string[] = [];
  const seen = new Set([own]);
  for (const tier of tiers) {
    // prefere respostas de tamanho parecido
    const cands = shuffle(tier, rnd).sort((a, b) => Math.abs(a.back.length - len) - Math.abs(b.back.length - len));
    for (const c of cands) {
      const k = clean(c.back);
      if (seen.has(k) || c.back.length > 220) continue;
      seen.add(k);
      out.push(c.back);
      if (out.length >= n) return out;
    }
  }
  return out;
}

/** Transforma um flashcard em pergunta jogável no formato pedido. */
export function toQuestion(card: Flashcard, format: AnswerFormat, deck: Flashcard[]): Question {
  const base: Question = {
    id: card.id,
    kind: 'flash',
    text: card.front,
    answerText: card.back,
    alternatives: {},
    answer: null,
    category: card.area,
    path: card.path,
    subtopic: card.path.join(' › ') || 'Geral',
    difficulty: 2,
    explanation: card.extra ? `${card.back}\n\n${card.extra}` : card.back,
    tags: card.tags,
    images: card.images,
  };
  if (format !== 'mc' || card.back.length > 220) return base;
  const wrong = distractors(card, deck, 3);
  if (wrong.length < 3) return base; // poucos cartões parecidos: vira flashcard clássico
  const rnd = seeded(Math.floor(hash01(card.id + '#pos') * 1e9));
  const options = shuffle([card.back, ...wrong], rnd);
  const alternatives: Partial<Record<Letter, string>> = {};
  options.forEach((o, i) => (alternatives[LETTERS[i]] = o));
  return { ...base, kind: 'mc', alternatives, answer: LETTERS[options.indexOf(card.back)] };
}

export const DEFAULT_SETUP: MatchSetupData = { topics: [], timeSec: 30, format: 'mc' };
export const TIME_OPTIONS = [15, 20, 30, 45, 60, 90, 120];
