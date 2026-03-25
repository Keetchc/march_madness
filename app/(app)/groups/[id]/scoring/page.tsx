import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import { GroupScoringRulesPanel } from "@/components/groups/GroupScoringRulesPanel";

export default async function GroupScoringPage({ params }: { params: { id: string } }) {
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

  return <GroupScoringRulesPanel scoringRules={group.scoringRules} />;
}
