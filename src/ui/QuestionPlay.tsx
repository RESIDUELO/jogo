import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { CAT, DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '../data/categories';
import { POWERUPS } from '../data/shop';
import { shuffle } from '../engine/util';
import type { Letter, PowerUpId, Question } from '../types';
import { altLetters } from '../types';
import { Btn, Modal } from './common';

export interface AnswerResult {
  chosen: Letter | null;
  correct: boolean;
  ms: number;
  msLimit: number;
  secondChance: boolean;
}

export interface Feedback {
  points: number;
  xp: number;
  streak: number;
  crownWon?: boolean;
  extra?: string;
}

interface Props {
  question: Question;
  limitMs: number;
  crown?: boolean;
  inventory?: Record<PowerUpId, number>;
  powerupsAllowed?: boolean;
  powerupsLeft?: number; // limite por partida (ranqueado)
  onUsePowerup?: (id: PowerUpId) => void;
  onSwap?: () => void;
  onAnswer: (r: AnswerResult) => void;
  feedback: Feedback | null;
  onContinue: () => void;
  continueLabel?: string;
  header?: React.ReactNode;
  readonly?: boolean; // revisão: sem timer
}

const CORRECT_MSGS = ['ACERTOU!', 'NA MOSCA!', 'DIAGNÓSTICO CERTEIRO!', 'MANDOU BEM!', 'CONDUTA CORRETA!'];
const WRONG_MSGS = ['ERROU!', 'QUASE!', 'NÃO FOI DESSA VEZ!'];
const WRONG_SUBS = ['Não deixe essa questão escapar novamente.', 'Ela vai voltar na sua revisão — anote o conceito.', 'Errar no jogo é melhor que errar na prova.'];

export function QuestionPlay(p: Props) {
  const q = p.question;
  const cat = CAT[q.category];
  const letters = useMemo(() => altLetters(q), [q]);
  const [limit, setLimit] = useState(p.limitMs);
  const [elapsed, setElapsed] = useState(0);
  const [eliminated, setEliminated] = useState<Letter[]>([]);
  const [chosen, setChosen] = useState<Letter | null>(null);
  const [firstWrong, setFirstWrong] = useState<Letter | null>(null);
  const [secondChanceArmed, setSecondChanceArmed] = useState(false);
  const [usedSecond, setUsedSecond] = useState(false);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [usedHere, setUsedHere] = useState<PowerUpId[]>([]);
  const [showFull, setShowFull] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [showOrig, setShowOrig] = useState(false);
  const t0 = useRef(performance.now());
  const lastSec = useRef(-1);
  const pickMsg = useRef(Math.random());
  const onAnswerRef = useRef(p.onAnswer);
  onAnswerRef.current = p.onAnswer;

  // reinicia ao trocar de questão
  useEffect(() => {
    setLimit(p.limitMs);
    setElapsed(0);
    setEliminated([]);
    setChosen(null);
    setFirstWrong(null);
    setSecondChanceArmed(false);
    setUsedSecond(false);
    setDone(false);
    setHint(null);
    setUsedHere([]);
    t0.current = performance.now();
    lastSec.current = -1;
    pickMsg.current = Math.random();
  }, [q.id, p.limitMs]);

  const finish = useCallback(
    (letter: Letter | null, second: boolean) => {
      const ms = Math.min(limit, performance.now() - t0.current);
      setDone(true);
      const correct = letter !== null && letter === q.answer;
      if (correct) sfx.correct();
      else if (letter === null) sfx.timeout();
      else sfx.wrong();
      onAnswerRef.current({ chosen: letter, correct, ms, msLimit: limit, secondChance: second });
    },
    [limit, q.answer],
  );

  // timer
  useEffect(() => {
    if (done || p.readonly) return;
    const id = setInterval(() => {
      const e = performance.now() - t0.current;
      setElapsed(e);
      const left = Math.ceil((limit - e) / 1000);
      if (left <= 5 && left > 0 && left !== lastSec.current) {
        lastSec.current = left;
        sfx.timeTick();
      }
      if (e >= limit) {
        clearInterval(id);
        finish(null, usedSecond);
      }
    }, 100);
    return () => clearInterval(id);
  }, [done, limit, finish, usedSecond, p.readonly]);

  const choose = useCallback(
    (l: Letter) => {
      if (done || eliminated.includes(l) || chosen) return;
      if (l !== q.answer && secondChanceArmed && !usedSecond) {
        sfx.wrong();
        setFirstWrong(l);
        setEliminated((e) => [...e, l]);
        setUsedSecond(true);
        setSecondChanceArmed(false);
        return;
      }
      setChosen(l);
      finish(l, usedSecond);
    },
    [done, eliminated, chosen, q.answer, secondChanceArmed, usedSecond, finish],
  );

  // teclado: A–E ou 1–5; Enter continua
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (showFull || zoom || showOrig) return;
      if (done && p.feedback && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        p.onContinue();
        return;
      }
      const k = e.key.toUpperCase();
      const idx = '12345'.indexOf(k);
      const l = (idx >= 0 ? letters[idx] : letters.find((x) => x === k)) as Letter | undefined;
      if (l && !done) choose(l);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [letters, choose, done, p, showFull, zoom, showOrig]);

  const wrongLetters = letters.filter((l) => l !== q.answer && !eliminated.includes(l));
  const canUse = (id: PowerUpId) =>
    !done && !p.readonly && p.powerupsAllowed !== false && (p.inventory?.[id] ?? 0) > 0 && !usedHere.includes(id) && (p.powerupsLeft === undefined || p.powerupsLeft > 0) && (id !== 'swap' || !!p.onSwap);

  const use = (id: PowerUpId) => {
    if (!canUse(id)) return;
    sfx.powerup();
    setUsedHere((u) => [...u, id]);
    p.onUsePowerup?.(id);
    if (id === 'fifty') setEliminated((e) => [...e, ...shuffle(wrongLetters).slice(0, 2)]);
    if (id === 'time') setLimit((l) => l + 15000);
    if (id === 'second') setSecondChanceArmed(true);
    if (id === 'hint') {
      const out = shuffle(wrongLetters)[0];
      if (out) setEliminated((e) => [...e, out]);
      setHint(`Tema: ${q.subtopic}.${out ? ` A alternativa ${out} não é a resposta.` : ''}`);
    }
    if (id === 'swap') p.onSwap?.();
  };

  const left = Math.max(0, limit - elapsed);
  const secs = Math.ceil(left / 1000);
  const pct = left / limit;
  const danger = secs <= 5 && !done;
  const timeout = done && chosen === null;
  const correct = done && chosen === q.answer;
  const fb = p.feedback;

  const altState = (l: Letter) => {
    if (!done) return eliminated.includes(l) ? 'elim' : 'idle';
    if (l === q.answer) return 'right';
    if (l === chosen || l === firstWrong) return 'wrong';
    return 'dim';
  };

  return (
    <div className="animate-slideIn">
      {p.header}
      {/* cabeçalho da questão */}
      <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl" style={{ background: `linear-gradient(160deg, ${cat.color}33, #1b1842 45%)` }}>
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="w-11 h-11 rounded-2xl grid place-items-center text-2xl shadow-lg" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.dark})` }}>
            {cat.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold tracking-wide flex items-center gap-2" style={{ color: cat.color }}>
              {cat.name}
              {p.crown && <span className="text-amber-300 animate-glow">👑 COROA</span>}
            </div>
            <div className="text-[11px] text-white/50 truncate">
              {q.institution} {q.year} · Q{q.number ?? '—'} ·{' '}
              <span style={{ color: DIFFICULTY_COLOR[q.difficulty] }}>{DIFFICULTY_LABEL[q.difficulty]}</span>
              {q.status !== 'ativa' && <span className="text-rose-300"> · {q.status.toUpperCase()}</span>}
            </div>
          </div>
          {!p.readonly && (
            <div className={`relative w-14 h-14 shrink-0 ${danger ? 'animate-shake' : ''}`} key={danger ? secs : 'ok'}>
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="#0b0a1f" stroke="#ffffff22" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#eab308' : '#ef4444'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 97.4} 97.4`}
                  style={{ transition: 'stroke-dasharray .1s linear' }}
                />
              </svg>
              <div className={`absolute inset-0 grid place-items-center font-display font-bold ${danger ? 'text-rose-400 text-lg' : 'text-[13px]'}`}>{done ? '✓' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</div>
            </div>
          )}
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="text-[15px] sm:text-base leading-relaxed text-white/95 whitespace-pre-line">{q.text}</p>
          {q.images?.map((img) => (
            <button key={img} onClick={() => setZoom(img)} className="mt-3 block w-full rounded-xl overflow-hidden bg-white border border-white/10">
              <img src={`${import.meta.env.BASE_URL}banco/img/${img}`} alt="Imagem da questão" className="w-full max-h-72 object-contain" loading="lazy" />
            </button>
          ))}
          {q.original?.length ? (
            <button onClick={() => setShowOrig(true)} className="mt-3 text-xs text-sky-300 underline">
              📄 ver questão original (PDF)
            </button>
          ) : null}
          {hint && <div className="mt-3 rounded-xl bg-amber-400/15 border border-amber-300/30 px-3 py-2 text-sm text-amber-100 animate-rise">💡 {hint}</div>}
          {secondChanceArmed && <div className="mt-3 rounded-xl bg-sky-400/15 border border-sky-300/30 px-3 py-2 text-sm text-sky-100">🔁 Segunda chance ativa: se errar, você tenta de novo.</div>}
          {firstWrong && !done && <div className="mt-3 rounded-xl bg-rose-400/15 border border-rose-300/30 px-3 py-2 text-sm text-rose-100 animate-shake">A alternativa {firstWrong} está errada. Tente de novo!</div>}
        </div>
      </div>

      {/* alternativas */}
      <div className="mt-3 grid gap-2">
        {letters.map((l, i) => {
          const st = altState(l);
          return (
            <button
              key={l}
              disabled={done || st === 'elim'}
              onClick={() => choose(l)}
              style={{ animationDelay: `${i * 50}ms` }}
              className={`alt animate-rise group text-left ${st === 'right' ? 'alt-right' : st === 'wrong' ? 'alt-wrong animate-shake' : st === 'dim' ? 'opacity-45' : st === 'elim' ? 'opacity-25 line-through' : 'hover:-translate-y-0.5 hover:border-violet-400/70'}`}
            >
              <span className={`alt-letter ${st === 'right' ? 'bg-emerald-400 text-emerald-950' : st === 'wrong' ? 'bg-rose-500 text-white' : ''}`}>{l}</span>
              <span className="flex-1 text-[14.5px] leading-snug">
                <AltContent q={q} l={l} />
              </span>
              {st === 'right' && <span className="text-xl">✔</span>}
              {st === 'wrong' && <span className="text-xl">✖</span>}
            </button>
          );
        })}
      </div>

      {/* power-ups */}
      {!done && !p.readonly && p.inventory && p.powerupsAllowed !== false && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {POWERUPS.map((pu) => {
            const n = p.inventory![pu.id] ?? 0;
            const ok = canUse(pu.id);
            return (
              <button
                key={pu.id}
                onClick={() => use(pu.id)}
                disabled={!ok}
                title={pu.desc}
                className={`relative rounded-xl px-3 py-2 text-xs font-semibold border transition ${ok ? 'bg-ink-700 border-white/15 hover:bg-ink-600 hover:-translate-y-0.5' : 'bg-ink-800 border-white/5 opacity-40'}`}
              >
                <span className="text-base mr-1">{pu.icon}</span>
                {pu.name}
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-violet-500 text-[10px] grid place-items-center">{n}</span>
              </button>
            );
          })}
          {p.powerupsLeft !== undefined && <div className="w-full text-center text-[11px] text-white/40">Ranqueado: {p.powerupsLeft} item(ns) restante(s) nesta partida</div>}
        </div>
      )}

      {/* feedback */}
      {done && fb && (
        <div className={`mt-4 rounded-3xl p-4 border animate-pop ${correct ? 'bg-emerald-500/15 border-emerald-400/40' : 'bg-rose-500/15 border-rose-400/40'}`}>
          <div className="flex items-start gap-3">
            <div className="text-4xl">{correct ? (fb.crownWon ? '👑' : '🎯') : timeout ? '⏰' : '💥'}</div>
            <div className="flex-1 min-w-0">
              <div className={`font-display text-2xl font-bold ${correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                {correct ? (fb.crownWon ? 'COROA CONQUISTADA!' : CORRECT_MSGS[Math.floor(pickMsg.current * CORRECT_MSGS.length)]) : timeout ? 'TEMPO ESGOTADO!' : WRONG_MSGS[Math.floor(pickMsg.current * WRONG_MSGS.length)]}
              </div>
              {correct ? (
                <div className="flex flex-wrap gap-2 mt-1 text-sm font-semibold">
                  <span className="text-amber-300">+{fb.points} pts</span>
                  <span className="text-violet-300">+{fb.xp} XP</span>
                  {fb.streak >= 2 && <span className="text-orange-300">STREAK x{fb.streak}</span>}
                  {fb.streak >= 4 && <span className="text-orange-400 animate-glow">🔥 VOCÊ ESTÁ EM CHAMAS!</span>}
                </div>
              ) : (
                <div className="text-sm mt-1 text-white/80">
                  A resposta correta era <b className="text-emerald-300">{q.answer}</b>. <span className="text-white/60">{WRONG_SUBS[Math.floor(pickMsg.current * WRONG_SUBS.length)]}</span>
                  {fb.xp > 0 && <span className="text-violet-300"> +{fb.xp} XP</span>}
                </div>
              )}
              {fb.extra && <div className="text-sm mt-1 text-amber-200">{fb.extra}</div>}
            </div>
          </div>
          <div className="mt-3 text-sm leading-relaxed text-white/85 bg-black/20 rounded-2xl p-3">
            <b>Resposta correta: {q.answer}.</b> {q.explanation}
          </div>
          {q.statusNote && <div className="mt-2 text-xs text-amber-200/80">⚠️ {q.statusNote}</div>}
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <Btn variant="ghost" className="flex-1" onClick={() => setShowFull(true)}>
              📖 VER EXPLICAÇÃO COMPLETA
            </Btn>
            <Btn variant={correct ? 'success' : 'primary'} className="flex-1" onClick={p.onContinue} autoFocus>
              {p.continueLabel ?? 'CONTINUAR'} ›
            </Btn>
          </div>
        </div>
      )}

      <ExplanationModal q={q} open={showFull} onClose={() => setShowFull(false)} chosen={chosen} />
      <OriginalModal q={q} open={showOrig} onClose={() => setShowOrig(false)} />
      <Modal open={!!zoom} onClose={() => setZoom(null)} wide title="Imagem da questão">
        {zoom && <img src={`${import.meta.env.BASE_URL}banco/img/${zoom}`} alt="" className="w-full rounded-xl bg-white" />}
      </Modal>
    </div>
  );
}

/** Conteúdo da alternativa: texto e/ou imagem (tabelas, gráficos). */
export function AltContent({ q, l }: { q: Question; l: Letter }) {
  const img = q.altImages?.[l];
  return (
    <>
      {q.alternatives[l]}
      {img && <img src={`${import.meta.env.BASE_URL}banco/img/${img}`} alt={`Alternativa ${l}`} className="mt-1 block w-full max-w-md rounded-lg bg-white" loading="lazy" />}
    </>
  );
}

export function OriginalModal({ q, open, onClose }: { q: Question; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={`Questão original — ${q.exam}, Q${q.number ?? ''}`} wide>
      <div className="space-y-2">
        {q.original?.map((o) => (
          <img key={o} src={`${import.meta.env.BASE_URL}banco/orig/${o}`} alt="Recorte da prova original" className="w-full rounded-xl bg-white" />
        ))}
        <p className="text-xs text-white/50">Recorte da página da prova em PDF, exatamente como foi aplicada.</p>
      </div>
    </Modal>
  );
}

export function ExplanationModal({ q, open, onClose, chosen }: { q: Question; open: boolean; onClose: () => void; chosen?: Letter | null }) {
  const letters = altLetters(q);
  return (
    <Modal open={open} onClose={onClose} title="Explicação completa" wide>
      <div className="space-y-4 text-sm leading-relaxed">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full px-2 py-1" style={{ background: CAT[q.category].color + '33', color: CAT[q.category].color }}>
            {CAT[q.category].icon} {CAT[q.category].full}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-1">{q.subtopic}</span>
          <span className="rounded-full px-2 py-1" style={{ background: DIFFICULTY_COLOR[q.difficulty] + '33', color: DIFFICULTY_COLOR[q.difficulty] }}>
            {DIFFICULTY_LABEL[q.difficulty]}
          </span>
        </div>
        <p className="text-white/80 whitespace-pre-line">{q.text}</p>
        {q.images?.map((img) => <img key={img} src={`${import.meta.env.BASE_URL}banco/img/${img}`} alt="" className="w-full max-h-80 object-contain rounded-xl bg-white" />)}
        <div className="grid gap-1.5">
          {letters.map((l) => (
            <div key={l} className={`rounded-xl px-3 py-2 border ${l === q.answer ? 'border-emerald-400/60 bg-emerald-500/10' : l === chosen ? 'border-rose-400/60 bg-rose-500/10' : 'border-white/10'}`}>
              <b>{l})</b> <AltContent q={q} l={l} /> {l === q.answer && '✔'}
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-violet-500/10 border border-violet-400/30 p-4">
          <div className="font-display font-bold text-violet-200 mb-1">Resposta: {q.answer ?? '—'}</div>
          <div className="whitespace-pre-line text-white/90">{q.explanationFull || q.explanation}</div>
        </div>
        {q.statusNote && <div className="rounded-xl bg-amber-400/10 border border-amber-300/30 p-3 text-amber-100">⚠️ {q.statusNote}</div>}
        {q.original?.length ? (
          <details className="rounded-xl bg-black/20 p-3">
            <summary className="cursor-pointer text-sky-300 text-xs">📄 Ver questão original (PDF)</summary>
            {q.original.map((o) => (
              <img key={o} src={`${import.meta.env.BASE_URL}banco/orig/${o}`} alt="Recorte da prova original" className="w-full mt-2 rounded-lg bg-white" loading="lazy" />
            ))}
          </details>
        ) : null}
        <div className="text-xs text-white/50 space-y-0.5">
          <div>
            Fonte: {q.exam} — questão {q.number ?? '—'}. Gabarito: oficial da prova.
          </div>
          {q.reference && <div>Referência: {q.reference}</div>}
          {q.explanationSource === 'gerada' && <div>Explicação elaborada para fins didáticos (não faz parte da prova oficial).</div>}
        </div>
      </div>
    </Modal>
  );
}
