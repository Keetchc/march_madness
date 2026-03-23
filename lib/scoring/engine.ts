import type { Bracket, Game, Team, Round, LeaderboardEntry, BracketStatus, CriticalGame } from "../types";

const ROUND_BASE_POINTS: Record<Round, number> = {
  R64: 1,
  R32: 2,
  S16: 4,
  E8: 8,
  F4: 14,
  NCG: 22,
};

interface ScoreResult {
  score: number;
  maxPossibleScore: number;
  roundBreakdown: Record<Round, number>;
  correctPicks: number;
  totalCompletedGames: number;
}

/**
 * Score formula: for each correct pick, score = base_points_for_round * seed_of_picked_team.
 * This rewards picking upsets -- a 12-seed correct in R64 = 1*12 = 12 pts vs 1-seed = 1*1 = 1 pt.
 */
export function scoreBracket(
  bracket: Bracket,
  games: Game[],
  teams: Map<string, Team>,
): ScoreResult {
  const roundBreakdown: Record<Round, number> = {
    R64: 0, R32: 0, S16: 0, E8: 0, F4: 0, NCG: 0,
  };

  let score = 0;
  let correctPicks = 0;
  let totalCompletedGames = 0;

  const completedGames = games.filter((g) => g.status === "final");
  const pendingGames = games.filter((g) => g.status !== "final");

  // Build a set of eliminated team IDs (lost a game)
  const eliminatedTeams = new Set<string>();
  for (const game of completedGames) {
    if (!game.winnerId) continue;
    if (game.team1Id && game.team1Id !== game.winnerId) eliminatedTeams.add(game.team1Id);
    if (game.team2Id && game.team2Id !== game.winnerId) eliminatedTeams.add(game.team2Id);
  }

  for (const game of completedGames) {
    if (!game.winnerId) continue;
    totalCompletedGames++;

    const userPick = bracket.picks[game.gameId];
    if (userPick === game.winnerId) {
      const pickedTeam = teams.get(userPick);
      const seed = pickedTeam?.seed ?? 1;
      const pts = ROUND_BASE_POINTS[game.round] * seed;

      score += pts;
      roundBreakdown[game.round] += pts;
      correctPicks++;
    }
  }

  // Max possible: current score + potential points from remaining games
  let maxPossibleScore = score;
  for (const game of pendingGames) {
    const userPick = bracket.picks[game.gameId];
    if (!userPick) continue;

    if (!eliminatedTeams.has(userPick)) {
      const pickedTeam = teams.get(userPick);
      const seed = pickedTeam?.seed ?? 1;
      maxPossibleScore += ROUND_BASE_POINTS[game.round] * seed;
    }
  }

  return {
    score: Math.round(score),
    maxPossibleScore: Math.round(maxPossibleScore),
    roundBreakdown,
    correctPicks,
    totalCompletedGames,
  };
}

/**
 * Build a sorted leaderboard from a list of brackets + game/team context.
 */
export function buildLeaderboard(
  brackets: Bracket[],
  users: Map<string, { name: string; picture: string }>,
  games: Game[],
  teams: Map<string, Team>,
): LeaderboardEntry[] {
  const completedGames = games.filter((g) => g.status === "final");
  const pendingGames = games.filter((g) => g.status !== "final");

  const eliminatedTeams = new Set<string>();
  for (const game of completedGames) {
    if (!game.winnerId) continue;
    if (game.team1Id && game.team1Id !== game.winnerId) eliminatedTeams.add(game.team1Id);
    if (game.team2Id && game.team2Id !== game.winnerId) eliminatedTeams.add(game.team2Id);
  }

  const entries: LeaderboardEntry[] = brackets.map((bracket) => {
    const result = scoreBracket(bracket, games, teams);
    const user = users.get(bracket.userId);
    return {
      rank: 0,
      userId: bracket.userId,
      userName: user?.name ?? "Unknown",
      userPicture: user?.picture ?? "",
      bracketId: bracket.bracketId,
      bracketName: bracket.name,
      score: result.score,
      maxPossibleScore: result.maxPossibleScore,
      roundBreakdown: result.roundBreakdown,
      correctPicks: result.correctPicks,
      gamesDecidedCount: result.totalCompletedGames,
      status: "alive" as BracketStatus,
      criticalGames: [],
    };
  });

  entries.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : b.maxPossibleScore - a.maxPossibleScore
  );

  let rank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].score < entries[i - 1].score) {
      rank = i + 1;
    }
    entries[i].rank = rank;
  }

  if (entries.length === 0) return entries;

  const leaderScore = entries[0].score;
  const bracketMap = new Map(brackets.map((b) => [b.bracketId, b]));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.score === leaderScore) {
      entry.status = "leader";
      continue;
    }

    if (entry.maxPossibleScore <= leaderScore) {
      entry.status = "eliminated";
      continue;
    }

    entry.status = computeStatusAgainstField(
      entry,
      entries,
      i,
      bracketMap,
      pendingGames,
      eliminatedTeams,
      teams,
    );
  }

  for (let i = 0; i < entries.length; i++) {
    entries[i].criticalGames = computeCriticalGames(
      entries[i],
      entries,
      i,
      bracketMap,
      pendingGames,
      eliminatedTeams,
      teams,
    );
  }

  return entries;
}

