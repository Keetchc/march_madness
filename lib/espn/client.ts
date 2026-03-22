import type { EspnEvent, Game } from "../types";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

// groups=100 scopes to NCAA Tournament games during March Madness
const SCOREBOARD_URL = `${ESPN_BASE}/scoreboard?groups=100&limit=50`;

export interface EspnScoreboardResponse {
  events: EspnEvent[];
}

/**
 * Fetch the current NCAA tournament scoreboard from ESPN's unofficial API.
 * Returns raw ESPN events. Caller maps to our Game type.
 */
export async function fetchEspnScoreboard(): Promise<EspnEvent[]> {
  const res = await fetch(SCOREBOARD_URL, {
    // No-cache so we always get fresh data during polling
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MarchMadnessBracketApp/1.0)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`ESPN API error: ${res.status} ${res.statusText}`);
  }

  const data: EspnScoreboardResponse = await res.json();
  return data.events ?? [];
}

/**
 * Fetch details for a single ESPN game by ID.
 */
export async function fetchEspnGame(espnGameId: string): Promise<EspnEvent | null> {
  const url = `${ESPN_BASE}/summary?event=${espnGameId}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data ?? null;
}

/**
 * Map ESPN status string to our GameStatus type.
 */
export function mapEspnStatus(espnStatusName: string): Game["status"] {
  if (espnStatusName === "STATUS_FINAL") return "final";
  if (espnStatusName === "STATUS_IN_PROGRESS") return "in_progress";
  return "scheduled";
}

/**
 * Extract the winner from an ESPN event (returns ESPN team ID or null).
 */
export function extractEspnWinner(event: EspnEvent): string | null {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const winner = competitors.find((c) => c.winner);
  return winner?.team?.id ?? null;
}

/**
 * Extract scores from an ESPN event.
 * Returns [score1, score2] matching competitors order.
 */
export function extractEspnScores(event: EspnEvent): [number, number] {
  const comps = event.competitions?.[0]?.competitors ?? [];
  return [
    parseInt(comps[0]?.score ?? "0", 10),
    parseInt(comps[1]?.score ?? "0", 10),
  ];
}

