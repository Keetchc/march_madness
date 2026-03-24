import type { Bracket, Game, Round, Team } from "./types";

export const COMPARE_ROUND_BASE_POINTS: Record<Round, number> = {
  R64: 1,
  R32: 2,
  S16: 4,
  E8: 8,
  F4: 14,
  NCG: 22,
};

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

function getPotentialPointsForPick(game: Game, teamId: string | undefined, teamsMap: Map<string, Team>) {
  if (!teamId) return 0;
  return COMPARE_ROUND_BASE_POINTS[game.round] * (teamsMap.get(teamId)?.seed ?? 1);
}

export function computeBracketCompareDiffs(
  bracketA: Bracket,
  bracketB: Bracket,
  games: Game[],
  teamsMap: Map<string, Team>
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
      const aWon = game.winnerId === aPick;
      const bWon = game.winnerId === bPick;
      const aPoints = aWon ? getPotentialPointsForPick(game, aPick, teamsMap) : 0;
      const bPoints = bWon ? getPotentialPointsForPick(game, bPick, teamsMap) : 0;
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

    const aAlive = !eliminatedTeams.has(aPick);
    const bAlive = !eliminatedTeams.has(bPick);
    const aPoints = aAlive ? getPotentialPointsForPick(game, aPick, teamsMap) : 0;
    const bPoints = bAlive ? getPotentialPointsForPick(game, bPick, teamsMap) : 0;
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
