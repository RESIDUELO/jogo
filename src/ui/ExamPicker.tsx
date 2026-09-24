// Seleção de provas por faculdade → anos. Lista vazia = todas as provas.
import { useMemo } from 'react';
import { sfx } from '../audio/sfx';
import { useStore } from '../state/store';
import type { ExamMeta } from '../types';

export function groupExams(exams: ExamMeta[]) {
  const map = new Map<string, ExamMeta[]>();
  for (const e of exams) {
    if (!map.has(e.institution)) map.set(e.institution, []);
    map.get(e.institution)!.push(e);
  }
  return [...map.entries()].map(([institution, list]) => ({ institution, exams: list.sort((a, b) => a.year - b.year) }));
}

/** Texto curto do que está selecionado (ex.: "UNOESTE 2023–2024 · FAMERP 2023"). */
export function describeExams(selected: string[], exams: ExamMeta[]): string {
  if (!selected.length) return 'Todas as provas';
  return groupExams(exams)
    .map((g) => {
      const yrs = g.exams.filter((e) => selected.includes(e.id)).map((e) => e.year);
      if (!yrs.length) return '';
      const label = g.institution.split('/')[0];
      return yrs.length === g.exams.length ? `${label} (todos os anos)` : `${label} ${yrs.join(', ')}`;
    })
    .filter(Boolean)
    .join(' · ');
}

export function ExamPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { exams } = useStore();
  const groups = useMemo(() => groupExams(exams), [exams]);
  const set = (ids: string[]) => {
    sfx.click();
    onChange(ids.length === exams.length ? [] : ids);
  };
  const toggleInst = (ids: string[]) => {
    const any = ids.some((id) => selected.includes(id));
    set(any ? selected.filter((id) => !ids.includes(id)) : [...selected, ...ids]);
  };
  const toggleExam = (id: string) => set(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const chip = (on: boolean) =>
    `rounded-xl px-3 py-2 text-sm font-semibold border transition ${on ? 'bg-violet-500 border-violet-400 text-white' : 'bg-black/25 border-white/10 text-white/70 hover:text-white'}`;

  return (
    <div className="space-y-2">
      <button className={chip(!selected.length)} onClick={() => set([])}>
        📚 Todas as provas
      </button>
      {groups.map((g) => {
        const ids = g.exams.map((e) => e.id);
        const n = ids.filter((id) => selected.includes(id)).length;
        return (
          <div key={g.institution} className={`rounded-2xl border p-2.5 transition ${n ? 'border-violet-400/50 bg-violet-500/10' : 'border-white/10 bg-black/15'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => toggleInst(ids)} className={`${chip(n > 0)} min-w-[110px] text-left`}>
                {n === ids.length ? '☑' : n ? '◩' : '☐'} {g.institution.split('/')[0]}
              </button>
              {g.exams.map((e) => (
                <button key={e.id} onClick={() => toggleExam(e.id)} className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold border transition ${selected.includes(e.id) ? 'bg-violet-400/80 border-violet-300 text-white' : 'bg-black/20 border-white/10 text-white/60'}`}>
                  {e.year}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
