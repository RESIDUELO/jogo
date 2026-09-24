import { useMemo, useState } from 'react';
import { CAT, CATEGORY_IDS } from '../data/categories';
import { isPlayable } from '../engine/selection';
import { useStore } from '../state/store';
import type { CategoryId } from '../types';
import { Btn, Card, Header, Seg } from '../ui/common';
import { ExamPicker } from '../ui/ExamPicker';

export function TrainingSetup() {
  const store = useStore();
  const player = store.player!;
  const [count, setCount] = useState<number | 'inf'>(10);
  const [cats, setCats] = useState<CategoryId[]>([]);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [exams, setExams] = useState<string[]>([]);

  const available = useMemo(() => {
    return store.questions.filter(
      (q) =>
        isPlayable(q, 'treino', player.settings.includeAnnulledInStudy) &&
        (!cats.length || cats.includes(q.category)) &&
        (!exams.length || exams.includes(q.examId)) &&
        (!wrongOnly || (store.history.get(q.id)?.wrong ?? 0) > 0),
    ).length;
  }, [store.questions, cats, exams, wrongOnly, store.history, player.settings.includeAnnulledInStudy]);

  const toggle = (c: CategoryId) => setCats((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <div className="pb-10">
      <Header title="Modo Treino" subtitle="Jogue sozinho, no seu ritmo" />
      <Card className="p-4 space-y-5">
        <div>
          <div className="font-display font-semibold mb-2">Quantidade</div>
          <Seg
            value={count}
            onChange={setCount}
            options={[
              { v: 10, label: '10' },
              { v: 20, label: '20' },
              { v: 50, label: '50' },
              { v: 'inf', label: '∞ Infinito' },
            ]}
          />
        </div>
        <div>
          <div className="font-display font-semibold mb-2">Categorias</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCats([])} className={`rounded-xl px-3 py-2 text-sm font-semibold border ${!cats.length ? 'bg-violet-500 border-violet-400' : 'bg-black/20 border-white/10'}`}>
              🌈 Todas
            </button>
            {CATEGORY_IDS.map((c) => {
              const on = cats.includes(c);
              return (
                <button key={c} onClick={() => toggle(c)} className="rounded-xl px-3 py-2 text-sm font-semibold border transition" style={{ background: on ? CAT[c].color : 'rgba(0,0,0,.2)', borderColor: on ? CAT[c].color : 'rgba(255,255,255,.1)' }}>
                  {CAT[c].icon} {CAT[c].name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="font-display font-semibold mb-2">Provas</div>
          <ExamPicker selected={exams} onChange={setExams} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} className="w-5 h-5 accent-violet-500" />
          <span>
            <b>Somente questões que errei</b>
            <span className="block text-xs text-white/50">Revisão focada nas suas falhas</span>
          </span>
        </label>
        <div className="text-sm text-white/60">{available} questões disponíveis com esses filtros.</div>
        <Btn big className="w-full" disabled={!available} onClick={() => store.nav({ name: 'trainingRun', config: { count, categories: cats, wrongOnly, exams } })}>
          📚 COMEÇAR TREINO
        </Btn>
      </Card>
      <p className="text-xs text-white/40 mt-3 text-center">
        No treino, questões com gabarito divergente também aparecem (sinalizadas).{' '}
        {player.settings.includeAnnulledInStudy ? 'Questões anuladas estão incluídas (Ajustes).' : 'Questões anuladas ficam de fora (pode incluir em Ajustes).'}
      </p>
    </div>
  );
}
