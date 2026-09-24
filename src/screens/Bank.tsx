// Baralho: navegar pelos flashcards (área › subtemas), buscar e virar cartões.
import { useMemo, useState } from 'react';
import { CAT } from '../data/categories';
import { cardKey, SEP, type TopicNode } from '../engine/cards';
import { normalize } from '../engine/util';
import { useStore } from '../state/store';
import type { Flashcard } from '../types';
import { Btn, Card, Header, Seg } from '../ui/common';
import { IMG_BASE } from '../ui/QuestionPlay';
import { useTopicTree } from '../ui/TopicPicker';

type Mine = '' | 'nunca' | 'erradas' | 'acertadas';
const PAGE = 40;

export function BankScreen() {
  const store = useStore();
  const { tree } = useTopicTree(store.cards);
  const [path, setPath] = useState<string>(''); // chave do nó aberto ('' = raiz)
  const [text, setText] = useState('');
  const [mine, setMine] = useState<Mine>('');
  const [limit, setLimit] = useState(PAGE);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  const node = useMemo(() => {
    if (!path) return null;
    let found: TopicNode | null = null;
    const walk = (n: TopicNode) => (n.key === path ? (found = n) : n.children.forEach(walk));
    tree.forEach(walk);
    return found as TopicNode | null;
  }, [path, tree]);
  const children = node ? node.children : tree;
  const crumbs = path ? path.split(SEP).map((_, i, a) => a.slice(0, i + 1).join(SEP)) : [];

  const list = useMemo(() => {
    const t = normalize(text.trim());
    return store.cards.filter((c) => {
      if (path) {
        const k = cardKey(c);
        if (k !== path && !k.startsWith(path + SEP)) return false;
      }
      const h = store.history.get(c.id);
      if (mine === 'nunca' && h) return false;
      if (mine === 'erradas' && !(h && h.wrong > 0)) return false;
      if (mine === 'acertadas' && !(h && h.lastCorrect)) return false;
      return !t || normalize(c.front + ' ' + c.back).includes(t);
    });
  }, [store.cards, store.history, path, text, mine]);

  const go = (key: string) => {
    setPath(key);
    setLimit(PAGE);
  };
  const flip = (id: string) =>
    setFlipped((f) => {
      const s = new Set(f);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  return (
    <div className="pb-10">
      <Header title="Baralho" subtitle={`${store.cards.length} flashcards`} />

      <Card className="p-3 space-y-3">
        <input className="input" placeholder="🔎 Buscar na frente ou no verso..." value={text} onChange={(e) => (setText(e.target.value), setLimit(PAGE))} />
        <Seg
          value={mine}
          onChange={(v) => (setMine(v), setLimit(PAGE))}
          options={[
            { v: '', label: 'Todos' },
            { v: 'nunca', label: 'Nunca vi' },
            { v: 'erradas', label: 'Errei' },
            { v: 'acertadas', label: 'Acertei' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button onClick={() => go('')} className={`underline-offset-2 ${path ? 'text-violet-300 underline' : 'font-semibold'}`}>
            Todas as áreas
          </button>
          {crumbs.map((k, i) => (
            <span key={k} className="flex items-center gap-1">
              <span className="text-white/30">›</span>
              <button onClick={() => go(k)} className={i < crumbs.length - 1 ? 'text-violet-300 underline underline-offset-2' : 'font-semibold'}>
                {i === 0 ? `${CAT[k as keyof typeof CAT].icon} ${CAT[k as keyof typeof CAT].name}` : k.split(SEP)[i]}
              </button>
            </span>
          ))}
        </div>
        {children.length > 0 && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {children.map((n) => (
              <button
                key={n.key}
                onClick={() => go(n.key)}
                className="flex items-center gap-2 rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-left hover:border-white/30"
                style={{ borderLeft: `4px solid ${CAT[n.area].color}` }}
              >
                <span className="flex-1 min-w-0 text-sm leading-snug">{n.depth === 0 ? `${CAT[n.area].icon} ${CAT[n.area].name}` : n.label}</span>
                <span className="text-[11px] text-white/45 shrink-0">{n.count}</span>
                {n.children.length > 0 && <span className="text-white/40">›</span>}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between gap-2 mt-4 mb-2">
        <div className="text-sm text-white/60">{list.length} cartões · toque para virar</div>
        {list.length > 0 && (
          <Btn onClick={() => store.nav({ name: 'trainingRun', config: { count: Math.min(50, list.length), categories: [], wrongOnly: false, questionIds: list.map((c) => c.id), format: 'flash', timeSec: 60 } })}>
            📚 Treinar estes
          </Btn>
        )}
      </div>
      <div className="space-y-2">
        {list.slice(0, limit).map((c) => (
          <FlashRow key={c.id} c={c} open={flipped.has(c.id)} onFlip={() => flip(c.id)} showPath={!node || node.children.length > 0} />
        ))}
      </div>
      {list.length > limit && (
        <div className="text-center mt-3">
          <Btn variant="secondary" onClick={() => setLimit((l) => l + PAGE * 2)}>
            Mostrar mais ({list.length - limit})
          </Btn>
        </div>
      )}
    </div>
  );
}

function FlashRow({ c, open, onFlip, showPath }: { c: Flashcard; open: boolean; onFlip: () => void; showPath: boolean }) {
  const store = useStore();
  const h = store.history.get(c.id);
  return (
    <Card className="p-3 cursor-pointer hover:border-white/25 transition" onClick={onFlip}>
      {showPath && (
        <div className="text-[11px] mb-1" style={{ color: CAT[c.area].color }}>
          {CAT[c.area].icon} {c.path.join(' › ')}
        </div>
      )}
      <p className="text-sm text-white/90 whitespace-pre-line">{c.front}</p>
      {open && (
        <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-400/20 p-2 text-sm whitespace-pre-line animate-pop">
          {c.back}
          {c.extra && <div className="mt-1 text-white/60">{c.extra}</div>}
          {c.images?.map((img) => <img key={img} src={IMG_BASE + img} alt="" className="mt-2 max-h-60 rounded-lg bg-white" loading="lazy" />)}
        </div>
      )}
      {h && (
        <div className="mt-1.5 flex gap-3 text-[11px]">
          {h.correct > 0 && <span className="text-emerald-300">✔ {h.correct}x</span>}
          {h.wrong > 0 && <span className="text-rose-300">✖ {h.wrong}x</span>}
        </div>
      )}
    </Card>
  );
}
