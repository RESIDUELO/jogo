// Banco de questões: consultas ("quantas de Cirurgia?", "quais de trauma?",
// "quais de Clínica eu errei?", "quais nunca respondi?"...).
import { useMemo, useState } from 'react';
import { CAT, CATEGORY_IDS, DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '../data/categories';
import { normalize } from '../engine/util';
import { useStore } from '../state/store';
import type { CategoryId, Question, QuestionStatus } from '../types';
import { Bar, Btn, Card, CatBadge, Header } from '../ui/common';
import { ExplanationModal } from '../ui/QuestionPlay';

export type MyFilter = '' | 'respondidas' | 'nunca' | 'erradas' | 'acertadas';

export interface BrowserFilters {
  text: string;
  cat: CategoryId | '';
  exam: string;
  diff: string;
  status: QuestionStatus | '';
  mine: MyFilter;
  sub: string;
}

export const EMPTY_FILTERS: BrowserFilters = { text: '', cat: '', exam: '', diff: '', status: '', mine: '', sub: '' };

export function useFiltered(f: BrowserFilters) {
  const store = useStore();
  return useMemo(() => {
    const t = normalize(f.text.trim());
    return store.questions
      .filter((q) => {
        if (f.cat && q.category !== f.cat) return false;
        if (f.exam && q.examId !== f.exam) return false;
        if (f.diff && String(q.difficulty) !== f.diff) return false;
        if (f.status && q.status !== f.status) return false;
        if (f.sub && q.subtopic !== f.sub) return false;
        const h = store.history.get(q.id);
        if (f.mine === 'respondidas' && !h) return false;
        if (f.mine === 'nunca' && h) return false;
        if (f.mine === 'erradas' && !(h && h.wrong > 0)) return false;
        if (f.mine === 'acertadas' && !(h && h.correct > 0)) return false;
        if (t) {
          if (/^\d+$/.test(t)) return q.number === Number(t) || q.id.includes(t);
          const hay = normalize(q.text + ' ' + q.subtopic + ' ' + Object.values(q.alternatives).join(' ') + ' ' + (q.tags ?? []).join(' '));
          return t.split(/\s+/).every((w) => hay.includes(w));
        }
        return true;
      })
      .sort((a, b) => a.examId.localeCompare(b.examId) || (a.number ?? 0) - (b.number ?? 0));
  }, [store.questions, store.history, f]);
}

export function FilterBar({ f, set, subs }: { f: BrowserFilters; set: (f: BrowserFilters) => void; subs: string[] }) {
  const store = useStore();
  return (
    <div className="space-y-2">
      <input className="input" placeholder="🔎 Buscar: trauma, pré-eclâmpsia, insuficiência cardíaca, nº da questão..." value={f.text} onChange={(e) => set({ ...f, text: e.target.value })} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <select className="input" value={f.cat} onChange={(e) => set({ ...f, cat: e.target.value as CategoryId | '', sub: '' })}>
          <option value="">Categoria</option>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c}>
              {CAT[c].name}
            </option>
          ))}
        </select>
        <select className="input" value={f.sub} onChange={(e) => set({ ...f, sub: e.target.value })}>
          <option value="">Subtema</option>
          {subs.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={f.exam} onChange={(e) => set({ ...f, exam: e.target.value })}>
          <option value="">Prova</option>
          {store.exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <select className="input" value={f.diff} onChange={(e) => set({ ...f, diff: e.target.value })}>
          <option value="">Dificuldade</option>
          {[1, 2, 3, 4].map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d as 1]}
            </option>
          ))}
        </select>
        <select className="input" value={f.status} onChange={(e) => set({ ...f, status: e.target.value as QuestionStatus | '' })}>
          <option value="">Status</option>
          <option value="ativa">Ativa</option>
          <option value="anulada">Anulada</option>
          <option value="divergente">Divergente</option>
          <option value="rascunho">Rascunho</option>
        </select>
        <select className="input" value={f.mine} onChange={(e) => set({ ...f, mine: e.target.value as MyFilter })}>
          <option value="">Meu histórico</option>
          <option value="respondidas">Já respondi</option>
          <option value="nunca">Nunca respondi</option>
          <option value="erradas">Errei</option>
          <option value="acertadas">Acertei</option>
        </select>
      </div>
    </div>
  );
}

