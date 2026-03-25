import type { Game } from "../types";
import { isGameFinalStatus } from "./engine";

/**
 * Treat selected pending games as final with the given winner for scoring simulations.
 * Does not override games that are already final in `games`.
 */
export function applyWhatIfWinners(
  games: Game[],
  winnerByGameId: Record<string, string>
): Game[] {
  return games.map((g) => {
    if (isGameFinalStatus(g.status)) return g;
    const w = winnerByGameId[g.gameId] ?? winnerByGameId[String(g.gameId)];
    if (!w) return g;
    return { ...g, status: "final" as const, winnerId: w };
  });
}
