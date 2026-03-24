import type { Bracket, Game, Round, Team, ScoringRules } from "./types";
import { comparePendingPotentialForPick, compareResolvedPointsForPick } from "./scoring/engine";

export type CompareDiffGame = {
  gameId: string;
  round: Round;
  aTeamName: string;
  bTeamName: string;
  aPoints: number;
  bPoints: number;
  status: "pending" | "final";
  winnerName: string;
};

export function buildEliminatedTeams(games: Game[]): Set<string> {
  const eliminated = new Set<string>();
  for (const game of games) {
    if (game.status !== "final" || !game.winnerId) continue;
    if (game.team1Id && game.team1Id !== game.winnerId) eliminated.add(game.team1Id);
    if (game.team2Id && game.team2Id !== game.winnerId) eliminated.add(game.team2Id);
  }
  return eliminated;
}

/**
 * Head-to-head differing picks between two brackets. Point values match {@link scoreBracket} / group scoring rules.
 * Omit `scoringRules` to use the engine’s default round weights (pool-wide / legacy compare).
 */
export function computeBracketCompareDiffs(
  bracketA: Bracket,
  bracketB: Bracket,
  games: Game[],
  teamsMap: Map<string, Team>,
  scoringRules?: ScoringRules,
): {
  diffs: CompareDiffGame[];
  roundDiffCounts: Record<Round, number>;
  resolvedWinsA: number;
  resolvedWinsB: number;
  pendingPotentialA: number;
  pendingPotentialB: number;
} {
  const eliminatedTeams = buildEliminatedTeams(games);
  const diffs: CompareDiffGame[] = [];
  const roundDiffCounts: Record<Round, number> = {
    R64: 0,
    R32: 0,
    S16: 0,
    E8: 0,
    F4: 0,
    NCG: 0,
  };

  let resolvedWinsA = 0;
  let resolvedWinsB = 0;
  let pendingPotentialA = 0;
  let pendingPotentialB = 0;

  for (const game of games) {
    const aPick = bracketA.picks[game.gameId];
    const bPick = bracketB.picks[game.gameId];
    if (!aPick || !bPick || aPick === bPick) continue;

    roundDiffCounts[game.round] += 1;
    const aTeam = teamsMap.get(aPick);
    const bTeam = teamsMap.get(bPick);

    if (game.status === "final") {
      const aPoints = compareResolvedPointsForPick(game, aPick, teamsMap, scoringRules);
      const bPoints = compareResolvedPointsForPick(game, bPick, teamsMap, scoringRules);
      if (aPoints > bPoints) resolvedWinsA += 1;
      if (bPoints > aPoints) resolvedWinsB += 1;
      diffs.push({
        gameId: game.gameId,
        round: game.round,
        aTeamName: aTeam?.shortName ?? aTeam?.name ?? "TBD",
        bTeamName: bTeam?.shortName ?? bTeam?.name ?? "TBD",
        aPoints,
        bPoints,
        status: "final",
        winnerName: teamsMap.get(game.winnerId ?? "")?.shortName ?? "TBD",
      });
      continue;
    }

    const aPoints = comparePendingPotentialForPick(game, aPick, teamsMap, eliminatedTeams, scoringRules);
    const bPoints = comparePendingPotentialForPick(game, bPick, teamsMap, eliminatedTeams, scoringRules);
    pendingPotentialA += aPoints;
    pendingPotentialB += bPoints;
    diffs.push({
      gameId: game.gameId,
      round: game.round,
      aTeamName: aTeam?.shortName ?? aTeam?.name ?? "TBD",
      bTeamName: bTeam?.shortName ?? bTeam?.name ?? "TBD",
      aPoints,
      bPoints,
      status: "pending",
      winnerName: "TBD",
    });
  }

  return {
    diffs,
    roundDiffCounts,
    resolvedWinsA,
    resolvedWinsB,
    pendingPotentialA,
    pendingPotentialB,
  };
}
