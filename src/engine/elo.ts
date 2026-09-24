// Rating estilo Elo.
export function expectedScore(r: number, opp: number): number {
  return 1 / (1 + Math.pow(10, (opp - r) / 400));
}

export function eloDelta(r: number, opp: number, result: 1 | 0.5 | 0, gamesPlayed: number): number {
  const k = gamesPlayed < 20 ? 40 : r >= 1700 ? 24 : 32;
  return Math.round(k * (result - expectedScore(r, opp)));
}
