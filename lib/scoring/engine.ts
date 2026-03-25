import {
  ROUNDS_IN_ORDER,
  type Bracket,
  type Game,
  type Team,
  type Round,
  type LeaderboardEntry,
  type BracketStatus,
  type CriticalGame,
  type ScoringRules,
  type Picks,
} from "../types";

/** Dynamo / APIs may use different casing; scoring must treat completed games consistently. */
export function isGameFinalStatus(status: Game["status"] | string | undefined): boolean {
  return String(status ?? "").toLowerCase() === "final";
}

/** Normalize picks map (missing picks, non-string values, key types). */
export function coerceBracketPicks(picks: Picks | undefined | null): Record<string, string> {
  if (!picks || typeof picks !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(picks)) {
    if (typeof v === "string" && v.length > 0) out[String(k)] = v;
  }
  return out;
}

export function getPickForGame(picks: Record<string, string>, gameId: string): string | undefined {
  return picks[gameId] ?? picks[String(gameId)];
}

const ROUND_BASE_POINTS: Record<Round, number> = {
  R64: 1,
  R32: 2,
  S16: 4,
  E8: 8,
  F4: 14,
  NCG: 22,
};

function baseForRound(round: Round, rules?: ScoringRules): number {
  const fromRules = rules?.rounds[round]?.basePoints;
  if (fromRules != null && fromRules > 0) return fromRules;
  return ROUND_BASE_POINTS[round];
}

function upsetMultiplierForRound(round: Round, rules?: ScoringRules): number {
  return rules?.rounds[round]?.upsetMultiplier ?? 0;
}

/** True if the game winner had a worse (higher) seed than the loser — NCAA 1 is best. */
function isNcaaUpsetGame(game: Game, teams: Map<string, Team>): boolean {
  if (!game.winnerId || !game.team1Id || !game.team2Id) return false;
  const loserId = game.winnerId === game.team1Id ? game.team2Id : game.team1Id;
  const ws = teams.get(game.winnerId)?.seed ?? 0;
  const ls = teams.get(loserId)?.seed ?? 0;
  return ws > ls;
}

function pointsForCorrectPick(game: Game, pickedTeamId: string, teams: Map<string, Team>, rules?: ScoringRules): number {
  const pickedTeam = teams.get(pickedTeamId);
  const seed = pickedTeam?.seed ?? 1;
  const base = baseForRound(game.round, rules);
  let pts = base * seed;
  const um = upsetMultiplierForRound(game.round, rules);
  if (um > 0 && isNcaaUpsetGame(game, teams)) {
    pts *= 1 + um;
  }
  return pts;
}

function maxPointsForAlivePick(game: Game, teamId: string, teams: Map<string, Team>, rules?: ScoringRules): number {
  const seed = teams.get(teamId)?.seed ?? 1;
  return baseForRound(game.round, rules) * seed;
}

/**
 * Points for a correct pick on a final game — same as scoreBracket (includes NCG champion bonus when rules define it).
 */
export function compareResolvedPointsForPick(
  game: Game,
  pick: string,
  teams: Map<string, Team>,
  rules?: ScoringRules,
): number {
  if (!isGameFinalStatus(game.status) || !game.winnerId || pick !== game.winnerId) return 0;
  let pts = pointsForCorrectPick(game, pick, teams, rules);
  const champ = rules?.bonuses?.correctChampion ?? 0;
  if (game.round === "NCG" && champ > 0) {
    pts += champ;
  }
  return pts;
}

/**
 * Remaining upside for this pick on a pending game — same base × seed as scoreBracket max path, plus champion bonus on open NCG.
 */
