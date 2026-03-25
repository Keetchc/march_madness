import { getBracket } from "@/lib/dynamo/queries/brackets";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { getTournament } from "@/lib/dynamo/queries/games";
import { getGroup, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getUserId } from "@/lib/session";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import { scoringTournamentIdForGroup } from "@/lib/scoring/group-tournament-id";
import { BracketPageClient } from "@/app/(app)/bracket/[id]/BracketPageClient";
import { defaultTournamentId, getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";
import { SeasonMismatchNotice } from "@/components/tournament/SeasonMismatchNotice";

export const dynamic = "force-dynamic";

const DEFAULT_TOURNAMENT_ID = defaultTournamentId();

export default async function PublicBracketPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { fromGroup?: string };
}) {
  const bracket = await getBracket(params.id);
  if (!bracket) notFound();

  const viewingId = await getViewingTournamentIdFromCookies();
  const bracketTid = (bracket.tournamentId ?? DEFAULT_TOURNAMENT_ID).trim();
  if (bracketTid !== viewingId.trim()) {
    return (
      <SeasonMismatchNotice
        kind="bracket"
        resourceTitle={bracket.name}
        resourceTournamentId={bracketTid}
        viewingTournamentId={viewingId.trim()}
      />
    );
  }

  const session = await getServerSession(getAuthOptions());
  const sessionUserId = session?.user ? (getUserId(session) ?? "") : "";
  const isAppAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);

  const tid = bracket.tournamentId ?? DEFAULT_TOURNAMENT_ID;
  const tournament = await getTournament(tid);
  const picksClosed = picksEffectivelyClosed(tournament);

  const isOwner =
    sessionUserId !== "" && String(sessionUserId).trim() === String(bracket.userId).trim();
  const picksHiddenUntilLock = !picksClosed && !isOwner && !isAppAdmin;

  const { name } = await resolveUserDisplayProfile(bracket.userId);
  const displayName = name !== "Unknown" ? `${name}'s Bracket` : bracket.name;

  const lockHint = tournament?.lockDate
    ? `Picks become visible to the group after lock (${new Date(tournament.lockDate).toLocaleString()}).`
    : "Picks become visible to the group after the pool locks.";

  const fromGroup = typeof searchParams.fromGroup === "string" ? searchParams.fromGroup.trim() : "";
  const groupFromQuery = fromGroup ? await getGroup(fromGroup) : null;
  const groupReturn =
    groupFromQuery != null
      ? { id: groupFromQuery.groupId, name: groupFromQuery.name }
      : undefined;

  let whatIfScoringRules: import("@/lib/types").ScoringRules | undefined;
  let whatIfScoringSourceLabel: string | undefined;
  let fromGroupIdForPicks: string | undefined;
  if (fromGroup && sessionUserId && groupFromQuery) {
    const g = groupFromQuery;
    const mem = await getGroupMembership(fromGroup, sessionUserId);
    const inGroupContext = Boolean(g && (mem || isAppAdmin));
    if (inGroupContext && g) {
      fromGroupIdForPicks = g.groupId;
      const bracketTid = (bracket.tournamentId ?? DEFAULT_TOURNAMENT_ID).trim();
      const resolvedTid = scoringTournamentIdForGroup(g.tournamentId, [bracket], DEFAULT_TOURNAMENT_ID);
      if (resolvedTid === bracketTid && mem) {
        whatIfScoringRules = g.scoringRules;
        whatIfScoringSourceLabel = g.name;
      }
    }
  }

  return (
    <BracketPageClient
      bracketId={bracket.bracketId}
      userId={sessionUserId}
      bracketUserId={bracket.userId}
      bracketName={displayName}
      initialPicks={picksHiddenUntilLock ? {} : bracket.picks}
      picksHiddenUntilLock={picksHiddenUntilLock}
      lockHint={lockHint}
      serverRedactedPicks={picksHiddenUntilLock}
      whatIfScoringRules={whatIfScoringRules}
      whatIfScoringSourceLabel={whatIfScoringSourceLabel}
      fromGroupId={fromGroupIdForPicks}
      groupReturn={groupReturn}
      bracketTournamentId={tid}
    />
  );
}
