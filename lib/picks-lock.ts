import type { Tournament } from "./types";

/** True if lockDate has passed and tournament is not still in `pending` (pre-event) status. */
export function picksClosedByTournament(tournament: Tournament | null | undefined): boolean {
  if (!tournament) return false;
  return new Date() > new Date(tournament.lockDate) && tournament.status !== "pending";
}

/** True when players cannot create or edit brackets (honours `picksOpenOverride` on the tournament). */
export function picksEffectivelyClosed(tournament: Tournament | null | undefined): boolean {
  if (!tournament) return false;
  if (tournament.picksOpenOverride === true) return false;
  return picksClosedByTournament(tournament);
}
