import type { Game, Picks } from "@/lib/types";

const ROUND_ORDER = ["R64", "R32", "S16", "E8", "F4", "NCG"] as const;

export interface ProjectionResult {
  games: Game[];
  projectedSlots: Set<string>;
  actualTeamOverrides: Map<string, string>;
}

/**
 * Project the user's picks forward through the entire bracket, always
 * showing the user's path regardless of actual results.
 *
 * When an actual game result has advanced a different team than the user
 * picked, the user's pick still fills the slot (so the bracket shows their
 * full path) and the actual team is recorded in `actualTeamOverrides`
 * keyed by "gameId:slot" so the UI can annotate it.
 *
 * `projectedSlots` tracks all slots that were filled or overridden by
 * projection (i.e., not the original DB value).
 */
export function projectPicksOntoGames(
  games: Game[],
  picks: Picks,
): ProjectionResult {
  const gameMap = new Map(games.map((g) => [g.gameId, { ...g }]));
  const projectedSlots = new Set<string>();
  const actualTeamOverrides = new Map<string, string>();

  for (const round of ROUND_ORDER) {
    for (const game of Array.from(gameMap.values())) {
      if (game.round !== round || !game.nextGameId) continue;

      const nextGame = gameMap.get(game.nextGameId);
      if (!nextGame) continue;

      const pickedWinner = picks[game.gameId] ?? game.winnerId;
      if (!pickedWinner) continue;

      const slotKey = `${nextGame.gameId}:${game.nextGameSlot}`;

      if (game.nextGameSlot === 1) {
        if (nextGame.team1Id && nextGame.team1Id !== pickedWinner) {
          actualTeamOverrides.set(slotKey, nextGame.team1Id);
        }
        if (!nextGame.team1Id || nextGame.team1Id !== pickedWinner) {
          nextGame.team1Id = pickedWinner;
          projectedSlots.add(slotKey);
        }
      } else if (game.nextGameSlot === 2) {
        if (nextGame.team2Id && nextGame.team2Id !== pickedWinner) {
          actualTeamOverrides.set(slotKey, nextGame.team2Id);
        }
        if (!nextGame.team2Id || nextGame.team2Id !== pickedWinner) {
          nextGame.team2Id = pickedWinner;
          projectedSlots.add(slotKey);
        }
      }
    }
  }

  return { games: Array.from(gameMap.values()), projectedSlots, actualTeamOverrides };
}
