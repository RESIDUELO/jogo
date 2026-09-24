// Flashcards → perguntas do jogo. Árvore de temas (área › subtema › sub-subtema),
// filtro pelos temas escolhidos.
import { CATEGORY_IDS } from '../data/categories';
import type { CategoryId, Flashcard, MatchSetupData, Question } from '../types';

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

/** Transforma um flashcard em pergunta jogável (revelar a resposta e se autoavaliar). */
export function toQuestion(card: Flashcard): Question {
  return {
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
}

export const DEFAULT_SETUP: MatchSetupData = { topics: [], timeSec: 30, format: 'flash' };
export const TIME_OPTIONS = [15, 20, 30, 45, 60, 90, 120];
