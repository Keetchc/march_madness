import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import { getTournament } from "@/lib/dynamo/queries/games";
import { GroupAreaShell } from "@/components/groups/GroupAreaShell";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

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

  const tid = (group.tournamentId ?? TOURNAMENT_ID).trim() || TOURNAMENT_ID;
  const tournament = await getTournament(tid);
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
