import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { BOT_BY_ID, BOT_TIERS } from '../data/bots';
import { CAT, CATEGORIES } from '../data/categories';
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
  LONG_MATCH,
  missingCrowns,
  QUICK_MATCH,
  setQuestion,
  type Competitor,
  type CompetitorState,
  type MatchState,
} from '../engine/match';
import { levelFromXp } from '../engine/progression';
import { matchRewards, scoreAnswer, timeLimitMs } from '../engine/scoring';
import { buildHistory, isPlayable, pickQuestion } from '../engine/selection';
import { uid } from '../engine/util';
import { playerRepo } from '../services/playerRepo';
import { useStore, type MatchLaunch } from '../state/store';
import type { CategoryId, MatchSummary, Player, PowerUpId, Question } from '../types';
import { Avatar, Btn, Modal } from '../ui/common';
import { Particles } from '../ui/Particles';
import { QuestionPlay, type AnswerResult, type Feedback } from '../ui/QuestionPlay';
import { Wheel } from '../ui/Wheel';

function competitorFromPlayer(p: Player): Competitor {
  return {
    id: p.id,
    name: p.name,
    avatar: COSMETIC[p.cosmetics.avatar]?.value ?? '🩺',
    frame: COSMETIC[p.cosmetics.frame]?.value,
    kind: 'human',
    level: levelFromXp(p.xp).level,
    rating: p.rating,
  };
}

type Overlay = { kind: 'intro' } | { kind: 'turn'; text: string; sub?: string } | { kind: 'cat'; cat: CategoryId; crown?: boolean } | null;

