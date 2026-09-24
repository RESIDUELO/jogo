import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ClassId, GameEvent, SaveData } from '../types';
import { newGame, rollover, type Result } from '../engine/game';
import { repository } from '../storage/repository';
import { setSoundEnabled } from '../sound';

export type Screen =
  | 'dashboard' | 'battle' | 'decks' | 'character' | 'inventory' | 'map' | 'quests' | 'stats' | 'achievements' | 'settings';

type Listener = (events: GameEvent[]) => void;

interface GameContext {
  s: SaveData;
  run: (fn: (s: SaveData) => Result) => Result;
  screen: Screen;
  go: (screen: Screen) => void;
  replace: (s: SaveData) => void;
  reset: () => void;
  subscribe: (l: Listener) => () => void;
}

const Ctx = createContext<GameContext | null>(null);

export function useGame(): GameContext {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGame fora do GameProvider');
  return c;
}

export function GameProvider({ children, fallback }: { children: ReactNode; fallback: (start: (name: string, cls: ClassId) => void) => ReactNode }) {
  const [save, setSave] = useState<SaveData | null>(() => repository.load());
  const [screen, setScreen] = useState<Screen>('dashboard');
  const saveRef = useRef(save);
  const listeners = useRef(new Set<Listener>());

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => { listeners.current.delete(l); };
  }, []);

  const commit = useCallback((next: SaveData, events: GameEvent[]) => {
    saveRef.current = next;
    setSave(next);
    repository.save(next);
    if (events.length) listeners.current.forEach(l => l(events));
  }, []);

  const run = useCallback((fn: (s: SaveData) => Result): Result => {
    const cur = saveRef.current;
    if (!cur) throw new Error('Sem save');
    const r = fn(cur);
    if (r.s !== cur || r.events.length) commit(r.s, r.events);
    return r;
  }, [commit]);

  // virada de dia: ao abrir, ao voltar para a aba e a cada minuto
  useEffect(() => {
    if (!save) return;
    const tick = () => { if (saveRef.current) run(rollover); };
    tick();
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [save === null, run]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSoundEnabled(save?.settings.sound ?? true); }, [save?.settings.sound]);

  const value = useMemo<GameContext | null>(() => save && {
    s: save,
    run,
    screen,
    go: (sc: Screen) => { setScreen(sc); window.scrollTo(0, 0); },
    replace: (s: SaveData) => commit(s, [{ type: 'info', text: 'Save carregado!' }]),
    reset: () => { repository.clear(); saveRef.current = null; setSave(null); setScreen('dashboard'); },
    subscribe,
  }, [save, run, screen, commit, subscribe]);

  if (!value) {
    return <>{fallback((name, cls) => { const s = newGame(name, cls); commit(s, []); })}</>;
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
