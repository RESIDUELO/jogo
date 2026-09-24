// Partida PvP online. O estado da partida (MatchState do motor) fica no servidor;
// só o jogador da vez grava (controle de versão otimista) e o adversário
// acompanha em tempo real: giro da roleta, questão e resultado.
import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { COSMETIC } from '../data/shop';
import { eloDelta } from '../engine/elo';
import { advance, applyAnswer, applyCrownChoice, applySpin, createMatch, forfeit, lastSpunCat, setQuestion, setupCats, type Competitor, type MatchState } from '../engine/match';
import { matchPool, reportOf } from '../engine/matchUtils';
import { setupAreas } from '../engine/cards';
import { levelFromXp } from '../engine/progression';
import { matchRewards, scoreAnswer } from '../engine/scoring';
import { pickQuestion } from '../engine/selection';
import { spinCategory } from '../engine/util';
import type { OnlineMatchRow } from '../services/online';
import { useOnline } from '../state/online';
import { useStore } from '../state/store';
import type { CategoryId, MatchSummary, Question } from '../types';
import { Btn, Empty, Modal } from '../ui/common';
import { CrownChoice, MatchHud, OpponentTurnCard, Overlays, type OpponentView, type Overlay } from '../ui/MatchParts';
import { Particles } from '../ui/Particles';
import { QuestionPlay, type AnswerResult, type Feedback } from '../ui/QuestionPlay';
import { Wheel } from '../ui/Wheel';

const INACTIVE_MARGIN_MS = 60_000; // tempo da rodada + margem

