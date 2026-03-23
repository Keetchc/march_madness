import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup } from "@/lib/dynamo/queries/groups";
import { GroupSettingsClient } from "./GroupSettingsClient";

export default async function GroupSettingsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const userId = (session.user as { userId?: string }).userId ?? "";
  const isSiteAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);

  const group = await getGroup(params.id);
  if (!group) notFound();

  if (group.adminUserId !== userId && !isSiteAdmin) {
    redirect(`/groups/${params.id}`);
  }

  return <GroupSettingsClient group={group} />;
}