export function comparePendingPotentialForPick(
  game: Game,
  pick: string,
  teams: Map<string, Team>,
  eliminatedTeams: Set<string>,
  rules?: ScoringRules,
): number {
  if (isGameFinalStatus(game.status) || !pick || eliminatedTeams.has(pick)) return 0;
  let pts = maxPointsForAlivePick(game, pick, teams, rules);
  const champ = rules?.bonuses?.correctChampion ?? 0;
  if (game.round === "NCG" && champ > 0) {
    pts += champ;
  }
  return pts;
}

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
  scoringRules?: ScoringRules,
): ScoreResult {
  const picksMap = coerceBracketPicks(bracket.picks);

  const roundBreakdown: Record<Round, number> = {
    R64: 0, R32: 0, S16: 0, E8: 0, F4: 0, NCG: 0,
  };

  let score = 0;
  let correctPicks = 0;
  let totalCompletedGames = 0;

  const completedGames = games.filter((g) => isGameFinalStatus(g.status));
  const pendingGames = games.filter((g) => !isGameFinalStatus(g.status));

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

    const userPick = getPickForGame(picksMap, game.gameId);
    if (userPick === game.winnerId) {
      const pts = pointsForCorrectPick(game, userPick, teams, scoringRules);

      score += pts;
      roundBreakdown[game.round] += pts;
      correctPicks++;
    }
  }

  const champBonus = scoringRules?.bonuses?.correctChampion ?? 0;
  if (champBonus > 0) {
    const ncg = completedGames.find((g) => g.round === "NCG" && isGameFinalStatus(g.status) && g.winnerId);
    if (ncg && getPickForGame(picksMap, ncg.gameId) === ncg.winnerId) {
      score += champBonus;
      roundBreakdown.NCG += champBonus;
    }
  }

  const perfectRoundBonus = scoringRules?.bonuses?.perfectRound ?? 0;
  if (perfectRoundBonus > 0) {
    for (const round of ROUNDS_IN_ORDER) {
      const inRound = games.filter((g) => g.round === round);
      if (inRound.length === 0) continue;
      const allFinal = inRound.every((g) => isGameFinalStatus(g.status) && g.winnerId);
      if (!allFinal) continue;
      const allCorrect = inRound.every((g) => {
        const p = getPickForGame(picksMap, g.gameId);
        return Boolean(p && p === g.winnerId);
      });
      if (allCorrect) {
        score += perfectRoundBonus;
        roundBreakdown[round] += perfectRoundBonus;
      }
    }
  }

  // Max possible: current score + potential points from remaining games
  let maxPossibleScore = score;
  for (const game of pendingGames) {
    const userPick = getPickForGame(picksMap, game.gameId);
    if (!userPick) continue;

    if (!eliminatedTeams.has(userPick)) {
      maxPossibleScore += maxPointsForAlivePick(game, userPick, teams, scoringRules);
    }
  }

  if (champBonus > 0) {
    const ncgPending = pendingGames.find((g) => g.round === "NCG");
    if (ncgPending) {
      const p = getPickForGame(picksMap, ncgPending.gameId);
      if (p && !eliminatedTeams.has(p)) {
        maxPossibleScore += champBonus;
      }
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
  scoringRules?: ScoringRules,
): LeaderboardEntry[] {
  const completedGames = games.filter((g) => isGameFinalStatus(g.status));
  const pendingGames = games.filter((g) => !isGameFinalStatus(g.status));

  const eliminatedTeams = new Set<string>();
  for (const game of completedGames) {
    if (!game.winnerId) continue;
    if (game.team1Id && game.team1Id !== game.winnerId) eliminatedTeams.add(game.team1Id);
    if (game.team2Id && game.team2Id !== game.winnerId) eliminatedTeams.add(game.team2Id);
  }

  const entries: LeaderboardEntry[] = brackets.map((bracket) => {
    const result = scoreBracket(bracket, games, teams, scoringRules);
    const user = users.get(String(bracket.userId));
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
      nextSliceRound: null,
      nextSliceCriticalGames: [],
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
      scoringRules,
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
      scoringRules,
    );
  }

  const nextSliceRound = firstRoundWithPendingGames(games);
  const slicePendingGames =
    nextSliceRound != null
      ? pendingGames.filter((g) => g.round === nextSliceRound)
      : [];

  for (let i = 0; i < entries.length; i++) {
    entries[i].nextSliceRound = nextSliceRound;
    entries[i].nextSliceCriticalGames =
      slicePendingGames.length > 0
        ? computeNextSliceCriticalGames(
            entries[i],
            entries,
            bracketMap,
            slicePendingGames,
            eliminatedTeams,
            teams,
            scoringRules,
          )
        : [];
  }

  return entries;
}

function firstRoundWithPendingGames(allGames: Game[]): Round | null {
  for (const r of ROUNDS_IN_ORDER) {
    if (allGames.some((g) => g.round === r && !isGameFinalStatus(g.status))) {
      return r;
    }
  }
  return null;
}

/** Pending games in the “next” open round vs everyone else in this leaderboard (not only people ahead of you). */
function computeNextSliceCriticalGames(
  entry: LeaderboardEntry,
  entries: LeaderboardEntry[],
  bracketMap: Map<string, Bracket>,
  slicePendingGames: Game[],
  eliminatedTeams: Set<string>,
  teams: Map<string, Team>,
  scoringRules?: ScoringRules,
): CriticalGame[] {
  if (slicePendingGames.length === 0) return [];

  const myBracket = bracketMap.get(entry.bracketId);
  if (!myBracket) return [];

  const myPicks = coerceBracketPicks(myBracket.picks);
  const otherPicksList = entries
    .filter((e) => e.bracketId !== entry.bracketId)
    .map((e) => {
      const b = bracketMap.get(e.bracketId);
      return b ? coerceBracketPicks(b.picks) : null;
    });

  const out: CriticalGame[] = [];

  for (const game of slicePendingGames) {
    const myPick = getPickForGame(myPicks, game.gameId);
    if (!myPick || eliminatedTeams.has(myPick)) continue;

    const pickedTeam = teams.get(myPick);
    const potentialPoints = maxPointsForAlivePick(game, myPick, teams, scoringRules);

    let rivalsWithDifferentPick = 0;
    for (const rp of otherPicksList) {
      if (!rp) continue;
      const theirPick = getPickForGame(rp, game.gameId);
      if (!theirPick) continue;
      if (theirPick !== myPick) rivalsWithDifferentPick++;
    }

    if (entries.length > 1 && rivalsWithDifferentPick === 0) continue;

    const swingScore = potentialPoints * (1 + rivalsWithDifferentPick * 0.6);
    out.push({
      gameId: game.gameId,
      round: game.round,
      teamId: myPick,
      teamName: pickedTeam?.shortName ?? pickedTeam?.name ?? "TBD",
      potentialPoints,
      swingScore: Math.round(swingScore * 10) / 10,
      rivalsAheadWithDifferentPick: rivalsWithDifferentPick,
      isMustHave: false,
    });
  }

  out.sort((a, b) => b.swingScore - a.swingScore);
  return out.slice(0, 5);
}

function computeCriticalGames(
  entry: LeaderboardEntry,
  entries: LeaderboardEntry[],
  entryIndex: number,
  bracketMap: Map<string, Bracket>,
  pendingGames: Game[],
  eliminatedTeams: Set<string>,
  teams: Map<string, Team>,
  scoringRules?: ScoringRules,
): CriticalGame[] {
  const myBracket = bracketMap.get(entry.bracketId);
  if (!myBracket) return [];

  const myPicks = coerceBracketPicks(myBracket.picks);
  const leaderScore = entries.length > 0 ? entries[0].score : 0;
  const myScore = entry.score;

  const otherCoLeaders = entries.filter(
    (_, j) => j !== entryIndex && entries[j].score === leaderScore,
  );
  const tiedForFirst = myScore === leaderScore && otherCoLeaders.length > 0;

  let rivalPicksList: (Record<string, string> | null)[];
  /** Points “behind” the comparison set; for ties we use 1 so must-have highlights still apply. */
  let gapForMustHave: number;

  if (tiedForFirst) {
    rivalPicksList = otherCoLeaders.map((rival) => {
      const rb = bracketMap.get(rival.bracketId);
      return rb ? coerceBracketPicks(rb.picks) : null;
    });
    gapForMustHave = 1;
  } else {
    if (entryIndex === 0) return [];
    gapForMustHave = leaderScore - myScore;
    if (gapForMustHave <= 0) return [];

    const aheadRivals = entries.slice(0, entryIndex);
    rivalPicksList = aheadRivals.map((rival) => {
      const rb = bracketMap.get(rival.bracketId);
      return rb ? coerceBracketPicks(rb.picks) : null;
    });
  }

  const games: CriticalGame[] = [];

  for (const game of pendingGames) {
    const myPick = getPickForGame(myPicks, game.gameId);
    if (!myPick || eliminatedTeams.has(myPick)) continue;

    const pickedTeam = teams.get(myPick);
    const potentialPoints = maxPointsForAlivePick(game, myPick, teams, scoringRules);
    const rivalsAheadWithDifferentPick = rivalPicksList.reduce((count, rp) => {
      if (!rp) return count;
      return getPickForGame(rp, game.gameId) !== myPick ? count + 1 : count;
    }, 0);

    if (tiedForFirst && rivalsAheadWithDifferentPick === 0) continue;

    // Weight by how many rivals in the comparison set disagree on this game.
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
    if (covered < gapForMustHave) {
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
  scoringRules?: ScoringRules,
): BracketStatus {
  const myBracket = bracketMap.get(entry.bracketId)!;
  const myPicks = coerceBracketPicks(myBracket.picks);
  let tightestCushion = Infinity;
  let tightestGap = 0;

  for (let j = 0; j < entryIndex; j++) {
    const rival = entries[j];
    const gap = rival.score - entry.score;
    if (gap <= 0) continue;

    const rivalBracket = bracketMap.get(rival.bracketId)!;
    const rivalPicks = coerceBracketPicks(rivalBracket.picks);
    let bestCaseGain = 0;

    for (const game of pendingGames) {
      const myPick = getPickForGame(myPicks, game.gameId);
      const rivalPick = getPickForGame(rivalPicks, game.gameId);

      if (!myPick || myPick === rivalPick) continue;
      if (eliminatedTeams.has(myPick)) continue;

      bestCaseGain += maxPointsForAlivePick(game, myPick, teams, scoringRules);
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
