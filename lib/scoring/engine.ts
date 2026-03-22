import type { Bracket, Game, Team, Round, LeaderboardEntry, BracketStatus } from "../types";

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
      totalPicks: Object.keys(bracket.picks).length,
      status: "alive" as BracketStatus,
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

  const leader = entries[0];
  const leaderBracket = brackets.find((b) => b.bracketId === leader.bracketId)!;
  leader.status = "leader";

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.maxPossibleScore <= leader.score) {
      entry.status = "eliminated";
      continue;
    }

    const challengerBracket = brackets.find((b) => b.bracketId === entry.bracketId)!;
    const status = computeDifferentialStatus(
      entry,
      leader,
      challengerBracket,
      leaderBracket,
      pendingGames,
      eliminatedTeams,
      teams,
    );
    entry.status = status;
  }

  return entries;
}

/**
 * Compare a challenger's remaining picks against the leader to determine
 * whether they're alive, a long shot, or effectively eliminated.
 *
 * Only games where they picked differently can change the gap.
 * "bestCaseDifferential" assumes the challenger gets every differing pick right
 * and the leader gets zero from those games.
 */
function computeDifferentialStatus(
  challenger: LeaderboardEntry,
  leader: LeaderboardEntry,
  challengerBracket: Bracket,
  leaderBracket: Bracket,
  pendingGames: Game[],
  eliminatedTeams: Set<string>,
  teams: Map<string, Team>,
): BracketStatus {
  const gap = leader.score - challenger.score;
  let differentialGain = 0;

  for (const game of pendingGames) {
    const challengerPick = challengerBracket.picks[game.gameId];
    const leaderPick = leaderBracket.picks[game.gameId];

    if (!challengerPick) continue;
    if (challengerPick === leaderPick) continue;
    if (eliminatedTeams.has(challengerPick)) continue;

    const pickedTeam = teams.get(challengerPick);
    const seed = pickedTeam?.seed ?? 1;
    const challengerGain = ROUND_BASE_POINTS[game.round] * seed;

    let leaderLoss = 0;
    if (leaderPick && !eliminatedTeams.has(leaderPick)) {
      const leaderTeam = teams.get(leaderPick);
      const leaderSeed = leaderTeam?.seed ?? 1;
      leaderLoss = ROUND_BASE_POINTS[game.round] * leaderSeed;
    }

    differentialGain += challengerGain + leaderLoss;
  }

  if (differentialGain < gap) {
    return "eliminated";
  }

  if (challenger.maxPossibleScore > leader.maxPossibleScore) {
    return "alive";
  }

  const cushion = differentialGain - gap;
  const threshold = gap * 0.5;
  if (cushion > threshold || gap === 0) {
    return "alive";
  }

  return "longshot";
}
