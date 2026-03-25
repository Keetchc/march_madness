import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { listAllTournaments } from "@/lib/dynamo/queries/games";
import type { Tournament } from "@/lib/types";

/** Cookie storing which tournament year the user is browsing (official bracket, lists, leaderboard). */
export const VIEWING_TOURNAMENT_COOKIE = "mm_view_tid";

/** Deployment default season (create bracket, ESPN sync, scoring fallback). */
export function defaultTournamentId(): string {
  return (process.env.TOURNAMENT_ID ?? "2026").trim();
}

/**
 * Optional subset filter: `TOURNAMENT_SEASONS=2024,2025` shows only those ids if they exist in Dynamo.
 * If the filter would remove every id, it is ignored.
 */
function applySeasonEnvFilter(ids: string[]): string[] {
  const raw = process.env.TOURNAMENT_SEASONS?.trim();
  if (!raw) return ids;
  const want = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  const filtered = ids.filter((id) => want.has(id));
  return filtered.length > 0 ? filtered : ids;
}

async function loadTournamentsForPicker(): Promise<Tournament[]> {
  const rows = await listAllTournaments();
  let ordered = [...rows];
  ordered.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const wantIds = applySeasonEnvFilter(ordered.map((t) => t.tournamentId).filter(Boolean));
  const wantSet = new Set(wantIds);
  ordered = ordered.filter((t) => wantSet.has(t.tournamentId));
  return ordered;
}

/**
 * Cached scan + sort (tournament table also holds teams/games; avoid hammering Dynamo every request).
 */
export const getCachedTournamentsForSeasonPicker = unstable_cache(
  loadTournamentsForPicker,
  ["tournament-season-picker-list"],
  { revalidate: 30 },
);

export async function getAllowedTournamentIds(): Promise<string[]> {
  const tournaments = await getCachedTournamentsForSeasonPicker();
  const ids = tournaments.map((t) => t.tournamentId).filter(Boolean);
  if (ids.length > 0) return ids;
  return [defaultTournamentId()];
}

export function normalizeViewingTournamentId(
  queryTournamentId: string | null | undefined,
  cookieTournamentId: string | undefined | null,
  allowedIds: string[],
): string {
  const fallback = defaultTournamentId();
  const allowed = allowedIds.length > 0 ? allowedIds : [fallback];
  const pick = (raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (!t) return null;
    return allowed.includes(t) ? t : null;
  };
  return (
    pick(queryTournamentId) ??
    pick(cookieTournamentId ?? undefined) ??
    (allowed.includes(fallback) ? fallback : allowed[0] ?? fallback)
  );
}

/** Server components + route handlers (reads request cookies). */
export async function getViewingTournamentIdFromCookies(): Promise<string> {
  const allowed = await getAllowedTournamentIds();
  const cookieVal = cookies().get(VIEWING_TOURNAMENT_COOKIE)?.value;
  return normalizeViewingTournamentId(null, cookieVal, allowed);
}

export async function resolveTournamentIdFromRequestUrl(req: Request): Promise<string> {
  const url = new URL(req.url);
  const q = url.searchParams.get("tournamentId");
  const cookieVal = cookies().get(VIEWING_TOURNAMENT_COOKIE)?.value;
  const allowed = await getAllowedTournamentIds();
  return normalizeViewingTournamentId(q, cookieVal, allowed);
}