interface BotView {
  q: Question;
  phase: 'thinking' | 'result';
  correct: boolean;
  chosen: string | null;
  ms: number;
  points: number;
}

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
    return createMatch(uid('m-'), mode, a, b, config.long ? LONG_MATCH : QUICK_MATCH);
  });
  const [question, setQ] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [spin, setSpin] = useState<{ key: number; target: CategoryId | null }>({ key: 0, target: null });
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'intro' });
  const [botView, setBotView] = useState<BotView | null>(null);
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
  const botTimers = useRef<number[]>([]);

  const cur = match.players[match.turn];
  const isBotTurn = cur.kind === 'bot';
  const turnPlayer: Player | undefined = cur.kind === 'human' ? (cur.id === me.id ? store.player! : store.getPlayer(cur.id)) : undefined;
  const settings = me.settings;

  const pool = useMemo(() => store.questions.filter((q) => isPlayable(q, mode, false)), [store.questions, mode]);
  const opponentHistory = useMemo(() => (opponentPlayer ? buildHistory(playerRepo.getAnswers(opponentPlayer.id)) : new Map()), [opponentPlayer]);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    botTimers.current.push(id);
  };
  useEffect(() => () => botTimers.current.forEach(clearTimeout), []);

  // intro VS
  useEffect(() => {
    if (overlay?.kind !== 'intro') return;
    const t = setTimeout(() => showTurnBanner(match), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showTurnBanner(m: MatchState) {
    const p = m.players[m.turn];
    const text = p.kind === 'bot' ? 'VEZ DO ADVERSÁRIO' : mode === 'pvp-local' ? `VEZ DE ${p.name.toUpperCase()}` : 'SUA VEZ!';
    const sub = mode === 'pvp-local' && p.kind === 'human' ? 'Passe o aparelho 📱' : `Rodada ${m.round} de ${m.config.maxRounds}`;
    setOverlay({ kind: 'turn', text, sub });
    later(() => {
      setOverlay(null);
      if (p.kind === 'bot') botStep(m);
    }, p.kind === 'bot' ? 1100 : 1300);
  }

  function pick(cat: CategoryId, m: MatchState, crown: boolean): Question | undefined {
    const p = m.players[m.turn];
    const hist = p.kind === 'bot' ? new Map() : p.id === me.id ? store.history : opponentHistory;
    const exclude = new Set(m.usedQids);
    return (
      pickQuestion(pool, hist, { category: cat, exclude, minDifficulty: crown ? 2 : undefined }) ??
      pickQuestion(pool, hist, { category: cat, exclude }) ??
      pickQuestion(pool, hist, { exclude })
    );
  }

  // ---------- turno do BOT ----------
  function botStep(m: MatchState) {
    if (!bot) return;
    if (m.phase === 'spin') {
      const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].id;
      later(() => setSpin((s) => ({ key: s.key + 1, target: cat })), 500);
    } else if (m.phase === 'crown-choice') {
      const miss = missingCrowns(m.players[m.turn]);
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
    const limit = timeLimitMs(q.text.length, 'adaptativo');
    const ans = simulateBotAnswer(bot, q, limit, m.id);
    const s = scoreAnswer({ correct: ans.correct, difficulty: q.difficulty, msUsed: ans.ms, msLimit: limit, streakBefore: m.players[m.turn].streak, crown });
    const shown = Math.min(4200, Math.max(1600, ans.ms / 5));
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
      }, 1700);
    }, shown);
  }

  function skipBot() {
    // acelera: dispara imediatamente os timers pendentes não é trivial; reduz a espera encerrando a visualização
    if (botView?.phase === 'result') {
      botTimers.current.forEach(clearTimeout);
      botTimers.current = [];
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
    if (isBotTurn || match.phase !== 'spin' || overlay) return;
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].id;
    setSpin((s) => ({ key: s.key + 1, target: cat }));
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
    const match = matchRef.current;
    const p = match.players[match.turn];
    const s = scoreAnswer({ correct: r.correct, difficulty: question.difficulty, msUsed: r.ms, msLimit: r.msLimit, streakBefore: p.streak, secondChance: r.secondChance, crown: match.crownQuestion });
    const res = applyAnswer(match, { chosen: r.chosen, correct: r.correct, ms: r.ms, points: s.points, xp: s.xp });
    commit(res.match);
    store.recordAnswer(
      { qid: question.id, cat: question.category, sub: question.subtopic, diff: question.difficulty, correct: r.correct, chosen: r.chosen, ms: Math.round(r.ms), at: Date.now(), mode, matchId: match.id },
      s.xp,
      turnPlayer.id,
    );
    if (r.correct) {
      setBurst((b) => b + 1);
      if (res.crownWon) sfx.crown();
    }
    const np = res.match.players[match.turn];
    setFeedback({
      points: s.points,
      xp: s.xp,
      streak: np.streak,
      crownWon: res.crownWon,
      extra: res.meterFull ? '👑 Medidor cheio! Escolha uma coroa para disputar agora.' : !r.correct && match.crownQuestion ? 'A coroa escapou — o medidor zerou.' : undefined,
    });
  }

  function usePowerup(id: PowerUpId) {
    if (!turnPlayer) return;
    setPowerupsUsed((n) => n + 1);
    store.updatePlayer((pl) => ({ ...pl, inventory: { ...pl.inventory, [id]: Math.max(0, pl.inventory[id] - 1) } }), turnPlayer.id);
  }

  function swapQuestion() {
    if (!question) return;
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
  const limit = question ? timeLimitMs(question.text.length, turnPlayer?.settings.timerMode ?? settings.timerMode) : 30000;
  const powerupsLeft = mode === 'ranked' ? Math.max(0, RANKED_POWERUP_LIMIT - powerupsUsed) : undefined;

  return (
    <div className="pb-10">
      <MatchHud match={match} />

      {/* conteúdo principal */}
      <div className="mt-4">
        {question && !isBotTurn ? (
          <QuestionPlay
            question={question}
            limitMs={limit}
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
          <BotTurnCard view={botView} name={cur.name} avatar={cur.avatar} onSkip={skipBot} />
        ) : match.phase === 'crown-choice' && !isBotTurn ? (
          <CrownChoice player={cur} onChoose={chooseCrown} />
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
            <Wheel target={spin.target} spinKey={spin.key} onDone={onWheelDone} onSpinClick={onSpinClick} canSpin={!isBotTurn && match.phase === 'spin' && !overlay} size={Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 48 : 320)} reduceMotion={settings.reduceMotion} />
            <p className="mt-5 text-xs text-white/40 text-center max-w-xs">
              Acerte {match.config.meterSize} para encher o medidor e disputar uma 👑 coroa. Quem juntar {match.config.targetCrowns} coroas vence.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <button onClick={() => setConfirmQuit(true)} className="text-xs text-white/35 hover:text-white/70 underline">
          Desistir da partida
        </button>
      </div>

      {/* overlays */}
      {overlay?.kind === 'intro' && <VsIntro a={match.players[0]} b={match.players[1]} mode={mode} />}
      {overlay?.kind === 'turn' && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="text-center animate-pop">
            <div className="font-display text-4xl sm:text-5xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,.4)]">{overlay.text}</div>
            {overlay.sub && <div className="mt-2 text-white/70">{overlay.sub}</div>}
          </div>
        </div>
      )}
      {overlay?.kind === 'cat' && (
        <div className="fixed inset-0 z-[70] grid place-items-center pointer-events-none" style={{ background: `radial-gradient(circle, ${CAT[overlay.cat].color}88, #0b0a1fee 70%)` }}>
          <div className="text-center animate-pop">
            <div className="text-7xl mb-2">{overlay.crown ? '👑' : CAT[overlay.cat].icon}</div>
            <div className="font-display text-5xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,.35)]">{CAT[overlay.cat].name}!</div>
            {overlay.crown && <div className="text-amber-200 mt-1 font-semibold">Questão da coroa</div>}
          </div>
        </div>
      )}
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

function CrownSlots({ p, small }: { p: CompetitorState; small?: boolean }) {
  return (
    <div className="flex gap-1">
      {CATEGORIES.map((c) => {
        const has = p.crowns.includes(c.id);
        return (
          <div
            key={c.id}
            title={c.full}
            className={`${small ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-sm'} rounded-full grid place-items-center border-2 transition ${has ? 'animate-pop' : 'opacity-40 grayscale'}`}
            style={{ background: has ? c.color : 'transparent', borderColor: c.color }}
          >
            {has ? c.icon : ''}
          </div>
        );
      })}
    </div>
  );
}

function MatchHud({ match }: { match: MatchState }) {
  const [a, b] = match.players;
  const side = (p: CompetitorState, idx: 0 | 1) => {
    const active = match.turn === idx && match.phase !== 'end';
    return (
      <div className={`flex-1 min-w-0 rounded-2xl p-2.5 sm:p-3 border transition ${active ? 'bg-violet-500/20 border-violet-400/60 shadow-lg shadow-violet-500/20' : 'bg-ink-800/70 border-white/5'} ${idx === 1 ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 ${idx === 1 ? 'flex-row-reverse' : ''}`}>
          <Avatar emoji={p.avatar} frame={p.frame} size={40} />
          <div className="min-w-0">
            <div className="font-display font-semibold truncate text-sm sm:text-base">{p.name}</div>
            <div className="text-[11px] text-white/50">
              Nível {p.level} {p.kind === 'bot' && '· BOT'}
            </div>
          </div>
        </div>
        <div className={`mt-2 flex ${idx === 1 ? 'justify-end' : ''}`}>
          <CrownSlots p={p} small />
        </div>
        <div className={`mt-2 flex items-center gap-2 ${idx === 1 ? 'flex-row-reverse' : ''}`}>
          <div className="flex gap-1">
            {Array.from({ length: match.config.meterSize }).map((_, i) => (
              <div key={i} className={`w-4 h-2 rounded-full ${i < p.meter ? 'bg-amber-300 shadow shadow-amber-300/50' : 'bg-white/15'}`} />
            ))}
          </div>
          <div className="font-display text-sm text-amber-200">{p.score.toLocaleString('pt-BR')}</div>
          {p.streak >= 2 && <div className="text-[11px] text-orange-300">🔥{p.streak}</div>}
        </div>
      </div>
    );
  };
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2 bg-ink-950/85 backdrop-blur">
      <div className="flex items-stretch gap-2">
        {side(a, 0)}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="font-display text-xl font-bold text-white/80">VS</div>
          <div className="text-[10px] text-white/40 whitespace-nowrap">
            {Math.min(match.round, match.config.maxRounds)}/{match.config.maxRounds}
          </div>
        </div>
        {side(b, 1)}
      </div>
    </div>
  );
}

function VsIntro({ a, b, mode }: { a: CompetitorState; b: CompetitorState; mode: string }) {
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-gradient-to-br from-indigo-950 via-ink-950 to-fuchsia-950">
      <div className="w-full max-w-md px-6">
        <div className="text-center text-xs tracking-[0.3em] text-white/50 mb-6">{mode === 'ranked' ? 'PARTIDA RANQUEADA' : mode === 'pvp-local' ? 'DUELO LOCAL' : 'DUELO'}</div>
        <div className="flex items-center justify-between">
          <div className="text-center animate-slideIn">
            <Avatar emoji={a.avatar} frame={a.frame} size={88} className="mx-auto" />
            <div className="font-display mt-2 font-bold">{a.name}</div>
            <div className="text-xs text-white/50">
              Nível {a.level} · {a.rating}
            </div>
          </div>
          <div className="font-display text-5xl font-bold text-amber-300 animate-pop [animation-delay:400ms]">VS</div>
          <div className="text-center animate-slideIn [animation-delay:200ms]">
            <Avatar emoji={b.avatar} frame={b.frame} size={88} className="mx-auto" />
            <div className="font-display mt-2 font-bold">{b.name}</div>
            <div className="text-xs text-white/50">
              Nível {b.level} · {b.rating}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrownChoice({ player, onChoose }: { player: CompetitorState; onChoose: (c: CategoryId) => void }) {
  const miss = missingCrowns(player);
  return (
    <div className="text-center animate-pop pt-4">
      <div className="text-6xl animate-glow">👑</div>
      <h2 className="font-display text-3xl font-bold mt-2">Medidor cheio!</h2>
      <p className="text-white/60 mt-1 mb-5">Escolha a coroa que você quer disputar. A questão será um pouco mais difícil.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
        {miss.map((c) => (
          <button
            key={c}
            onClick={() => onChoose(c)}
            className="rounded-2xl p-4 font-display font-bold text-white border-b-4 hover:-translate-y-1 active:translate-y-0 transition shadow-lg"
            style={{ background: `linear-gradient(160deg, ${CAT[c].color}, ${CAT[c].dark})`, borderColor: CAT[c].dark }}
          >
            <div className="text-3xl">{CAT[c].icon}</div>
            {CAT[c].name}
          </button>
        ))}
      </div>
    </div>
  );
}

function BotTurnCard({ view, name, avatar, onSkip }: { view: BotView; name: string; avatar: string; onSkip: () => void }) {
  const c = CAT[view.q.category];
  return (
    <div className="rounded-3xl p-5 border border-white/10 bg-ink-800/80 animate-slideIn">
      <div className="flex items-center gap-3">
        <div className="text-4xl">{avatar}</div>
        <div>
          <div className="font-display font-semibold">{name}</div>
          <div className="text-xs" style={{ color: c.color }}>
            {c.icon} {c.name} · {view.q.subtopic}
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm text-white/60 line-clamp-3">{view.q.text}</p>
      {view.phase === 'thinking' ? (
        <div className="mt-4 flex items-center gap-2 text-white/80">
          <span className="thinking-dots">
            <i />
            <i />
            <i />
          </span>
          pensando...
        </div>
      ) : (
        <div className={`mt-4 rounded-2xl p-3 font-display text-xl font-bold animate-pop ${view.correct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
          {view.correct ? `✔ Acertou! +${view.points} pts` : view.chosen ? `✖ Errou (marcou ${view.chosen})` : '⏰ Tempo esgotado'}
          <span className="block text-xs font-sans font-normal text-white/50 mt-0.5">
            {(view.ms / 1000).toFixed(1)} s · resposta correta: {view.q.answer}
          </span>
        </div>
      )}
      {view.phase === 'result' && (
        <div className="mt-3 text-right">
          <button onClick={onSkip} className="text-xs text-white/50 hover:text-white underline">
            pular ›
          </button>
        </div>
      )}
    </div>
  );
}