export function QuestionRow({ q, onOpen, actions }: { q: Question; onOpen: () => void; actions?: React.ReactNode }) {
  const store = useStore();
  const h = store.history.get(q.id);
  return (
    <div className="rounded-2xl bg-ink-800/70 border border-white/10 p-3 hover:border-white/25 transition">
      <div className="flex items-center gap-2 flex-wrap cursor-pointer" onClick={onOpen}>
        <span className="font-mono text-[11px] text-white/40">{q.id}</span>
        <CatBadge cat={q.category} small />
        <span className="text-xs text-white/70">{q.subtopic}</span>
        <span className="text-[11px]" style={{ color: DIFFICULTY_COLOR[q.difficulty] }}>
          {DIFFICULTY_LABEL[q.difficulty]}
        </span>
        {q.status !== 'ativa' && <span className="text-[10px] rounded-full bg-rose-500/25 text-rose-200 px-2 py-0.5 uppercase">{q.status}</span>}
        {q.images?.length ? <span className="text-[11px]">🖼️</span> : null}
        {h && <span className={`text-[11px] ml-auto ${h.lastCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>{h.lastCorrect ? '✔' : '✖'} {h.seen}x</span>}
      </div>
      <p className="text-sm text-white/80 mt-1.5 line-clamp-2 cursor-pointer" onClick={onOpen}>
        {q.text}
      </p>
      {actions && <div className="flex gap-2 mt-2 justify-end">{actions}</div>}
    </div>
  );
}

export function BankScreen() {
  const store = useStore();
  const [f, setF] = useState<BrowserFilters>(EMPTY_FILTERS);
  const [open, setOpen] = useState<Question | null>(null);
  const [limit, setLimit] = useState(40);
  const list = useFiltered(f);
  const subs = useMemo(() => [...new Set(store.questions.filter((q) => !f.cat || q.category === f.cat).map((q) => q.subtopic))].sort(), [store.questions, f.cat]);
  const topSubs = useMemo(() => {
    const m = new Map<string, { n: number; cat: CategoryId }>();
    store.questions.forEach((q) => m.set(q.subtopic, { n: (m.get(q.subtopic)?.n ?? 0) + 1, cat: q.category }));
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  }, [store.questions]);
  const byCat = CATEGORY_IDS.map((c) => ({ c, n: store.questions.filter((q) => q.category === c).length, active: store.questions.filter((q) => q.category === c && q.status === 'ativa').length }));
  const maxSub = topSubs[0]?.[1].n ?? 1;

  return (
    <div className="pb-10">
      <Header title="Banco de questões" subtitle={`${store.questions.length} questões · ${store.exams.length} provas`} />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {byCat.map(({ c, n, active }) => (
          <button key={c} onClick={() => setF({ ...EMPTY_FILTERS, cat: c })} className="rounded-2xl p-3 text-left border border-white/10 hover:-translate-y-0.5 transition" style={{ background: `linear-gradient(150deg, ${CAT[c].color}44, #1b1842)` }}>
            <div className="text-2xl">{CAT[c].icon}</div>
            <div className="font-display font-bold text-2xl">{n}</div>
            <div className="text-[11px] text-white/60">
              {CAT[c].name} · {active} ativas
            </div>
          </button>
        ))}
      </div>

      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-2">Assuntos que mais aparecem</div>
        <div className="space-y-1.5">
          {topSubs.map(([s, { n, cat }]) => (
            <button key={s} onClick={() => setF({ ...EMPTY_FILTERS, sub: s, cat })} className="w-full flex items-center gap-2 text-sm text-left hover:bg-white/5 rounded-lg px-1">
              <span className="w-44 sm:w-64 truncate" style={{ color: CAT[cat].color }}>
                {s}
              </span>
              <Bar pct={n / maxSub} color={CAT[cat].color} h="h-2" />
              <span className="w-8 text-right text-white/60">{n}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 mt-4">
        <div className="font-display font-semibold mb-2">Por prova</div>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {store.exams.map((e) => (
            <button key={e.id} onClick={() => setF({ ...EMPTY_FILTERS, exam: e.id })} className="flex justify-between rounded-xl bg-black/20 px-3 py-2 hover:bg-black/30">
              <span>{e.title}</span>
              <span className="text-white/50">{e.count}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-4">
        <FilterBar f={f} set={(x) => (setF(x), setLimit(40))} subs={subs} />
        <div className="flex items-center justify-between mt-3 mb-2">
          <div className="text-sm text-white/60">
            <b className="text-white">{list.length}</b> questão(ões) encontradas
          </div>
          {list.filter((q) => q.answer).length > 0 && (
            <Btn onClick={() => store.nav({ name: 'trainingRun', config: { count: Math.min(50, list.length), categories: [], wrongOnly: false, questionIds: list.filter((q) => q.answer).map((q) => q.id) } })}>📚 Treinar estas</Btn>
          )}
        </div>
        <div className="space-y-2">
          {list.slice(0, limit).map((q) => (
            <QuestionRow key={q.id} q={q} onOpen={() => setOpen(q)} />
          ))}
        </div>
        {list.length > limit && (
          <Btn variant="ghost" className="w-full mt-2" onClick={() => setLimit((l) => l + 60)}>
            Mostrar mais
          </Btn>
        )}
      </div>
      {open && <ExplanationModal q={open} open onClose={() => setOpen(null)} />}
    </div>
  );
}
