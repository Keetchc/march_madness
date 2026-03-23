// ─── Tournament & Games ───────────────────────────────────────────────────────

export type Round =
  | "R64"   // Round of 64
  | "R32"   // Round of 32
  | "S16"   // Sweet 16
  | "E8"    // Elite 8
  | "F4"    // Final Four
  | "NCG";  // National Championship Game

export type Region = "East" | "West" | "South" | "Midwest" | "FinalFour";

export type GameStatus = "scheduled" | "in_progress" | "final";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  seed: number;
  region: Region;
  espnId?: string;
  logoUrl?: string;
  color?: string;
}

export interface Game {
  gameId: string;
  tournamentId: string;
  round: Round;
  region: Region;
  // Slot in bracket (e.g. which game in R64 = 1-32)
  bracketSlot: number;
  // The two teams playing (null if not yet determined)
  team1Id: string | null;
  team2Id: string | null;
  // Feeds into which game in the next round
  nextGameId: string | null;
  nextGameSlot: 1 | 2 | null; // which slot (team1 or team2) winner fills
  // Results
  winnerId: string | null;
  score1: number | null;
  score2: number | null;
  status: GameStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  // ESPN sync
  espnGameId?: string;
}

export interface Tournament {
  tournamentId: string;
  name: string;
  year: number;
  status: "pending" | "active" | "complete";
  lockDate: string; // ISO - picks close at this time
  createdAt: string;
  /** When true, members can create/edit brackets regardless of lockDate (admin-controlled). */
  picksOpenOverride?: boolean;
}

// ─── Brackets & Picks ─────────────────────────────────────────────────────────

// Map of gameId -> teamId (the team the user picked to win that game)
export type Picks = Record<string, string>;

export interface Bracket {
  bracketId: string;
  userId: string;
  tournamentId: string;
  name: string;
  picks: Picks;
  score: number;
  maxPossibleScore: number;
  isEliminated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface RoundScoringRule {
  basePoints: number;
  upsetMultiplier: number; // multiplier applied when a lower seed wins
}

export interface ScoringRules {
  rounds: Record<Round, RoundScoringRule>;
  bonuses: {
    correctChampion: number;
    perfectRound: number;
  };
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  rounds: {
    R64: { basePoints: 1,  upsetMultiplier: 0 },
    R32: { basePoints: 2,  upsetMultiplier: 0 },
    S16: { basePoints: 4,  upsetMultiplier: 0 },
    E8:  { basePoints: 8,  upsetMultiplier: 0 },
    F4:  { basePoints: 16, upsetMultiplier: 0 },
    NCG: { basePoints: 32, upsetMultiplier: 0 },
  },
  bonuses: {
    correctChampion: 0,
    perfectRound: 0,
  },
};

export const UPSET_SCORING_RULES: ScoringRules = {
  rounds: {
    R64: { basePoints: 1,  upsetMultiplier: 1.0 },
    R32: { basePoints: 2,  upsetMultiplier: 1.5 },
    S16: { basePoints: 4,  upsetMultiplier: 2.0 },
    E8:  { basePoints: 8,  upsetMultiplier: 2.5 },
    F4:  { basePoints: 16, upsetMultiplier: 3.0 },
    NCG: { basePoints: 32, upsetMultiplier: 0.0 },
  },
  bonuses: {
    correctChampion: 25,
    perfectRound: 50,
  },
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export interface Group {
  groupId: string;
  name: string;
  adminUserId: string;
  tournamentId: string;
  inviteToken: string;
  scoringRules: ScoringRules;
  createdAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  bracketId: string;
  joinedAt: string;
  currentScore: number;
  rank: number;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AppUser {
  userId: string; // Google sub
  name: string;
  email: string;
  picture: string;
  isAdmin: boolean;
  createdAt: string;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export type BracketStatus = "leader" | "alive" | "longshot" | "eliminated";

export interface CriticalGame {
  gameId: string;
  round: Round;
  teamId: string;
  teamName: string;
  potentialPoints: number;
  swingScore: number;
  rivalsAheadWithDifferentPick: number;
  isMustHave: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userPicture: string;
  bracketId: string;
  bracketName: string;
  score: number;
  maxPossibleScore: number;
  roundBreakdown: Record<Round, number>;
  correctPicks: number;
  /** Tournament games already final with a winner (denominator for correct / decided) */
  gamesDecidedCount: number;
  status: BracketStatus;
  criticalGames: CriticalGame[];
}

// ─── ESPN API ─────────────────────────────────────────────────────────────────

export interface EspnCompetitor {
  id: string;
  score: string;
  winner: boolean;
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    color?: string;
    logo?: string;
  };
}

export interface EspnEvent {
  id: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string; // "STATUS_FINAL" | "STATUS_IN_PROGRESS" | "STATUS_SCHEDULED"
      completed: boolean;
    };
  };
  competitions: Array<{
    competitors: EspnCompetitor[];
  }>;
  season?: {
    type: number;
    slug: string;
  };
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface GamePicksResponse {
  game: Game;
  team1: Team | null;
  team2: Team | null;
  /** When true, `picks` is empty because brackets are still open; others' picks are not revealed. */
  picksHidden?: boolean;
  picks: Array<{
    userId: string;
    userName: string;
    userPicture: string;
    pickedTeamId: string;
    pickedTeamName: string;
    isCorrect: boolean | null; // null if game not complete
  }>;
}

