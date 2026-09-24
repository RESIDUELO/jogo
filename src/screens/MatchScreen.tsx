import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { BOT_BY_ID, BOT_TIERS } from '../data/bots';
import { COSMETIC, RANKED_POWERUP_LIMIT } from '../data/shop';
import { simulateBotAnswer } from '../engine/bot';
import { eloDelta } from '../engine/elo';
import {
  advance,
  applyAnswer,
  applyCrownChoice,
  applySpin,
  createMatch,
  forfeit,
  lastSpunCat,
  missingCrowns,
  setQuestion,
  setupCats,
  type Competitor,
  type MatchState,
} from '../engine/match';
import { matchRewards, scoreAnswer } from '../engine/scoring';
import { buildHistory, pickQuestion } from '../engine/selection';
import { spinCategory, uid } from '../engine/util';
import { matchPool, reportOf } from '../engine/matchUtils';
import { setupAreas } from '../engine/cards';
import { playerRepo } from '../services/playerRepo';
import { useStore, type MatchLaunch } from '../state/store';
import type { CategoryId, MatchSummary, Player, PowerUpId, Question } from '../types';
import { Btn, Modal } from '../ui/common';
import { competitorFromPlayer, CrownChoice, MatchHud, OpponentTurnCard, Overlays, type OpponentView, type Overlay } from '../ui/MatchParts';
import { Particles } from '../ui/Particles';
import { QuestionPlay, type AnswerResult, type Feedback } from '../ui/QuestionPlay';
import { Wheel } from '../ui/Wheel';

