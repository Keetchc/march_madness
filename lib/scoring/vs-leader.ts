import type { Bracket, Game, LeaderboardEntry, ScoringRules, Team } from "../types";
import {
  coerceBracketPicks,
  comparePendingPotentialForPick,
  getPickForGame,
  isGameFinalStatus,
} from "./engine";

export interface VsLeaderSnapshot {
  leaderName: string;
  leaderUserId: string;
  pointsBehind: number;
  disagreePendingGames: number;
  /** Sum of your max remaining points on pending games where you and the leader picked different winners. */
  maxUpsideOnDisagreements: number;
}

function buildEliminatedTeams(completedGames: Game[]): Set<string> {
  const eliminatedTeams = new Set<string>();
  for (const game of completedGames) {
    if (!game.winnerId) continue;
    if (game.team1Id && game.team1Id !== game.winnerId) eliminatedTeams.add(game.team1Id);
    if (game.team2Id && game.team2Id !== game.winnerId) eliminatedTeams.add(game.team2Id);
  }
  return eliminatedTeams;
}

/**
 * Quick “you vs #1” read for the signed-in member: score gap, how many unfinished games you disagree on,
 * and rough upside if your side hits on those games (same potential-points idea as the leaderboard engine).
 */
export function computeVsLeaderSnapshot(
  myUserId: string,
  leaderboard: LeaderboardEntry[],
  bracketByUserId: Map<string, Bracket>,
  games: Game[],
  teams: Map<string, Team>,
  scoringRules: ScoringRules,
): VsLeaderSnapshot | null {
  if (leaderboard.length < 2) return null;

  const leader = leaderboard[0];
  if (String(leader.userId) === String(myUserId)) return null;

  const myEntry = leaderboard.find((e) => String(e.userId) === String(myUserId));
  if (!myEntry) return null;

  const myBracket = bracketByUserId.get(String(myUserId));
  const leaderBracket = bracketByUserId.get(String(leader.userId));
  if (!myBracket || !leaderBracket) return null;

  const completedGames = games.filter((g) => isGameFinalStatus(g.status));
  const pendingGames = games.filter((g) => !isGameFinalStatus(g.status));
  const eliminatedTeams = buildEliminatedTeams(completedGames);

  const myPicks = coerceBracketPicks(myBracket.picks);
  const leaderPicks = coerceBracketPicks(leaderBracket.picks);

  let disagreePendingGames = 0;
  let maxUpsideOnDisagreements = 0;

  for (const game of pendingGames) {
    const mp = getPickForGame(myPicks, game.gameId);
    const lp = getPickForGame(leaderPicks, game.gameId);
    if (!mp || !lp) continue;
    if (mp === lp) continue;
    if (eliminatedTeams.has(mp)) continue;

    disagreePendingGames++;
    maxUpsideOnDisagreements += comparePendingPotentialForPick(
      game,
      mp,
      teams,
      eliminatedTeams,
      scoringRules,
    );
  }

  return {
    leaderName: leader.userName,
    leaderUserId: leader.userId,
    pointsBehind: leader.score - myEntry.score,
    disagreePendingGames,
    maxUpsideOnDisagreements: Math.round(maxUpsideOnDisagreements),
  };
}
