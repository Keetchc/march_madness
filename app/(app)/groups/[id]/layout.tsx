import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import { getTournament } from "@/lib/dynamo/queries/games";
import { GroupAreaShell } from "@/components/groups/GroupAreaShell";
import { defaultTournamentId, getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";
import { SeasonMismatchNotice } from "@/components/tournament/SeasonMismatchNotice";

export default async function GroupSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const userId = String((session.user as { userId?: string }).userId ?? "");
  const isAppAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);

  const group = await getGroup(params.id);
  if (!group) notFound();

  const membership = await getGroupMembership(params.id, userId);
  if (!membership && !isGroupAdmin(group, userId) && !isAppAdmin) {
    redirect("/dashboard");
  }

  const viewingId = await getViewingTournamentIdFromCookies();
  const fallback = defaultTournamentId();
  const groupTid = (group.tournamentId ?? fallback).trim() || fallback;
  if (groupTid !== viewingId.trim()) {
    return (
      <div className="container mx-auto px-3 sm:px-5 md:px-6 max-w-[min(100%,2000px)] py-6">
        <SeasonMismatchNotice
          kind="group"
          resourceTitle={group.name}
          resourceTournamentId={groupTid}
          viewingTournamentId={viewingId.trim()}
        />
      </div>
    );
  }

  const tournament = await getTournament(groupTid);
  const tournamentLockPick = tournament
    ? { lockDate: tournament.lockDate, picksOpenOverride: tournament.picksOpenOverride }
    : undefined;

  const isGroupAdminUser = isGroupAdmin(group, userId) || isAppAdmin;

  return (
    <GroupAreaShell
      groupId={group.groupId}
      groupName={group.name}
      isGroupAdmin={isGroupAdminUser}
      tournamentLockPick={tournamentLockPick}
    >
      {children}
    </GroupAreaShell>
  );
}
