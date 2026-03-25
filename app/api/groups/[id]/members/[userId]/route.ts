import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import {
  getGroup,
  getGroupMembership,
  removeMember,
  updateMemberSubgroup,
  updateGroupCoAdmins,
} from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";

export const dynamic = "force-dynamic";

/** Remove a member (group admin). Cannot remove the primary owner. */
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
    return NextResponse.json(
      { error: "Cannot remove the group owner. Add another admin first if you need to change ownership." },
      { status: 400 }
    );
  }

  const membership = await getGroupMembership(params.id, targetId);
  if (!membership) {
    return NextResponse.json({ error: "User is not in this group." }, { status: 404 });
  }

  const prevCo = group.coAdminUserIds ?? [];
  if (prevCo.some((id) => String(id) === String(targetId))) {
    await updateGroupCoAdmins(
      params.id,
      prevCo.filter((id) => String(id) !== String(targetId))
    );
  }

  await removeMember(params.id, targetId);
  return NextResponse.json({ ok: true });
}

/** Assign member to a subgroup (group admin). */
export async function PATCH(
  req: Request,
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
  const m = await getGroupMembership(params.id, targetId);
  if (!m) return NextResponse.json({ error: "User is not in this group." }, { status: 404 });

  let body: { subgroupId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sg = body.subgroupId;
  if (sg === undefined) {
    return NextResponse.json({ error: "subgroupId required (or null to clear)." }, { status: 400 });
  }

  if (sg !== null && sg !== "") {
    const allowed = (group.subgroups ?? []).some((s) => s.id === sg);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "That segment is not on this pool yet. Add it under Segments and save, or pick a segment from the list.",
        },
        { status: 400 },
      );
    }
    await updateMemberSubgroup(params.id, targetId, sg);
  } else {
    await updateMemberSubgroup(params.id, targetId, null);
  }

  return NextResponse.json({ ok: true });
}
