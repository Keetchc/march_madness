import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getUser } from "@/lib/dynamo/queries/users";
import { getTournament } from "@/lib/dynamo/queries/games";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getUserId } from "@/lib/session";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import { BracketPageClient } from "@/app/(app)/bracket/[id]/BracketPageClient";

export const dynamic = "force-dynamic";

const DEFAULT_TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function PublicBracketPage({ params }: { params: { id: string } }) {
  const bracket = await getBracket(params.id);
  if (!bracket) notFound();

  const session = await getServerSession(getAuthOptions());
  const sessionUserId = session?.user ? (getUserId(session) ?? "") : "";
  const isAppAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);

  const tid = bracket.tournamentId ?? DEFAULT_TOURNAMENT_ID;
  const tournament = await getTournament(tid);
  const picksClosed = picksEffectivelyClosed(tournament);

  const isOwner =
    sessionUserId !== "" && String(sessionUserId).trim() === String(bracket.userId).trim();
  const picksHiddenUntilLock = !picksClosed && !isOwner && !isAppAdmin;

  const user = await getUser(bracket.userId);
  const displayName = user?.name ? `${user.name}'s Bracket` : bracket.name;

  const lockHint = tournament?.lockDate
    ? `Picks become visible to the group after lock (${new Date(tournament.lockDate).toLocaleString()}).`
    : "Picks become visible to the group after the pool locks.";

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
    />
  );
}
