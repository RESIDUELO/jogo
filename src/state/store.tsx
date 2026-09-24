import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setSoundEnabled, sfx } from '../audio/sfx';
import {
  applyAnswerToPlayer,
  applyMatchToPlayer,
  checkAchievements,
  claimDailyReward,
  claimMission,
  newPlayer,
  type GameEvent,
} from '../engine/player';
import { buildHistory, type QHistory } from '../engine/selection';
import { dayStreak } from '../engine/stats';
import { dayKey } from '../engine/util';
import { playerRepo } from '../services/playerRepo';
import { questionRepo } from '../services/questionRepo';
import type { AnswerRecord, ExamMeta, MatchSetupData, MatchSummary, Player, Question } from '../types';

export type Screen = (
  | { name: 'home' }
  | { name: 'play' } // escolha de modo PvP
  | { name: 'match'; config: MatchLaunch }
  | { name: 'training' }
  | { name: 'trainingRun'; config: TrainingLaunch }
  | { name: 'ranked' }
  | { name: 'result'; summary: MatchSummary; rematch?: MatchLaunch; retrain?: TrainingLaunch }
  | { name: 'profile' }
  | { name: 'ranking' }
  | { name: 'wrong' }
  | { name: 'stats' }
  | { name: 'achievements' }
  | { name: 'missions' }
  | { name: 'shop' }
  | { name: 'bank' }
  | { name: 'settings' }
  | { name: 'players' }
  | { name: 'account' }
  | { name: 'onlineSearch'; setup: MatchSetupData; ranked: boolean }
  | { name: 'onlineRoom'; matchId: string; code: string }
  | { name: 'onlineMatch'; matchId: string }
  | { name: 'report'; summary: MatchSummary }
) & { nonce?: number };

export interface MatchLaunch {
  mode: 'pvp-bot' | 'pvp-local' | 'ranked';
  botId?: string;
  opponentPlayerId?: string; // hot-seat
  setup: MatchSetupData;
}

export interface TrainingLaunch {
  count: number | 'inf';
  categories: string[]; // vazio = todas
  wrongOnly: boolean;
  questionIds?: string[]; // lista fixa (ex.: revisar erradas de uma partida)
  examId?: string;
}

export interface Toast {
  id: number;
  ev: GameEvent;
}

