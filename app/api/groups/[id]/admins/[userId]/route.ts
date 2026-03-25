import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getGroup, updateGroupCoAdmins } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";

export const dynamic = "force-dynamic";

/** Demote a co-admin (primary owner cannot be removed here). */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const actorId = getUserId(session);
  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSiteAdmin = Boolean((session as { user?: { isAdmin?: boolean } }).user?.isAdmin);
  if (!isGroupAdmin(group, actorId) && !isSiteAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetId = params.userId;
  if (String(targetId) === String(group.adminUserId)) {
    return NextResponse.json({ error: "Cannot demote the group owner." }, { status: 400 });
  }

  const prev = group.coAdminUserIds ?? [];
  if (!prev.some((id) => String(id) === String(targetId))) {
    return NextResponse.json({ error: "That user is not a co-admin." }, { status: 400 });
  }

  const next = prev.filter((id) => String(id) !== String(targetId));
  await updateGroupCoAdmins(params.id, next);
  return NextResponse.json({ coAdminUserIds: next });
}