function computeCriticalGames(
  entry: LeaderboardEntry,
  entries: LeaderboardEntry[],
  entryIndex: number,
  bracketMap: Map<string, Bracket>,
  pendingGames: Game[],
  eliminatedTeams: Set<string>,
  teams: Map<string, Team>,
): CriticalGame[] {
  if (entryIndex === 0) return [];

  const myBracket = bracketMap.get(entry.bracketId);
  if (!myBracket) return [];

  const gapToLeader = entries[0].score - entry.score;
  if (gapToLeader <= 0) return [];

  const aheadRivals = entries.slice(0, entryIndex);
  const games: CriticalGame[] = [];

  for (const game of pendingGames) {
    const myPick = myBracket.picks[game.gameId];
    if (!myPick || eliminatedTeams.has(myPick)) continue;

    const pickedTeam = teams.get(myPick);
    const potentialPoints = ROUND_BASE_POINTS[game.round] * (pickedTeam?.seed ?? 1);
    const rivalsAheadWithDifferentPick = aheadRivals.reduce((count, rival) => {
      const rivalBracket = bracketMap.get(rival.bracketId);
      if (!rivalBracket) return count;
      return rivalBracket.picks[game.gameId] !== myPick ? count + 1 : count;
    }, 0);

    // Weight by how many brackets above them can lose relative ground.
    const swingScore = potentialPoints * (1 + rivalsAheadWithDifferentPick * 0.6);
    games.push({
      gameId: game.gameId,
      round: game.round,
      teamId: myPick,
      teamName: pickedTeam?.shortName ?? pickedTeam?.name ?? "TBD",
      potentialPoints,
      swingScore: Math.round(swingScore * 10) / 10,
      rivalsAheadWithDifferentPick,
      isMustHave: false,
    });
  }

  games.sort((a, b) => b.swingScore - a.swingScore);

  let covered = 0;
  for (const game of games) {
    if (covered < gapToLeader) {
      game.isMustHave = true;
      covered += game.potentialPoints;
    }
  }

  return games.slice(0, 5);
}

/**
 * Determine a bracket's status by comparing against EVERY bracket currently
 * at or above it. A bracket is eliminated if there is ANY rival it can never
 * catch -- even a bracket with nearly identical picks that will always stay
 * one step ahead.
 *
 * Best-case for the challenger: all of their alive picks win. In differing
 * games, the challenger gains points and the rival doesn't. In agreed games,
 * both gain the same, so the gap doesn't change. Only the challenger's gains
 * from differing games can close the gap.
 */
function computeStatusAgainstField(
  entry: LeaderboardEntry,
  entries: LeaderboardEntry[],
  entryIndex: number,
  bracketMap: Map<string, Bracket>,
  pendingGames: Game[],
  eliminatedTeams: Set<string>,
  teams: Map<string, Team>,
): BracketStatus {
  const myBracket = bracketMap.get(entry.bracketId)!;
  let tightestCushion = Infinity;
  let tightestGap = 0;

  for (let j = 0; j < entryIndex; j++) {
    const rival = entries[j];
    const gap = rival.score - entry.score;
    if (gap <= 0) continue;

    const rivalBracket = bracketMap.get(rival.bracketId)!;
    let bestCaseGain = 0;

    for (const game of pendingGames) {
      const myPick = myBracket.picks[game.gameId];
      const rivalPick = rivalBracket.picks[game.gameId];

      if (!myPick || myPick === rivalPick) continue;
      if (eliminatedTeams.has(myPick)) continue;

      const pickedTeam = teams.get(myPick);
      bestCaseGain += ROUND_BASE_POINTS[game.round] * (pickedTeam?.seed ?? 1);
    }

    if (bestCaseGain < gap) {
      return "eliminated";
    }

    const cushion = bestCaseGain - gap;
    if (cushion < tightestCushion) {
      tightestCushion = cushion;
      tightestGap = gap;
    }
  }

  if (entry.maxPossibleScore > entries[0].maxPossibleScore) {
    return "alive";
  }

  if (tightestGap === 0 || tightestCushion > tightestGap * 0.5) {
    return "alive";
  }

  return "longshot";
}
