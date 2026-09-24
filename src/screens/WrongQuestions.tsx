import { useMemo, useState } from 'react';
import { CAT, CATEGORY_IDS, DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '../data/categories';
import { useStore } from '../state/store';
import { groupExams } from '../ui/ExamPicker';
import type { CategoryId, Question } from '../types';
import { Btn, Card, CatBadge, Empty, Header, Seg } from '../ui/common';
import { ExplanationModal } from '../ui/QuestionPlay';

export function WrongQuestions() {
  const store = useStore();
  const [cat, setCat] = useState<CategoryId | ''>('');
  const [sub, setSub] = useState('');
  const [diff, setDiff] = useState('');
  const [exam, setExam] = useState('');
  const [period, setPeriod] = useState<'all' | '7' | '30'>('all');
  const [onlyPending, setOnlyPending] = useState(false);
  const [open, setOpen] = useState<Question | null>(null);

  const rows = useMemo(() => {
    const lastWrong = new Map<string, number>();
    for (const a of store.answers) if (!a.correct) lastWrong.set(a.qid, Math.max(lastWrong.get(a.qid) ?? 0, a.at));
    const since = period === 'all' ? 0 : Date.now() - Number(period) * 86400_000;
    return [...lastWrong.entries()]
      .map(([qid, at]) => ({ q: store.qById.get(qid), at, h: store.history.get(qid)! }))
      .filter((r): r is { q: Question; at: number; h: NonNullable<typeof r.h> } => !!r.q)
      .filter((r) => (!cat || r.q.category === cat) && (!sub || r.q.subtopic === sub) && (!diff || String(r.q.difficulty) === diff) && (!exam || r.q.examId === exam) && r.at >= since && (!onlyPending || !r.h.lastCorrect))
      .sort((a, b) => b.at - a.at);
  }, [store.answers, store.qById, store.history, cat, sub, diff, exam, period, onlyPending]);

  const subs = useMemo(() => [...new Set(store.answers.filter((a) => !a.correct && (!cat || a.cat === cat)).map((a) => a.sub))].sort(), [store.answers, cat]);

  return (
    <div className="pb-10">
      <Header title="Minhas questões erradas" subtitle={`${rows.length} questão(ões)`} />
      <Card className="p-3 space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select className="input" value={cat} onChange={(e) => (setCat(e.target.value as CategoryId | ''), setSub(''))}>
            <option value="">Todas as categorias</option>
            {CATEGORY_IDS.map((c) => (
              <option key={c} value={c}>
                {CAT[c].name}
              </option>
            ))}
          </select>
          <select className="input" value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="">Todos os subtemas</option>
            {subs.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className="input" value={diff} onChange={(e) => setDiff(e.target.value)}>
            <option value="">Toda dificuldade</option>
            {[1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d as 1]}
              </option>
            ))}
          </select>
          <select className="input" value={exam} onChange={(e) => setExam(e.target.value)}>
            <option value="">Todas as provas</option>
            {groupExams(store.exams).map((g) => (
            <optgroup key={g.institution} label={g.institution}>
              {g.exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </optgroup>
          ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Seg value={period} onChange={setPeriod} options={[{ v: 'all', label: 'Sempre' }, { v: '30', label: '30 dias' }, { v: '7', label: '7 dias' }]} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-violet-500 w-4 h-4" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
            Só as que ainda não acertei
          </label>
        </div>
      </Card>

      {rows.length > 0 && (
        <Btn big variant="danger" className="w-full mt-3" onClick={() => store.nav({ name: 'trainingRun', config: { count: rows.length, categories: [], wrongOnly: false, questionIds: rows.map((r) => r.q.id) } })}>
          🔁 REFAZER QUESTÕES ERRADAS ({rows.length})
        </Btn>
      )}

      {rows.length === 0 ? (
        <Empty icon="🎯" text="Nenhuma questão errada com esses filtros." />
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map(({ q, at, h }) => (
            <Card key={q.id} className="p-3 cursor-pointer hover:border-white/25 transition" onClick={() => setOpen(q)}>
              <div className="flex items-center gap-2 flex-wrap">
                <CatBadge cat={q.category} small />
                <span className="text-xs text-white/60">{q.subtopic}</span>
                <span className="text-[11px]" style={{ color: DIFFICULTY_COLOR[q.difficulty] }}>
                  {DIFFICULTY_LABEL[q.difficulty]}
                </span>
                <span className="ml-auto text-[11px] text-white/40">
                  {q.institution} {q.year} · Q{q.number}
                </span>
              </div>
              <p className="text-sm text-white/80 mt-2 line-clamp-2">{q.text}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px]">
                <span className="text-rose-300">✖ errou {h.wrong}x</span>
                {h.correct > 0 && <span className="text-emerald-300">✔ acertou {h.correct}x</span>}
                <span className={h.lastCorrect ? 'text-emerald-300' : 'text-amber-300'}>{h.lastCorrect ? 'recuperada' : 'pendente'}</span>
                <span className="ml-auto text-white/40">{new Date(at).toLocaleDateString('pt-BR')}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {open && <ExplanationModal q={open} open onClose={() => setOpen(null)} />}
    </div>
  );
}
