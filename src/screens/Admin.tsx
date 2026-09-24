import { useMemo, useRef, useState } from 'react';
import { CAT, CATEGORY_IDS, DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '../data/categories';
import { classify, estimateDifficulty } from '../engine/classify';
import { csvToDrafts, jsonToQuestions } from '../engine/importers/structured';
import { parseExamText, parseRanges, type ImportDraft } from '../engine/importers/text';
import { rate } from '../engine/stats';
import { fmtPct } from '../engine/util';
import { pdfToText } from '../services/pdf';
import { useStore } from '../state/store';
import type { CategoryId, Difficulty, Letter, Question, QuestionStatus } from '../types';
import { LETTERS } from '../types';
import { Btn, Card, CatBadge, Header, Modal, Seg, Stat } from '../ui/common';
import { ExplanationModal } from '../ui/QuestionPlay';
import { EMPTY_FILTERS, FilterBar, QuestionRow, useFiltered, type BrowserFilters } from './Bank';
import { download } from './Settings';

type Tab = 'questoes' | 'importar' | 'estatisticas' | 'exportar';

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('questoes');
  return (
    <div className="pb-10">
      <Header title="Admin" subtitle="Banco de questões, importação e exportação" />
      <div className="mb-4 overflow-x-auto">
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { v: 'questoes', label: '📝 Questões' },
            { v: 'importar', label: '📥 Importar prova' },
            { v: 'estatisticas', label: '📊 Estatísticas' },
            { v: 'exportar', label: '📤 Exportar' },
          ]}
        />
      </div>
      {tab === 'questoes' && <AdminQuestions />}
      {tab === 'importar' && <ImportExam onDone={() => setTab('questoes')} />}
      {tab === 'estatisticas' && <AdminStats />}
      {tab === 'exportar' && <AdminExport />}
    </div>
  );
}

