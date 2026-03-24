import type { Bracket } from "../types";

/**
 * Resolves which tournament partition to load games/teams from for group scoring.
 * Empty-string group.tournamentId must not win over ?? (would query a bad pk).
 *
 * Prefer `envDefault` (TOURNAMENT_ID) when any linked bracket uses it so group
 * standings match `/leaderboard` for the same pool. Otherwise a conflicting or
 * arbitrary first Set entry could point at an empty/wrong partition while the
 * public leaderboard still shows scores.
 */
export function scoringTournamentIdForGroup(
  groupTournamentId: string | undefined,
  brackets: Bracket[],
  envDefault: string,
): string {
  const fromGroup = (groupTournamentId ?? "").trim();
  const uniqBracketTids = Array.from(
    new Set(brackets.map((b) => (b.tournamentId ?? "").trim()).filter(Boolean)),
  );
  if (uniqBracketTids.includes(envDefault)) return envDefault;
  if (uniqBracketTids.length === 1) return uniqBracketTids[0];
  if (fromGroup) return fromGroup;
  if (uniqBracketTids.length > 0) return uniqBracketTids[0];
  return envDefault;
}
