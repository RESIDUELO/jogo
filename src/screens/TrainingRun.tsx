import { useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { CAT } from '../data/categories';
import { COSMETIC } from '../data/shop';
import { matchRewards, scoreAnswer, timeLimitMs } from '../engine/scoring';
import { isPlayable, pickQuestion } from '../engine/selection';
import { uid } from '../engine/util';
import { useStore, type TrainingLaunch } from '../state/store';
import type { CategoryId, MatchSummary, PowerUpId, Question } from '../types';
import { Bar, Btn, Header, Modal } from '../ui/common';
import { Particles } from '../ui/Particles';
import { QuestionPlay, type AnswerResult, type Feedback } from '../ui/QuestionPlay';

export function TrainingRun({ config }: { config: TrainingLaunch }) {
  const store = useStore();
  const player = store.player!;
  const id = useRef(uid('t-'));
  const pool = useMemo(() => {
    let qs = store.questions.filter((q) => isPlayable(q, 'treino', player.settings.includeAnnulledInStudy));
    if (config.questionIds) {
      const set = new Set(config.questionIds);
      qs = store.questions.filter((q) => set.has(q.id) && q.answer);
    }
    if (config.categories.length) qs = qs.filter((q) => config.categories.includes(q.category));
    if (config.examId) qs = qs.filter((q) => q.examId === config.examId);
    return qs;
    // pool fixo durante o treino
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const total = config.count === 'inf' ? Infinity : Math.min(config.count, config.questionIds ? pool.length : config.count);
  const used = useRef(new Set<string>());
  const next = (): Question | undefined => {
    const q = pickQuestion(pool, store.history, { exclude: used.current, wrongOnly: config.wrongOnly && !config.questionIds });
    if (q) used.current.add(q.id);
    return q;
  };
  const [q, setQ] = useState<Question | undefined>(() => next());
  const [n, setN] = useState(1);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [stats, setStats] = useState({ correct: 0, answered: 0, ms: 0, points: 0, xp: 0, streak: 0, wrong: [] as string[], catCorrect: {} as Partial<Record<CategoryId, number>> });
  const [burst, setBurst] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const ended = useRef(false);

  function onAnswer(r: AnswerResult) {
    if (!q) return;
    const s = scoreAnswer({ correct: r.correct, difficulty: q.difficulty, msUsed: r.ms, msLimit: r.msLimit, streakBefore: stats.streak, secondChance: r.secondChance });
    store.recordAnswer({ qid: q.id, cat: q.category, sub: q.subtopic, diff: q.difficulty, correct: r.correct, chosen: r.chosen, ms: Math.round(r.ms), at: Date.now(), mode: 'treino', matchId: id.current }, s.xp);
    const streak = r.correct ? stats.streak + 1 : 0;
    setStats((st) => ({
      ...st,
      correct: st.correct + (r.correct ? 1 : 0),
      answered: st.answered + 1,
      ms: st.ms + r.ms,
      points: st.points + s.points,
      xp: st.xp + s.xp,
      streak,
      wrong: r.correct ? st.wrong : [...st.wrong, q.id],
      catCorrect: { ...st.catCorrect, [q.category]: (st.catCorrect[q.category] ?? 0) + (r.correct ? 1 : 0) },
    }));
    if (r.correct) setBurst((b) => b + 1);
    setFeedback({ points: s.points, xp: s.xp, streak });
  }

  function finish() {
    if (ended.current) return;
    ended.current = true;
    const rw = matchRewards({ mode: 'treino', result: 'treino', winStreak: 0, crowns: 0, correct: stats.correct, total: stats.answered });
    const summary: MatchSummary = {
      id: id.current,
      mode: 'treino',
      at: Date.now(),
      opponentName: 'Treino',
      opponentIsBot: false,
      result: 'treino',
      score: stats.points,
      oppScore: 0,
      crowns: 0,
      oppCrowns: 0,
      correct: stats.correct,
      total: stats.answered,
      avgMs: stats.answered ? stats.ms / stats.answered : 0,
      xp: rw.xp,
      coins: rw.coins,
      ratingDelta: 0,
      wrongIds: stats.wrong,
    };
    if (stats.answered > 0) store.finishMatch(summary);
    sfx.victory();
    store.nav({ name: 'result', summary, retrain: config });
  }

  function onContinue() {
    if (n >= total) return finish();
    const nq = next();
    if (!nq) return finish();
    setQ(nq);
    setN((x) => x + 1);
    setFeedback(null);
  }

  function usePowerup(pid: PowerUpId) {
    store.updatePlayer((p) => ({ ...p, inventory: { ...p.inventory, [pid]: Math.max(0, p.inventory[pid] - 1) } }));
  }

  if (!q) {
    return (
      <div>
        <Header title="Treino" />
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-white/70">Nenhuma questão disponível com esses filtros.</p>
          {config.wrongOnly && <p className="text-white/50 text-sm mt-1">Você ainda não tem questões erradas — ótimo sinal!</p>}
          <Btn className="mt-6" onClick={() => store.back()}>
            Voltar
          </Btn>
        </div>
      </div>
    );
  }

  const title = config.questionIds ? 'Revisão' : config.wrongOnly ? 'Refazendo erradas' : config.categories.length === 1 ? `Treino · ${CAT[config.categories[0] as CategoryId].name}` : 'Treino';

  return (
    <div className="pb-10">
      <Header
        title={title}
        subtitle={total === Infinity ? `Questão ${n} · treino infinito` : `Questão ${n} de ${total}`}
        right={
          <Btn variant="ghost" onClick={() => (stats.answered ? setConfirmEnd(true) : store.back())}>
            Encerrar
          </Btn>
        }
      />
      <div className="flex items-center gap-3 mb-4">
        <Bar pct={total === Infinity ? 1 : (n - (feedback ? 0 : 1)) / total} color="linear-gradient(90deg,#8b5cf6,#ec4899)" />
        <div className="shrink-0 text-sm font-semibold text-emerald-300">
          ✔ {stats.correct}/{stats.answered}
        </div>
        {stats.streak >= 2 && <div className="shrink-0 text-sm text-orange-300">🔥{stats.streak}</div>}
      </div>
      <QuestionPlay
        question={q}
        limitMs={timeLimitMs(q.text.length, player.settings.timerMode)}
        inventory={player.inventory}
        onUsePowerup={usePowerup}
        onSwap={() => {
          const nq = next();
          if (nq) setQ(nq);
        }}
        onAnswer={onAnswer}
        feedback={feedback}
        onContinue={onContinue}
        continueLabel={n >= total ? 'VER RESULTADO' : 'PRÓXIMA'}
      />
      <Particles burst={burst} color={COSMETIC[player.cosmetics.effect]?.value ?? 'multi'} count={50} />
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Encerrar treino?">
        <p className="text-white/70 mb-4">Você respondeu {stats.answered} questões. O progresso já foi salvo.</p>
        <div className="flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => setConfirmEnd(false)}>
            Continuar
          </Btn>
          <Btn className="flex-1" onClick={finish}>
            Ver resultado
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
