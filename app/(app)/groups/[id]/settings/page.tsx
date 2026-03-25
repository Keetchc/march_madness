import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembers } from "@/lib/dynamo/queries/groups";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";
import { isGroupAdmin } from "@/lib/group-permissions";
import { GroupSettingsClient } from "./GroupSettingsClient";

export default async function GroupSettingsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const userId = (session.user as { userId?: string }).userId ?? "";
  const isSiteAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);

  const group = await getGroup(params.id);
  if (!group) notFound();

  if (!isGroupAdmin(group, userId) && !isSiteAdmin) {
    redirect(`/groups/${params.id}`);
  }

  const members = await getGroupMembers(params.id);
  const memberRows = await Promise.all(
    members.map(async (m) => {
      const u = await resolveUserDisplayProfile(m.userId);
      return { member: m, displayName: u.name };
    })
  );

  return <GroupSettingsClient group={group} memberRows={memberRows} currentUserId={userId} />;
}