// ---------------------------------------------------------------- Questões
function AdminQuestions() {
  const store = useStore();
  const [f, setF] = useState<BrowserFilters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Question | null>(null);
  const [viewing, setViewing] = useState<Question | null>(null);
  const [confirmDel, setConfirmDel] = useState<Question | null>(null);
  const [limit, setLimit] = useState(40);
  const list = useFiltered(f);
  const subs = useMemo(() => [...new Set(store.questions.filter((q) => !f.cat || q.category === f.cat).map((q) => q.subtopic))].sort(), [store.questions, f.cat]);

  const blank = (): Question => ({
    id: `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
    text: '',
    alternatives: { A: '', B: '', C: '', D: '' },
    answer: 'A',
    category: 'CLI',
    subtopic: 'Geral',
    difficulty: 2,
    difficultySource: 'manual',
    examId: 'MANUAL',
    exam: 'Questões adicionadas manualmente',
    institution: 'Manual',
    year: new Date().getFullYear(),
    explanation: '',
    explanationSource: 'editada',
    status: 'ativa',
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-white/60">{list.length} questões</div>
        <Btn onClick={() => setEditing(blank())}>+ Nova questão</Btn>
      </div>
      <FilterBar f={f} set={(x) => (setF(x), setLimit(40))} subs={subs} />
      <div className="space-y-2 mt-3">
        {list.slice(0, limit).map((q) => (
          <QuestionRow
            key={q.id}
            q={q}
            onOpen={() => setViewing(q)}
            actions={
              <>
                <Btn variant="ghost" onClick={() => setEditing(q)}>
                  ✏️ Editar
                </Btn>
                <Btn variant="ghost" onClick={() => setConfirmDel(q)}>
                  🗑 Excluir
                </Btn>
              </>
            }
          />
        ))}
      </div>
      {list.length > limit && (
        <Btn variant="ghost" className="w-full mt-2" onClick={() => setLimit((l) => l + 60)}>
          Mostrar mais
        </Btn>
      )}
      {editing && (
        <QuestionEditor
          q={editing}
          onClose={() => setEditing(null)}
          onSave={async (q) => {
            await store.saveQuestion(q);
            setEditing(null);
          }}
        />
      )}
      {viewing && <ExplanationModal q={viewing} open onClose={() => setViewing(null)} />}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir questão?">
        <p className="text-white/70 mb-4">
          {confirmDel?.id} será removida do banco deste navegador. Dica: para tirar de jogo sem apagar, mude o status para “rascunho” ou “anulada”.
        </p>
        <div className="flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => setConfirmDel(null)}>
            Cancelar
          </Btn>
          <Btn
            variant="danger"
            className="flex-1"
            onClick={async () => {
              await store.deleteQuestion(confirmDel!.id);
              setConfirmDel(null);
            }}
          >
            Excluir
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

export function QuestionEditor({ q, onClose, onSave }: { q: Question; onClose: () => void; onSave: (q: Question) => void }) {
  const [d, setD] = useState<Question>({ ...q, alternatives: { ...q.alternatives } });
  const set = <K extends keyof Question>(k: K, v: Question[K]) => setD((x) => ({ ...x, [k]: v }));
  const letters = LETTERS.filter((l) => d.alternatives[l] !== undefined);
  const valid = d.text.trim() && letters.length >= 2 && (d.status === 'anulada' || (d.answer && d.alternatives[d.answer]?.trim()));
  return (
    <Modal open onClose={onClose} title={`Editar ${q.id}`} wide>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Field label="Categoria">
            <select className="input" value={d.category} onChange={(e) => set('category', e.target.value as CategoryId)}>
              {CATEGORY_IDS.map((c) => (
                <option key={c} value={c}>
                  {CAT[c].full}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Resposta">
            <select className="input" value={d.answer ?? ''} onChange={(e) => set('answer', (e.target.value || null) as Letter | null)}>
              <option value="">— (sem)</option>
              {letters.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Dificuldade">
            <select className="input" value={d.difficulty} onChange={(e) => setD((x) => ({ ...x, difficulty: Number(e.target.value) as Difficulty, difficultySource: 'manual' }))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {DIFFICULTY_LABEL[n as Difficulty]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={d.status} onChange={(e) => set('status', e.target.value as QuestionStatus)}>
              <option value="ativa">Ativa</option>
              <option value="anulada">Anulada</option>
              <option value="divergente">Divergente</option>
              <option value="rascunho">Rascunho</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Field label="Subtema">
            <input className="input" value={d.subtopic} onChange={(e) => set('subtopic', e.target.value)} />
          </Field>
          <Field label="Instituição">
            <input className="input" value={d.institution} onChange={(e) => set('institution', e.target.value)} />
          </Field>
          <Field label="Ano">
            <input className="input" type="number" value={d.year} onChange={(e) => set('year', Number(e.target.value))} />
          </Field>
          <Field label="Nº na prova">
            <input className="input" type="number" value={d.number ?? ''} onChange={(e) => set('number', e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </div>
        <Field label="Enunciado">
          <textarea className="input min-h-[120px]" value={d.text} onChange={(e) => set('text', e.target.value)} />
        </Field>
        {letters.map((l) => (
          <div key={l} className="flex gap-2 items-start">
            <span className={`mt-2 w-7 h-7 shrink-0 rounded-lg grid place-items-center font-bold ${d.answer === l ? 'bg-emerald-500' : 'bg-white/10'}`}>{l}</span>
            <textarea className="input min-h-[44px]" value={d.alternatives[l]} onChange={(e) => setD((x) => ({ ...x, alternatives: { ...x.alternatives, [l]: e.target.value } }))} />
          </div>
        ))}
        <div className="flex gap-2">
          {letters.length < 5 && (
            <Btn variant="ghost" onClick={() => setD((x) => ({ ...x, alternatives: { ...x.alternatives, [LETTERS[letters.length]]: '' } }))}>
              + alternativa
            </Btn>
          )}
          {letters.length > 2 && (
            <Btn
              variant="ghost"
              onClick={() =>
                setD((x) => {
                  const a = { ...x.alternatives };
                  delete a[letters[letters.length - 1]];
                  return { ...x, alternatives: a };
                })
              }
            >
              − alternativa
            </Btn>
          )}
          <Btn
            variant="ghost"
            onClick={() => {
              const c = classify(d.text + ' ' + Object.values(d.alternatives).join(' '));
              setD((x) => ({ ...x, category: c.category, subtopic: c.subtopic, difficulty: estimateDifficulty(x.text, Object.values(x.alternatives) as string[]), difficultySource: 'auto' }));
            }}
          >
            🤖 Classificar automaticamente
          </Btn>
        </div>
        <Field label="Explicação curta (aparece após responder)">
          <textarea className="input min-h-[60px]" value={d.explanation} onChange={(e) => setD((x) => ({ ...x, explanation: e.target.value, explanationSource: 'editada' }))} />
        </Field>
        <Field label="Explicação completa">
          <textarea className="input min-h-[100px]" value={d.explanationFull ?? ''} onChange={(e) => setD((x) => ({ ...x, explanationFull: e.target.value, explanationSource: 'editada' }))} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Referência">
            <input className="input" value={d.reference ?? ''} onChange={(e) => set('reference', e.target.value)} />
          </Field>
          <Field label="Observação de status (anulação/divergência)">
            <input className="input" value={d.statusNote ?? ''} onChange={(e) => set('statusNote', e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Btn variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn className="flex-1" disabled={!valid} onClick={() => onSave({ ...d, answer: d.status === 'anulada' ? d.answer : d.answer })}>
            💾 Salvar
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-white/50">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ---------------------------------------------------------------- Importação
type Source = 'pdf' | 'txt' | 'csv' | 'json';

function ImportExam({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const [source, setSource] = useState<Source>('pdf');
  const [institution, setInstitution] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [title, setTitle] = useState('');
  const [ranges, setRanges] = useState('1-20 CLI; 21-40 CIR; 41-60 PED; 61-80 GO; 81-100 PRE');
  const [answerKey, setAnswerKey] = useState('');
  const [text, setText] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<(ImportDraft & { explanation?: string; explanationFull?: string; reference?: string })[]>([]);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const examId = `${(institution || 'PROVA').toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${year}`;

  async function readFile(f: File) {
    setMsg('');
    if (!institution) setInstitution(f.name.replace(/\.[^.]+$/, '').split(/[-_ ]/)[0]);
    const y = f.name.match(/20\d\d/);
    if (y) setYear(Number(y[0]));
    if (source === 'pdf') {
      setProgress(0);
      try {
        const t = await pdfToText(f, setProgress);
        setText(t);
      } catch (e) {
        setMsg('Falha ao ler PDF: ' + e);
      }
      setProgress(null);
    } else setText(await f.text());
  }

  function analyze() {
    setMsg('');
    try {
      if (source === 'csv') setDrafts(csvToDrafts(text));
      else if (source === 'json') {
        const qs = jsonToQuestions(text);
        setDrafts(
          qs.map((q, i) => {
            const alts = q.alternatives ?? {};
            const cls = classify((q.text ?? '') + ' ' + Object.values(alts).join(' '));
            return {
              key: `j${i}`,
              number: q.number ?? i + 1,
              text: q.text ?? '',
              alternatives: alts,
              answer: q.answer ?? null,
              annulled: q.status === 'anulada',
              category: q.category ?? cls.category,
              subtopic: q.subtopic ?? cls.subtopic,
              difficulty: q.difficulty ?? estimateDifficulty(q.text ?? '', Object.values(alts) as string[]),
              confidence: q.category ? 1 : cls.confidence,
              warnings: [],
              approved: false,
              explanation: q.explanation,
              explanationFull: q.explanationFull,
              reference: q.reference,
              images: q.images,
            };
          }),
        );
      } else setDrafts(parseExamText(text, { answerKey: answerKey || undefined, ranges: parseRanges(ranges) }));
    } catch (e) {
      setMsg('Não foi possível analisar: ' + e);
    }
  }

  const upd = (key: string, patch: Partial<ImportDraft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const approved = drafts.filter((d) => d.approved);

  async function commit() {
    const exam = title || `${institution || 'Prova'} ${year}`;
    const qs: Question[] = approved.map((d) => ({
      id: `${examId}-${String(d.number).padStart(3, '0')}`,
      number: d.number,
      text: d.text,
      alternatives: d.alternatives,
      answer: d.answer,
      category: d.category,
      subtopic: d.subtopic,
      difficulty: d.difficulty,
      difficultySource: 'auto',
      examId,
      exam,
      institution: institution || 'Prova',
      year,
      explanation: d.explanation ?? 'Explicação ainda não cadastrada. Adicione no painel Admin.',
      explanationFull: d.explanationFull,
      explanationSource: d.explanation ? 'oficial' : undefined,
      reference: d.reference,
      images: d.images,
      status: d.annulled ? 'anulada' : !d.answer ? 'rascunho' : 'ativa',
      statusNote: d.annulled ? 'Questão anulada no gabarito oficial.' : undefined,
    }));
    await store.saveQuestions(qs);
    setMsg(`${qs.length} questões adicionadas ao banco (${examId}).`);
    setDrafts((ds) => ds.filter((d) => !d.approved));
    if (drafts.length === approved.length) setTimeout(onDone, 800);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-display font-semibold">1. Envie a prova</div>
        <Seg value={source} onChange={setSource} options={[{ v: 'pdf', label: 'PDF' }, { v: 'txt', label: 'TXT / colar texto' }, { v: 'csv', label: 'CSV' }, { v: 'json', label: 'JSON' }]} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input className="input" placeholder="Instituição (ex.: UNOESTE)" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          <input className="input" type="number" placeholder="Ano" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <input className="input col-span-2 sm:col-span-1" placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {(source === 'pdf' || source === 'txt') && (
          <>
            <input className="input" placeholder="Faixas de categoria (opcional): 1-20 CLI; 21-40 CIR..." value={ranges} onChange={(e) => setRanges(e.target.value)} />
            <textarea className="input min-h-[60px]" placeholder="Gabarito separado (opcional): 1-A 2-C 3-X ... (X = anulada). Se estiver no fim do PDF, é detectado automaticamente." value={answerKey} onChange={(e) => setAnswerKey(e.target.value)} />
          </>
        )}
        {source === 'csv' && <p className="text-xs text-white/50">Cabeçalho: numero, enunciado, a, b, c, d, e, resposta, categoria, subtema, dificuldade, explicacao, explicacao_completa, referencia (separador , ; ou TAB).</p>}
        {source === 'json' && <p className="text-xs text-white/50">Array de questões no formato do banco (veja public/banco/*.json) ou {'{ "questions": [...] }'}.</p>}
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={() => file.current?.click()}>
            📎 Escolher arquivo
          </Btn>
          <input
            ref={file}
            type="file"
            className="hidden"
            accept={source === 'pdf' ? 'application/pdf' : source === 'csv' ? '.csv,.tsv,.txt' : source === 'json' ? '.json' : '.txt'}
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          />
          {progress !== null && <span className="text-sm text-white/60 self-center">Lendo PDF… {Math.round(progress * 100)}%</span>}
        </div>
        <textarea className="input min-h-[140px] font-mono text-xs" placeholder="...ou cole aqui o texto da prova" value={text} onChange={(e) => setText(e.target.value)} />
        <Btn disabled={!text.trim()} onClick={analyze}>
          🔍 Analisar
        </Btn>
        {msg && <div className="text-sm text-amber-200">{msg}</div>}
      </Card>

      {drafts.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-display font-semibold">2. Revise ({drafts.length} detectadas)</div>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => setDrafts((ds) => ds.map((d) => ({ ...d, approved: d.warnings.length === 0 || !!d.answer })))}>
                Aprovar todas sem alerta
              </Btn>
              <Btn variant="success" disabled={!approved.length} onClick={commit}>
                ✔ Adicionar {approved.length} ao banco
              </Btn>
            </div>
          </div>
          <div className="space-y-2">
            {drafts.map((d) => (
              <DraftCard key={d.key} d={d} upd={upd} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DraftCard({ d, upd }: { d: ImportDraft; upd: (k: string, p: Partial<ImportDraft>) => void }) {
  const [open, setOpen] = useState(false);
  const letters = LETTERS.filter((l) => d.alternatives[l] !== undefined);
  return (
    <Card className={`p-3 ${d.approved ? 'border-emerald-400/50' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-display font-bold">QUESTÃO {d.number}</span>
        {d.annulled && <span className="text-[10px] rounded-full bg-rose-500/30 px-2 py-0.5">ANULADA</span>}
        {d.warnings.map((w) => (
          <span key={w} className="text-[10px] rounded-full bg-amber-400/20 text-amber-200 px-2 py-0.5">
            ⚠ {w}
          </span>
        ))}
        <span className="text-[10px] text-white/40 ml-auto">confiança da categoria: {Math.round(d.confidence * 100)}%</span>
      </div>
      <p className={`text-sm text-white/80 mt-1 ${open ? '' : 'line-clamp-2'} cursor-pointer`} onClick={() => setOpen(!open)}>
        {d.text || <i className="text-white/40">(enunciado vazio)</i>}
      </p>
      {open && (
        <div className="mt-1 space-y-0.5 text-xs text-white/70">
          {letters.map((l) => (
            <div key={l} className={l === d.answer ? 'text-emerald-300' : ''}>
              <b>{l})</b> {d.alternatives[l]}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 items-center">
        <select className="input !py-1.5" value={d.category} onChange={(e) => upd(d.key, { category: e.target.value as CategoryId })}>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c}>
              {CAT[c].name}
            </option>
          ))}
        </select>
        <select className="input !py-1.5" value={d.answer ?? ''} onChange={(e) => upd(d.key, { answer: (e.target.value || null) as Letter | null })}>
          <option value="">Resposta?</option>
          {letters.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className="input !py-1.5" value={d.difficulty} onChange={(e) => upd(d.key, { difficulty: Number(e.target.value) as Difficulty })}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {DIFFICULTY_LABEL[n as Difficulty]}
            </option>
          ))}
        </select>
        <input className="input !py-1.5" value={d.subtopic} onChange={(e) => upd(d.key, { subtopic: e.target.value })} />
        <Btn variant={d.approved ? 'success' : 'secondary'} onClick={() => upd(d.key, { approved: !d.approved })}>
          {d.approved ? '✔ APROVADA' : 'APROVAR'}
        </Btn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Estatísticas
function AdminStats() {
  const store = useStore();
  const qs = store.questions;
  const count = (fn: (q: Question) => boolean) => qs.filter(fn).length;
  const perQ = useMemo(() => {
    const m = new Map<string, { n: number; c: number; ms: number }>();
    store.answers.forEach((a) => {
      const x = m.get(a.qid) ?? { n: 0, c: 0, ms: 0 };
      x.n++;
      if (a.correct) x.c++;
      x.ms += a.ms;
      m.set(a.qid, x);
    });
    return [...m.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => rate(a[1]) - rate(b[1])).slice(0, 10);
  }, [store.answers]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Total" value={qs.length} />
        <Stat label="Ativas" value={count((q) => q.status === 'ativa')} color="#4ade80" />
        <Stat label="Anuladas" value={count((q) => q.status === 'anulada')} color="#f87171" />
        <Stat label="Divergentes/rascunho" value={count((q) => q.status === 'divergente' || q.status === 'rascunho')} color="#facc15" />
        <Stat label="Com imagem" value={count((q) => !!q.images?.length)} />
        <Stat label="Sem explicação" value={count((q) => !q.explanation || q.explanation.startsWith('Explicação ainda'))} />
        <Stat label="Editadas localmente" value={count((q) => !!q.updatedAt)} />
        <Stat label="Provas" value={store.exams.length} />
      </div>
      <Card className="p-4 overflow-x-auto">
        <div className="font-display font-semibold mb-2">Distribuição (categoria × dificuldade)</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/50 text-xs">
              <th className="text-left py-1">Categoria</th>
              {[1, 2, 3, 4].map((d) => (
                <th key={d} style={{ color: DIFFICULTY_COLOR[d as Difficulty] }}>
                  {DIFFICULTY_LABEL[d as Difficulty]}
                </th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_IDS.map((c) => (
              <tr key={c} className="border-t border-white/5 text-center">
                <td className="text-left py-1.5">
                  <CatBadge cat={c} small />
                </td>
                {[1, 2, 3, 4].map((d) => (
                  <td key={d}>{count((q) => q.category === c && q.difficulty === d)}</td>
                ))}
                <td className="font-bold">{count((q) => q.category === c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="p-4">
        <div className="font-display font-semibold mb-2">Questões com pior desempenho (seus dados locais)</div>
        {perQ.length === 0 && <p className="text-sm text-white/50">Sem dados suficientes (mín. 2 respostas por questão).</p>}
        {perQ.map(([id, v]) => {
          const q = store.qById.get(id);
          return (
            <div key={id} className="flex justify-between text-sm py-1 border-b border-white/5">
              <span className="truncate">
                {id} · {q?.subtopic}
              </span>
              <span className="text-rose-300 shrink-0">
                {fmtPct(rate(v))} ({v.n})
              </span>
            </div>
          );
        })}
        <p className="text-[11px] text-white/40 mt-2">O desempenho histórico também ajusta a estimativa de dificuldade ao reclassificar uma questão.</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Exportação
function toCsv(qs: Question[]) {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['id', 'numero', 'instituicao', 'ano', 'categoria', 'subtema', 'dificuldade', 'status', 'enunciado', 'a', 'b', 'c', 'd', 'e', 'resposta', 'explicacao', 'explicacao_completa', 'referencia'];
  const rows = qs.map((q) => [q.id, q.number, q.institution, q.year, q.category, q.subtopic, q.difficulty, q.status, q.text, q.alternatives.A, q.alternatives.B, q.alternatives.C, q.alternatives.D, q.alternatives.E, q.answer, q.explanation, q.explanationFull, q.reference].map(esc).join(','));
  return [head.join(','), ...rows].join('\n');
}

function AdminExport() {
  const store = useStore();
  const [exam, setExam] = useState('');
  const [confirm, setConfirm] = useState(false);
  const qs = store.questions.filter((q) => !exam || q.examId === exam);
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-display font-semibold">Exportar banco</div>
        <select className="input" value={exam} onChange={(e) => setExam(e.target.value)}>
          <option value="">Banco completo ({store.questions.length})</option>
          {store.exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} ({e.count})
            </option>
          ))}
        </select>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={() => download(`residuelo-banco-${exam || 'completo'}-${stamp}.json`, JSON.stringify({ exported: stamp, questions: qs }, null, 1))}>⬇️ JSON</Btn>
          <Btn variant="secondary" onClick={() => download(`residuelo-banco-${exam || 'completo'}-${stamp}.csv`, toCsv(qs), 'text/csv')}>
            ⬇️ CSV
          </Btn>
        </div>
        <p className="text-xs text-white/50">
          Para tornar edições permanentes no projeto, salve o JSON exportado de uma prova em <code>public/banco/</code> (substituindo o arquivo) e registre-o em <code>public/banco/index.json</code>.
        </p>
      </Card>
      <Card className="p-4 space-y-2">
        <div className="font-display font-semibold">Restaurar banco original</div>
        <p className="text-sm text-white/60">Descarta todas as edições, importações e exclusões feitas neste navegador.</p>
        <Btn variant="danger" onClick={() => setConfirm(true)}>
          Restaurar
        </Btn>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Restaurar banco?">
        <p className="text-white/70 mb-4">Isso não pode ser desfeito. Exporte antes se quiser guardar as edições.</p>
        <div className="flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
            Cancelar
          </Btn>
          <Btn
            variant="danger"
            className="flex-1"
            onClick={async () => {
              await store.resetBank();
              setConfirm(false);
            }}
          >
            Restaurar
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
