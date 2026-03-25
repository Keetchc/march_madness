import type { Tournament } from "./types";

/** Minimal fields used for lock / countdown UI (full `Tournament` is assignable). */
export type TournamentLockSlice = Pick<Tournament, "lockDate" | "picksOpenOverride">;

/**
 * True after the configured picks-close time. Does not use `tournament.status` — seeded pools often
 * stay `pending` until tipoff; admins only set `lockDate` in /admin, and that must drive lock behavior.
 */
export function picksClosedByTournament(
  tournament: Pick<Tournament, "lockDate"> | null | undefined,
): boolean {
  if (!tournament) return false;
  return new Date() > new Date(tournament.lockDate);
}

/** True when players cannot create or edit brackets (honours `picksOpenOverride` on the tournament). */
export function picksEffectivelyClosed(tournament: TournamentLockSlice | null | undefined): boolean {
  if (!tournament) return false;
  if (tournament.picksOpenOverride === true) return false;
  return picksClosedByTournament(tournament);
}
