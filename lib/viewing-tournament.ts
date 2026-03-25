import { cookies } from "next/headers";

/** Cookie storing which tournament year the user is browsing (official bracket, lists, leaderboard). */
export const VIEWING_TOURNAMENT_COOKIE = "mm_view_tid";

/** Deployment default season (create bracket, ESPN sync, scoring fallback). */
export function defaultTournamentId(): string {
  return (process.env.TOURNAMENT_ID ?? "2026").trim();
}

/**
 * Seasons shown in the UI and accepted for the viewing cookie.
 * Example: `TOURNAMENT_SEASONS=2024,2025,2026`
 */
export function getConfiguredSeasonIds(): string[] {
  const raw = process.env.TOURNAMENT_SEASONS?.trim();
  if (raw) {
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) return ids;
  }
  return [defaultTournamentId()];
}

export function normalizeViewingTournamentId(
  queryTournamentId: string | null | undefined,
  cookieTournamentId: string | undefined | null,
): string {
  const allowed = getConfiguredSeasonIds();
  const fallback = defaultTournamentId();
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
export function getViewingTournamentIdFromCookies(): string {
  const cookieVal = cookies().get(VIEWING_TOURNAMENT_COOKIE)?.value;
  return normalizeViewingTournamentId(null, cookieVal);
}

export function resolveTournamentIdFromRequestUrl(req: Request): string {
  const url = new URL(req.url);
  const q = url.searchParams.get("tournamentId");
  const cookieVal = cookies().get(VIEWING_TOURNAMENT_COOKIE)?.value;
  return normalizeViewingTournamentId(q, cookieVal);
}
