import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import { listGroupWallPosts } from "@/lib/dynamo/queries/group-wall";
import { GroupWall } from "@/components/groups/GroupWall";

export default async function GroupWallPage({ params }: { params: { id: string } }) {
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

  const wallPosts = await listGroupWallPosts(params.id);
  const canPostWall = Boolean(membership) || isGroupAdmin(group, userId) || isAppAdmin;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Wall</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
          Group chat
        </h2>
        <p className="text-ink-300 text-sm font-body mt-2">
          Short posts visible to everyone in this pool. Keep it friendly.
        </p>
      </div>
      <GroupWall groupId={group.groupId} initialPosts={wallPosts} canPost={canPostWall} />
    </div>
  );
}