interface Store {
  ready: boolean;
  error?: string;
  questions: Question[];
  qById: Map<string, Question>;
  exams: ExamMeta[];
  players: Player[];
  player: Player | null;
  answers: AnswerRecord[];
  matches: MatchSummary[];
  history: Map<string, QHistory>;
  screen: Screen;
  nav: (s: Screen) => void;
  back: () => void;
  toasts: Toast[];
  levelUp: { level: number; title: string } | null;
  dismissLevelUp: () => void;
  dismissToast: (id: number) => void;
  createPlayer: (name: string, avatar: string) => Player;
  switchPlayer: (id: string) => void;
  deletePlayer: (id: string) => void;
  updatePlayer: (fn: (p: Player) => Player, pid?: string) => void;
  recordAnswer: (rec: AnswerRecord, xp: number, pid?: string) => void;
  finishMatch: (m: MatchSummary, pid?: string) => void;
  claimMissionReward: (id: string) => void;
  claimDaily: () => void;
  reloadPlayers: () => void;
  getPlayer: (id: string) => Player | undefined;
  streakDays: number;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [players, setPlayers] = useState<Player[]>(() => playerRepo.listPlayers());
  const [activeId, setActiveId] = useState<string | null>(() => playerRepo.getActiveId());
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null);
  const toastId = useRef(1);

  const player = players.find((p) => p.id === activeId) ?? null;

  useEffect(() => {
    questionRepo
      .loadAll()
      .then(({ questions, exams }) => {
        setQuestions(questions);
        setExams(exams);
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setAnswers(playerRepo.getAnswers(activeId));
    setMatches(playerRepo.getMatches(activeId));
  }, [activeId]);

  useEffect(() => {
    setSoundEnabled(player?.settings.sound ?? true);
  }, [player?.settings.sound]);

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const history = useMemo(() => buildHistory(answers), [answers]);

  const emit = useCallback((events: GameEvent[], pid?: string) => {
    if (pid && pid !== playerRepo.getActiveId()) return; // eventos do jogador 2 (hot-seat) não viram toast
    const shown: Toast[] = [];
    for (const ev of events) {
      if (ev.type === 'levelup') {
        setLevelUp({ level: ev.level, title: ev.title });
        sfx.levelUp();
        continue;
      }
      if (ev.type === 'xp') continue; // XP é mostrado inline na partida
      if (ev.type === 'achievement') sfx.achievement();
      shown.push({ id: toastId.current++, ev });
    }
    if (shown.length) setToasts((t) => [...t, ...shown].slice(-6));
  }, []);

  const persist = useCallback((p: Player) => {
    playerRepo.savePlayer(p);
    setPlayers((all) => all.map((x) => (x.id === p.id ? p : x)));
  }, []);

  const getPlayer = useCallback((id: string) => playerRepo.listPlayers().find((p) => p.id === id), []);

  const store: Store = {
    ready,
    error,
    questions,
    qById,
    exams,
    players,
    player,
    answers,
    matches,
    history,
    screen: stack[stack.length - 1],
    nav: (s) => {
      const e = { ...s, nonce: Date.now() };
      setStack((st) => (s.name === 'home' ? [e] : [...st.slice(-8), e]));
      window.scrollTo({ top: 0 });
    },
    back: () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : [{ name: 'home' }])),
    toasts,
    levelUp,
    dismissLevelUp: () => setLevelUp(null),
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    createPlayer: (name, avatar) => {
      const p = newPlayer(name, avatar);
      playerRepo.savePlayer(p);
      setPlayers(playerRepo.listPlayers());
      if (!playerRepo.getActiveId() || !players.length) {
        playerRepo.setActiveId(p.id);
        setActiveId(p.id);
      }
      return p;
    },
    switchPlayer: (id) => {
      playerRepo.setActiveId(id);
      setActiveId(id);
      setStack([{ name: 'home' }]);
    },
    deletePlayer: (id) => {
      playerRepo.deletePlayer(id);
      const rest = playerRepo.listPlayers();
      setPlayers(rest);
      if (id === activeId) {
        const next = rest[0]?.id ?? null;
        playerRepo.setActiveId(next);
        setActiveId(next);
      }
    },
    updatePlayer: (fn, pid) => {
      const target = pid ? getPlayer(pid) : player;
      if (!target) return;
      persist(fn(target));
    },
    recordAnswer: (rec, xp, pid) => {
      const id = pid ?? activeId;
      const target = id ? getPlayer(id) : undefined;
      if (!target) return;
      playerRepo.addAnswers(target.id, [rec]);
      const { player: next, events } = applyAnswerToPlayer(target, rec, xp);
      persist(next);
      if (target.id === activeId) setAnswers((a) => [...a, rec]);
      emit(events, target.id);
    },
    finishMatch: (m, pid) => {
      const id = pid ?? activeId;
      const target = id ? getPlayer(id) : undefined;
      if (!target) return;
      playerRepo.addMatch(target.id, m);
      const r1 = applyMatchToPlayer(target, m);
      const allMatches = playerRepo.getMatches(target.id);
      const r2 = checkAchievements(r1.player, playerRepo.getAnswers(target.id), allMatches);
      persist(r2.player);
      if (target.id === activeId) setMatches(allMatches);
      emit([...r1.events, ...r2.events], target.id);
    },
    claimMissionReward: (mid) => {
      if (!player) return;
      const { player: next, events } = claimMission(player, mid);
      persist(next);
      sfx.coin();
      emit(events);
    },
    claimDaily: () => {
      if (!player) return;
      const { player: next, events } = claimDailyReward(player, dayStreak([...player.playDays, dayKey()]));
      persist(next);
      sfx.coin();
      emit(events);
    },
    reloadPlayers: () => {
      setPlayers(playerRepo.listPlayers());
      setActiveId(playerRepo.getActiveId());
    },
    getPlayer,
    streakDays: player ? dayStreak(player.playDays) : 0,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
}

export function usePlayer(): Player {
  const { player } = useStore();
  if (!player) throw new Error('Sem jogador ativo');
  return player;
}
