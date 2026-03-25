import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getGroup, getGroupMembership, updateGroupCoAdmins } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";

export const dynamic = "force-dynamic";

/** Promote a member to co-admin (must already be in the group). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const actorId = getUserId(session);
  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSiteAdmin = Boolean((session as { user?: { isAdmin?: boolean } }).user?.isAdmin);
  if (!isGroupAdmin(group, actorId) && !isSiteAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  if (String(targetId) === String(group.adminUserId)) {
    return NextResponse.json({ error: "That user is already the group owner." }, { status: 400 });
  }

  const m = await getGroupMembership(params.id, targetId);
  if (!m) {
    return NextResponse.json({ error: "User must be a member before becoming an admin." }, { status: 400 });
  }

  const co = new Set(group.coAdminUserIds ?? []);
  if (co.has(targetId)) {
    return NextResponse.json({ error: "Already an admin." }, { status: 400 });
  }
  co.add(targetId);
  await updateGroupCoAdmins(params.id, Array.from(co));

  return NextResponse.json({ coAdminUserIds: Array.from(co) });
}
