// Seleção de temas: grandes áreas + subtemas aninhados (caixas de seleção com 3 estados).
// A seleção é guardada de forma compacta: um nó totalmente marcado vira só a sua chave;
// lista vazia = todos os temas.
import { useMemo, useState } from 'react';
import { CAT } from '../data/categories';
import { buildTree, SEP, type TopicNode } from '../engine/cards';
import type { Flashcard } from '../types';

type Mark = 'all' | 'some' | 'none';

export function useTopicTree(cards: Flashcard[]) {
  return useMemo(() => {
    const tree = buildTree(cards).filter((n) => n.count > 0);
    // "unidades" = nós sem filhos (onde ficam os cartões)
    const units: string[] = [];
    const walk = (n: TopicNode) => (n.children.length ? n.children.forEach(walk) : units.push(n.key));
    tree.forEach(walk);
    return { tree, units };
  }, [cards]);
}

const under = (key: string, node: string) => key === node || key.startsWith(node + SEP);

/** Conjunto de unidades marcadas a partir da lista compacta. */
export function expandTopics(topics: string[], units: string[]): Set<string> {
  if (!topics.length) return new Set(units);
  return new Set(units.filter((u) => topics.some((t) => under(u, t) || under(t, u))));
}

/** Lista compacta a partir das unidades marcadas. */
function compress(sel: Set<string>, tree: TopicNode[], units: string[]): string[] {
  if (units.every((u) => sel.has(u))) return [];
  const out: string[] = [];
  const walk = (n: TopicNode) => {
    const mine = units.filter((u) => under(u, n.key));
    if (mine.length && mine.every((u) => sel.has(u))) out.push(n.key);
    else if (mine.some((u) => sel.has(u))) n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

export function TopicPicker({ cards, topics, onChange }: { cards: Flashcard[]; topics: string[]; onChange: (t: string[]) => void }) {
  const { tree, units } = useTopicTree(cards);
  const sel = useMemo(() => expandTopics(topics, units), [topics, units]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [warn, setWarn] = useState(false);

  const mark = (n: TopicNode): Mark => {
    const mine = units.filter((u) => under(u, n.key));
    const on = mine.filter((u) => sel.has(u)).length;
    return on === 0 ? 'none' : on === mine.length ? 'all' : 'some';
  };
  const toggle = (n: TopicNode) => {
    const next = new Set(sel);
    const mine = units.filter((u) => under(u, n.key));
    if (mark(n) === 'all') mine.forEach((u) => next.delete(u));
    else mine.forEach((u) => next.add(u));
    if (!next.size) {
      setWarn(true);
      return;
    }
    setWarn(false);
    onChange(compress(next, tree, units));
  };
  const only = (n: TopicNode) => {
    setWarn(false);
    onChange(compress(new Set(units.filter((u) => under(u, n.key))), tree, units));
  };
  const flip = (key: string) =>
    setOpen((o) => {
      const s = new Set(o);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });

  const selectedCards = useMemo(() => {
    let n = 0;
    const walk = (x: TopicNode) => (x.children.length ? x.children.forEach(walk) : sel.has(x.key) && (n += x.count));
    tree.forEach(walk);
    return n;
  }, [sel, tree]);

  const Row = ({ n }: { n: TopicNode }) => {
    const m = mark(n);
    const color = CAT[n.area].color;
    const isOpen = open.has(n.key);
    const root = n.depth === 0;
    return (
      <div>
        <div className={`flex items-center gap-2 rounded-xl ${root ? 'py-2 px-2 bg-black/25 border border-white/10' : 'py-1.5 px-1'}`}>
          <button
            aria-label={m === 'all' ? `Desmarcar ${n.label}` : `Marcar ${n.label}`}
            onClick={() => toggle(n)}
            className="w-6 h-6 shrink-0 rounded-md border-2 grid place-items-center text-sm font-bold"
            style={{ borderColor: m === 'none' ? 'rgba(255,255,255,.3)' : color, background: m === 'all' ? color : 'transparent', color: m === 'all' ? '#fff' : color }}
          >
            {m === 'all' ? '✓' : m === 'some' ? '–' : ''}
          </button>
          <button onClick={() => (n.children.length ? flip(n.key) : toggle(n))} className="flex-1 min-w-0 text-left flex items-center gap-2">
            {root && <span>{CAT[n.area].icon}</span>}
            <span className={`${root ? 'font-display font-semibold' : 'text-sm'} ${m === 'none' ? 'text-white/45' : ''} leading-snug`}>{root ? CAT[n.area].name : n.label}</span>
            <span className="text-[11px] text-white/40 shrink-0">{n.count}</span>
          </button>
          {root && (
            <button onClick={() => only(n)} className="text-[11px] text-white/45 hover:text-white px-1 shrink-0">
              só esta
            </button>
          )}
          {n.children.length > 0 && (
            <button onClick={() => flip(n.key)} aria-label={isOpen ? 'Recolher' : 'Ver subtemas'} className="w-7 h-7 shrink-0 grid place-items-center text-white/60 hover:text-white">
              <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
            </button>
          )}
        </div>
        {isOpen && (
          <div className="ml-4 pl-2 border-l border-white/10 mt-1">
            {n.children.map((c) => (
              <Row key={c.key} n={c} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-xs text-white/55">
          {topics.length ? `${selectedCards} de ${cards.length} flashcards` : `Todos os temas · ${cards.length} flashcards`}
        </div>
        {topics.length > 0 && (
          <button onClick={() => onChange([])} className="text-xs text-violet-300 hover:text-white underline">
            marcar tudo
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {tree.map((n) => (
          <Row key={n.key} n={n} />
        ))}
      </div>
      {warn && <p className="mt-2 text-xs text-amber-300">Deixe pelo menos um tema marcado.</p>}
    </div>
  );
}