export function MatchScreen({ config }: { config: MatchLaunch }) {
  const store = useStore();
  const me = store.player!;
  const opponentPlayer = config.opponentPlayerId ? store.getPlayer(config.opponentPlayerId) : undefined;
  const bot = config.botId ? BOT_BY_ID[config.botId] : undefined;
  const mode = config.mode;

  const [match, setMatchState] = useState<MatchState>(() => {
    const a = competitorFromPlayer(me);
    const b: Competitor = opponentPlayer
      ? competitorFromPlayer(opponentPlayer)
      : { id: bot!.id, name: bot!.name, avatar: bot!.avatar, kind: 'bot', botId: bot!.id, level: BOT_TIERS[bot!.tier].level, rating: BOT_TIERS[bot!.tier].rating };
    return createMatch(uid('m-'), mode, a, b, config.setup, setupAreas(config.setup, store.cards));
  });
  const [question, setQ] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [spin, setSpin] = useState<{ key: number; target: CategoryId | null }>({ key: 0, target: null });
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'intro' });
  const [botView, setBotView] = useState<OpponentView | null>(null);
  const [burst, setBurst] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [powerupsUsed, setPowerupsUsed] = useState(0);
  const finished = useRef(false);
  const matchRef = useRef(match);
  matchRef.current = match;
  const commit = (m: MatchState) => {
    matchRef.current = m;
    setMatchState(m);
  };
  const timers = useRef<number[]>([]);

  const cur = match.players[match.turn];
  const isBotTurn = cur.kind === 'bot';
  const turnPlayer: Player | undefined = cur.kind === 'human' ? (cur.id === me.id ? store.player! : store.getPlayer(cur.id)) : undefined;
  const cats = setupCats(match);

  const pool = useMemo(() => matchPool(store.qById.values(), match.setup), [store.qById, match.setup]);
  const limitMs = match.setup.timeSec * 1000;
  const opponentHistory = useMemo(() => (opponentPlayer ? buildHistory(playerRepo.getAnswers(opponentPlayer.id)) : new Map()), [opponentPlayer]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const t = setTimeout(() => showTurnBanner(matchRef.current), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showTurnBanner(m: MatchState) {
    const p = m.players[m.turn];
    const text = p.kind === 'bot' ? 'VEZ DO ADVERSÁRIO' : mode === 'pvp-local' ? `VEZ DE ${p.name.toUpperCase()}` : 'SUA VEZ!';
    const sub = mode === 'pvp-local' && p.kind === 'human' ? 'Passe o aparelho 📱' : `Rodada ${m.round} de ${m.config.maxRounds}`;
    setOverlay({ kind: 'turn', text, sub });
    later(
      () => {
        setOverlay(null);
        if (p.kind === 'bot') botStep(m);
      },
      p.kind === 'bot' ? 1100 : 1300,
    );
  }

  function pick(cat: CategoryId, m: MatchState, crown: boolean): Question | undefined {
    const p = m.players[m.turn];
    const hist = p.kind === 'bot' ? new Map() : p.id === me.id ? store.history : opponentHistory;
    const exclude = new Set(m.usedQids);
    const base =
      pickQuestion(pool, hist, { category: cat, exclude, minDifficulty: crown ? 2 : undefined }) ??
      pickQuestion(pool, hist, { category: cat, exclude }) ??
      pickQuestion(pool, hist, { category: cat }); // área esgotada: permite repetir
    return base;
  }

  // ---------- turno do BOT ----------
  function botStep(m: MatchState) {
    if (!bot) return;
    if (m.phase === 'spin') {
      const cat = spinCategory(setupCats(m), lastSpunCat(m));
      later(() => setSpin((s) => ({ key: s.key + 1, target: cat })), 500);
    } else if (m.phase === 'crown-choice') {
      const miss = missingCrowns(m.players[m.turn], m);
      const best = miss.sort((a, b) => (bot.skill[b] ?? 0) - (bot.skill[a] ?? 0))[0];
      const next = applyCrownChoice(m, best);
      commit(next);
      setOverlay({ kind: 'cat', cat: best, crown: true });
      later(() => {
        setOverlay(null);
        botAnswer(next, true);
      }, 1100);
    }
  }

  function botAnswer(m0: MatchState, crown: boolean) {
    const q = pick(m0.cat!, m0, crown);
    if (!q || !bot) return;
    const m = setQuestion(m0, q.id);
    commit(m);
    const ans = simulateBotAnswer(bot, q, limitMs, m.id);
    const s = scoreAnswer({ correct: ans.correct, difficulty: q.difficulty, msUsed: ans.ms, msLimit: limitMs, streakBefore: m.players[m.turn].streak, crown });
    const shown = Math.min(4200, Math.max(1800, ans.ms / 12));
    setBotView({ q, phase: 'thinking', correct: ans.correct, chosen: ans.chosen, ms: ans.ms, points: s.points });
    later(() => {
      setBotView((v) => (v ? { ...v, phase: 'result' } : v));
      ans.correct ? sfx.correct() : sfx.wrong();
      const r = applyAnswer(m, { chosen: ans.chosen, correct: ans.correct, ms: ans.ms, points: s.points, xp: s.xp });
      if (r.crownWon) sfx.crown();
      commit(r.match);
      later(() => {
        setBotView(null);
        proceed(r.match);
      }, 2200);
    }, shown);
  }

  function skipBot() {
    if (botView?.phase === 'result') {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setBotView(null);
      proceed(matchRef.current);
    }
  }

  // ---------- fluxo comum ----------
  function proceed(m: MatchState) {
    const next = advance(m);
    commit(next);
    setQ(null);
    setFeedback(null);
    if (next.phase === 'end') return endMatch(next);
    if (next.phase === 'crown-choice') {
      if (next.players[next.turn].kind === 'bot') later(() => botStep(next), 700);
      return;
    }
    if (next.turn !== m.turn) showTurnBanner(next);
    else if (next.players[next.turn].kind === 'bot') botStep(next);
  }

  function onSpinClick() {
    const m = matchRef.current;
    if (m.players[m.turn].kind === 'bot' || m.phase !== 'spin' || overlay) return;
    setSpin((s) => ({ key: s.key + 1, target: spinCategory(setupCats(m), lastSpunCat(m)) }));
  }

  function onWheelDone(cat: CategoryId) {
    const m = applySpin(matchRef.current, cat);
    const botTurn = m.players[m.turn].kind === 'bot';
    commit(m);
    setOverlay({ kind: 'cat', cat });
    later(() => {
      setOverlay(null);
      if (botTurn) botAnswer(m, false);
      else openQuestion(m, false);
    }, 1150);
  }

  function openQuestion(m: MatchState, crown: boolean) {
    const q = pick(m.cat!, m, crown);
    if (!q) return;
    commit(setQuestion(m, q.id));
    setQ(q);
    setFeedback(null);
  }

  function chooseCrown(cat: CategoryId) {
    const m = applyCrownChoice(matchRef.current, cat);
    commit(m);
    setOverlay({ kind: 'cat', cat, crown: true });
    later(() => {
      setOverlay(null);
      openQuestion(m, true);
    }, 1100);
  }

  function onAnswer(r: AnswerResult) {
    if (!question || !turnPlayer) return;
    const m = matchRef.current;
    const p = m.players[m.turn];
    const s = scoreAnswer({ correct: r.correct, difficulty: question.difficulty, msUsed: r.ms, msLimit: r.msLimit, streakBefore: p.streak, secondChance: r.secondChance, crown: m.crownQuestion });
    const res = applyAnswer(m, { chosen: r.chosen, correct: r.correct, ms: r.ms, points: s.points, xp: s.xp });
    commit(res.match);
    store.recordAnswer(
      { qid: question.id, cat: question.category, sub: question.subtopic, diff: question.difficulty, correct: r.correct, chosen: r.chosen, ms: Math.round(r.ms), at: Date.now(), mode, matchId: m.id },
      s.xp,
      turnPlayer.id,
    );
    if (r.correct) {
      setBurst((b) => b + 1);
      if (res.crownWon) sfx.crown();
    }
    const np = res.match.players[m.turn];
    setFeedback({
      points: s.points,
      xp: s.xp,
      streak: np.streak,
      crownWon: res.crownWon,
      extra: res.meterFull ? '👑 Medidor cheio! Escolha uma coroa para disputar agora.' : !r.correct && m.crownQuestion ? 'A coroa escapou — o medidor zerou.' : undefined,
    });
  }

  function usePowerup(id: PowerUpId) {
    if (!turnPlayer) return;
    setPowerupsUsed((n) => n + 1);
    store.updatePlayer((pl) => ({ ...pl, inventory: { ...pl.inventory, [id]: Math.max(0, pl.inventory[id] - 1) } }), turnPlayer.id);
  }

  function swapQuestion() {
    const m = matchRef.current;
    const q = pick(m.cat!, m, m.crownQuestion);
    if (q) {
      commit(setQuestion(m, q.id));
      setQ(q);
    }
  }

  // ---------- fim ----------
  function summaryFor(m: MatchState, idx: 0 | 1): MatchSummary {
    const p = m.players[idx];
    const o = m.players[idx === 0 ? 1 : 0];
    const result = m.winner === 'draw' ? 'draw' : m.winner === idx ? 'win' : 'loss';
    const pl = idx === 0 ? store.player! : store.getPlayer(p.id)!;
    const winStreak = result === 'win' ? pl.winStreak + 1 : 0;
    const rw = matchRewards({ mode, result, winStreak, crowns: p.crowns.length, correct: p.correct, total: p.answered });
    const ratingDelta = mode === 'ranked' ? eloDelta(pl.rating, o.rating, result === 'win' ? 1 : result === 'draw' ? 0.5 : 0, pl.rankedWins + pl.rankedLosses) : 0;
    return {
      id: m.id,
      mode,
      at: Date.now(),
      opponentName: o.name,
      opponentIsBot: o.kind === 'bot',
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
      ratingDelta,
      wrongIds: p.wrongIds,
      botId: o.botId,
      report: reportOf(m, idx),
      setup: m.setup,
    };
  }

  function endMatch(m: MatchState) {
    if (finished.current) return;
    finished.current = true;
    const mine = summaryFor(m, 0);
    store.finishMatch(mine);
    if (mode === 'pvp-local' && m.players[1].kind === 'human') store.finishMatch(summaryFor(m, 1), m.players[1].id);
    mine.result === 'win' ? sfx.victory() : mine.result === 'loss' ? sfx.defeat() : sfx.land();
    later(() => store.nav({ name: 'result', summary: mine, rematch: config }), 900);
  }

  function quit() {
    const m = forfeit(matchRef.current, 0);
    commit(m);
    setConfirmQuit(false);
    endMatch(m);
  }

  const effect = COSMETIC[me.cosmetics.effect]?.value ?? 'multi';
  const powerupsLeft = mode === 'ranked' ? Math.max(0, RANKED_POWERUP_LIMIT - powerupsUsed) : undefined;

  return (
    <div className="pb-10">
      <MatchHud match={match} />
      <div className="mt-4">
        {question && !isBotTurn ? (
          <QuestionPlay
            question={question}
            limitMs={limitMs}
            crown={match.crownQuestion}
            inventory={turnPlayer?.inventory}
            powerupsLeft={powerupsLeft}
            onUsePowerup={usePowerup}
            onSwap={swapQuestion}
            onAnswer={onAnswer}
            feedback={feedback}
            onContinue={() => proceed(matchRef.current)}
          />
        ) : botView ? (
          <OpponentTurnCard view={botView} name={cur.name} avatar={cur.avatar} onSkip={skipBot} />
        ) : match.phase === 'crown-choice' && !isBotTurn ? (
          <CrownChoice player={cur} match={match} onChoose={chooseCrown} />
        ) : match.phase === 'crown-choice' ? (
          <div className="text-center py-16 text-white/70 animate-pulse">{cur.name} está escolhendo uma coroa...</div>
        ) : (
          <div className="flex flex-col items-center pt-2">
            <div className="font-display text-lg text-white/80 mb-4 h-7">
              {isBotTurn ? (
                <span className="animate-pulse">
                  {cur.avatar} {cur.name} está girando...
                </span>
              ) : (
                <span>🎡 Gire a roleta!</span>
              )}
            </div>
            <Wheel
              categories={cats}
              target={spin.target}
              spinKey={spin.key}
              onDone={onWheelDone}
              onSpinClick={onSpinClick}
              canSpin={!isBotTurn && match.phase === 'spin' && !overlay}
              size={Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 48 : 320)}
              reduceMotion={me.settings.reduceMotion}
            />
            <p className="mt-5 text-xs text-white/40 text-center max-w-xs">
              Acerte {match.config.meterSize} para encher o medidor e disputar uma 👑 coroa. Quem juntar {match.config.targetCrowns} coroa{match.config.targetCrowns > 1 ? 's' : ''} vence.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <button onClick={() => setConfirmQuit(true)} className="text-xs text-white/35 hover:text-white/70 underline">
          Desistir da partida
        </button>
      </div>

      <Overlays overlay={overlay} match={match} />
      <Particles burst={burst} color={effect} />
      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Desistir?">
        <p className="text-white/70 mb-4">Desistir conta como derrota{mode === 'ranked' ? ' e reduz seu rating' : ''}.</p>
        <div className="flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => setConfirmQuit(false)}>
            Continuar jogando
          </Btn>
          <Btn variant="danger" className="flex-1" onClick={quit}>
            Desistir
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
