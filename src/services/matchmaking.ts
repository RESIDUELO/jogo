// Matchmaking. Interface pronta para um backend real (fila em Supabase Realtime,
// Firebase ou WebSocket). A implementação local não tem jogadores online, então
// amplia a janela de rating progressivamente e, sem ninguém encontrado,
// oferece um BOT de rating próximo — o usuário nunca espera indefinidamente.
import { BOTS, BOT_TIERS, type BotPersona } from '../data/bots';

export type SearchStatus =
  | { phase: 'searching'; window: number; elapsed: number }
  | { phase: 'found'; opponentId: string; opponentName: string; rating: number }
  | { phase: 'timeout'; bot: BotPersona };

export interface MatchmakingService {
  search(me: { id: string; rating: number }, onUpdate: (s: SearchStatus) => void): { cancel: () => void };
}

export function closestBot(rating: number, exclude?: string): BotPersona {
  const cands = BOTS.filter((b) => b.id !== exclude);
  const sorted = cands.sort((a, b) => Math.abs(BOT_TIERS[a.tier].rating - rating) - Math.abs(BOT_TIERS[b.tier].rating - rating));
  // entre os 2 mais próximos, sorteia para variar
  return sorted[Math.floor(Math.random() * Math.min(2, sorted.length))];
}

export class LocalMatchmaking implements MatchmakingService {
  constructor(
    private stepMs = 1200,
    private maxMs = 7200,
  ) {}

  search(me: { id: string; rating: number }, onUpdate: (s: SearchStatus) => void) {
    const start = Date.now();
    let window = 50;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      window = Math.min(400, window + 60); // amplia a faixa de rating
      // Em um backend real: consultar a fila por jogadores com |rating - me.rating| <= window.
      if (elapsed >= this.maxMs) {
        clearInterval(timer);
        onUpdate({ phase: 'timeout', bot: closestBot(me.rating) });
      } else onUpdate({ phase: 'searching', window, elapsed });
    }, this.stepMs);
    onUpdate({ phase: 'searching', window, elapsed: 0 });
    return { cancel: () => clearInterval(timer) };
  }
}

export const matchmaking: MatchmakingService = new LocalMatchmaking();