export function OnlineMatchScreen({ matchId }: { matchId: string }) {
  const store = useStore();
  const { backend, account } = useOnline();
  const me = store.player!;
  const [row, setRow] = useState<OnlineMatchRow | null>(null);
  const rowRef = useRef<OnlineMatchRow | null>(null);
  const [err, setErr] = useState('');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [spin, setSpin] = useState<{ key: number; target: CategoryId | null }>({ key: 0, target: null });
  const [spinning, setSpinning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [burst, setBurst] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [now, setNow] = useState(Date.now());
  const animatedSpin = useRef('');
  const finished = useRef(false);
  const prevTurn = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => void timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const state = row?.state ?? null;
  const myIdx = state ? (state.players[0].id === account?.id ? 0 : 1) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const myTurn = !!state && state.turn === myIdx && state.phase !== 'end';
  const pool = useMemo(() => (row ? matchPool(store.qById.values(), row.config) : []), [store.qById, row?.config]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = state?.qid ? store.qById.get(state.qid) : undefined;
  const limitMs = (state?.setup.timeSec ?? 30) * 1000;

  const accept = (r: OnlineMatchRow) => {
    if (rowRef.current && r.version < rowRef.current.version) return;
    rowRef.current = r;
    setRow(r);
  };

  // carregar + assinar
  useEffect(() => {
    if (!backend) return;
    backend.getMatch(matchId).then(accept, (e) => setErr(String(e.message ?? e)));
    const unsub = backend.subscribeMatch(matchId, accept);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [backend, matchId]);

  // jogador A inicializa o estado quando a partida começa
  useEffect(() => {
    if (!backend || !row || row.state || row.status !== 'active' || row.player_a !== account?.id || !row.player_b) return;
    (async () => {
      const opp = await backend.getProfile(row.player_b!);
      const a: Competitor = { id: account!.id, name: me.name, avatar: COSMETIC[me.cosmetics.avatar]?.value ?? '🩺', frame: COSMETIC[me.cosmetics.frame]?.value, kind: 'human', level: levelFromXp(me.xp).level, rating: me.rating };
      const b: Competitor = { id: row.player_b!, name: opp?.name ?? 'Adversário', avatar: opp?.avatar ?? '🩺', kind: 'human', level: opp?.level ?? 1, rating: opp?.rating ?? 1000 };
      await push(createMatch(row.id, 'pvp-online', a, b, row.config, setupAreas(row.config, store.cards)));
    })();
  }, [row, backend, account]); // eslint-disable-line react-hooks/exhaustive-deps

  async function push(next: MatchState, status?: OnlineMatchRow['status']) {
    const cur = rowRef.current!;
    const ok = await backend!.updateMatch(cur.id, cur.version, { state: next, ...(status ? { status } : {}) });
    if (ok) accept({ ...cur, state: next, status: status ?? cur.status, version: cur.version + 1, updated_at: new Date().toISOString() });
    else accept(await backend!.getMatch(cur.id)); // conflito: recarrega
    return ok;
  }

  // transições vindas do servidor: faixa de turno, giro do adversário, fim
  useEffect(() => {
    if (!state) return;
    const firstLoad = prevTurn.current === null;
    if (firstLoad) {
      setOverlay({ kind: 'intro' });
      later(() => setOverlay(null), 2200);
    } else if (prevTurn.current !== state.turn && state.phase !== 'end') {
      setOverlay({ kind: 'turn', text: state.turn === myIdx ? 'SUA VEZ!' : 'VEZ DO ADVERSÁRIO', sub: `Rodada ${state.round} de ${state.config.maxRounds}` });
      if (state.turn === myIdx) sfx.land();
      later(() => setOverlay(null), 1300);
    }
    prevTurn.current = state.turn;
    // adversário girou: anima a roleta até a área sorteada
    if (!myTurn && !firstLoad && state.phase === 'question' && state.cat && !state.crownQuestion) {
      const key = `${state.log.length}-${state.turn}-${state.qid}`;
      if (animatedSpin.current !== key) {
        animatedSpin.current = key;
        setSpinning(true);
        setSpin((s) => ({ key: s.key + 1, target: state.cat }));
        later(() => setSpinning(false), 7000); // garantia caso a animação não rode
      }
    }
    if (state.phase === 'end') endMatch(state);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(cat: CategoryId, m: MatchState, crown: boolean): Question | undefined {
    const exclude = new Set(m.usedQids);
    return (
      pickQuestion(pool, store.history, { category: cat, exclude, minDifficulty: crown ? 2 : undefined }) ??
      pickQuestion(pool, store.history, { category: cat, exclude }) ??
      pickQuestion(pool, store.history, { category: cat })
    );
  }

  // ---------- minhas ações ----------
  function onSpinClick() {
    if (!myTurn || state!.phase !== 'spin' || spinning) return;
    setSpinning(true);
    setSpin((s) => ({ key: s.key + 1, target: spinCategory(setupCats(state!), lastSpunCat(state!)) }));
  }

  function onWheelDone(cat: CategoryId) {
    setSpinning(false);
    setOverlay({ kind: 'cat', cat });
    later(() => setOverlay(null), 1100);
    if (!myTurn) return; // animação do giro do adversário
    const m = applySpin(state!, cat);
    const q = pick(cat, m, false);
    if (q) void push(setQuestion(m, q.id));
  }

  function chooseCrown(cat: CategoryId) {
    const m = applyCrownChoice(state!, cat);
    const q = pick(cat, m, true);
    setOverlay({ kind: 'cat', cat, crown: true });
    later(() => setOverlay(null), 1100);
    if (q) void push(setQuestion(m, q.id));
  }

  function onAnswer(r: AnswerResult) {
    const m = rowRef.current!.state!;
    if (!q || q.id !== m.qid) return;
    const p = m.players[myIdx];
    const s = scoreAnswer({ correct: r.correct, difficulty: q.difficulty, msUsed: r.ms, msLimit: r.msLimit, streakBefore: p.streak, secondChance: r.secondChance, crown: m.crownQuestion });
    const res = applyAnswer(m, { chosen: r.chosen, correct: r.correct, ms: r.ms, points: s.points, xp: s.xp });
    void push(res.match);
    store.recordAnswer({ qid: q.id, cat: q.category, sub: q.subtopic, diff: q.difficulty, correct: r.correct, chosen: r.chosen, ms: Math.round(r.ms), at: Date.now(), mode: 'pvp-online', matchId: m.id }, s.xp);
    if (r.correct) {
      setBurst((b) => b + 1);
      if (res.crownWon) sfx.crown();
    }
    setFeedback({
      points: s.points,
      xp: s.xp,
      streak: res.match.players[myIdx].streak,
      crownWon: res.crownWon,
      extra: res.meterFull ? '👑 Medidor cheio! Escolha uma coroa para disputar agora.' : !r.correct && m.crownQuestion ? 'A coroa escapou — o medidor zerou.' : undefined,
    });
  }

  function onContinue() {
    const next = advance(rowRef.current!.state!);
    setFeedback(null);
    void push(next, next.phase === 'end' ? 'finished' : undefined);
  }

  function quit(loser: 0 | 1) {
    setConfirmQuit(false);
    void push(forfeit(rowRef.current!.state!, loser), 'finished');
  }

  // ---------- fim ----------
  function endMatch(m: MatchState) {
    if (finished.current) return;
    finished.current = true;
    const doneKey = 'rdl.online.done';
    const done: string[] = JSON.parse(localStorage.getItem(doneKey) || '[]');
    const p = m.players[myIdx];
    const o = m.players[oppIdx];
    const result = m.winner === 'draw' ? 'draw' : m.winner === myIdx ? 'win' : 'loss';
    const rw = matchRewards({ mode: 'pvp-online', result, winStreak: result === 'win' ? me.winStreak + 1 : 0, crowns: p.crowns.length, correct: p.correct, total: p.answered });
    const ranked = !!rowRef.current?.ranked;
    const summary: MatchSummary = {
      id: m.id,
      mode: ranked ? 'ranked' : 'pvp-online',
      at: Date.now(),
      opponentName: o.name,
      opponentIsBot: false,
      result,
      score: p.score,
      oppScore: o.score,
      crowns: p.crowns.length,
      oppCrowns: o.crowns.length,
      correct: p.correct,
      total: p.answered,
      avgMs: p.answered ? p.totalMs / p.answered : 0,
      xp: rw.xp,
      coins: rw.coins,
      ratingDelta: ranked ? eloDelta(me.rating, o.rating, result === 'win' ? 1 : result === 'draw' ? 0.5 : 0, me.rankedWins + me.rankedLosses) : 0,
      wrongIds: p.wrongIds,
      report: reportOf(m, myIdx as 0 | 1),
      setup: m.setup,
    };
    if (!done.includes(m.id)) {
      localStorage.setItem(doneKey, JSON.stringify([...done, m.id].slice(-200)));
      store.finishMatch(summary);
    }
    result === 'win' ? sfx.victory() : result === 'loss' ? sfx.defeat() : sfx.land();
    later(() => store.nav({ name: 'result', summary }), 1200);
  }

  // ---------- render ----------
  if (err) return <Empty icon="⚠️" text={err}><Btn onClick={() => store.nav({ name: 'home' })}>Início</Btn></Empty>;
  if (!row) return <div className="py-24 text-center text-white/60 animate-pulse">Conectando à partida...</div>;
  if (!state)
    return (
      <div className="py-24 text-center">
        <div className="text-5xl animate-bob">⏳</div>
        <p className="mt-3 text-white/70">{row.status === 'waiting' ? 'Aguardando o adversário entrar...' : 'Preparando a partida...'}</p>
      </div>
    );

  const cur = state.players[state.turn];
  const opp = state.players[oppIdx];
  const lastLog = state.log[state.log.length - 1];
  const inactive = !myTurn && state.phase !== 'end' && now - new Date(row.updated_at).getTime() > limitMs + INACTIVE_MARGIN_MS;
  const oppView: OpponentView | null =
    !myTurn && q && (state.phase === 'question' || state.phase === 'feedback') && !spinning
      ? {
          q,
          phase: state.phase === 'feedback' ? 'result' : 'thinking',
          correct: state.phase === 'feedback' ? !!lastLog?.correct : false,
          chosen: state.phase === 'feedback' ? lastLog?.chosen ?? null : null,
          ms: lastLog?.ms ?? 0,
          points: lastLog?.points ?? 0,
        }
      : null;

  return (
    <div className="pb-10">
      <MatchHud match={state} />
      <div className="mt-4">
        {myTurn && (state.phase === 'question' || state.phase === 'feedback') && q ? (
          <QuestionPlay
            question={q}
            limitMs={limitMs}
            crown={state.crownQuestion}
            powerupsAllowed={false}
            onAnswer={onAnswer}
            feedback={state.phase === 'feedback' ? feedback ?? { points: lastLog?.points ?? 0, xp: 0, streak: state.players[myIdx].streak } : null}
            onContinue={onContinue}
          />
        ) : oppView ? (
          <OpponentTurnCard view={oppView} name={cur.name} avatar={cur.avatar} />
        ) : state.phase === 'crown-choice' && myTurn ? (
          <CrownChoice player={state.players[myIdx]} match={state} onChoose={chooseCrown} />
        ) : state.phase === 'crown-choice' ? (
          <div className="text-center py-16 text-white/70 animate-pulse">{cur.name} está escolhendo uma coroa...</div>
        ) : state.phase === 'end' ? (
          <div className="text-center py-16 font-display text-2xl">Fim de jogo!</div>
        ) : (
          <div className="flex flex-col items-center pt-2">
            <div className="font-display text-lg text-white/80 mb-4 h-7">{myTurn ? '🎡 Gire a roleta!' : <span className="animate-pulse">{cur.avatar} Vez de {cur.name}...</span>}</div>
            <Wheel
              categories={setupCats(state)}
              target={spin.target}
              spinKey={spin.key}
              onDone={onWheelDone}
              onSpinClick={onSpinClick}
              canSpin={myTurn && state.phase === 'spin' && !overlay && !spinning}
              size={Math.min(340, window.innerWidth - 48)}
              reduceMotion={me.settings.reduceMotion}
            />
          </div>
        )}
      </div>

      {inactive && (
        <div className="mt-4 rounded-2xl bg-amber-400/15 border border-amber-300/30 p-4 text-center">
          <p className="text-sm">{opp.name} está sem jogar há um bom tempo.</p>
          <Btn variant="gold" className="mt-2" onClick={() => quit(oppIdx as 0 | 1)}>
            Reivindicar vitória
          </Btn>
        </div>
      )}

      <div className="mt-8 text-center text-xs text-white/35">
        🌐 Partida online {row.ranked ? 'ranqueada ' : ''}· itens desativados ·{' '}
        <button onClick={() => setConfirmQuit(true)} className="underline hover:text-white/70">
          desistir
        </button>
      </div>

      <Overlays overlay={overlay} match={state} />
      <Particles burst={burst} color={COSMETIC[me.cosmetics.effect]?.value ?? 'multi'} />
      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Desistir?">
        <p className="text-white/70 mb-4">Desistir conta como derrota.</p>
        <div className="flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => setConfirmQuit(false)}>
            Continuar
          </Btn>
          <Btn variant="danger" className="flex-1" onClick={() => quit(myIdx as 0 | 1)}>
            Desistir
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
