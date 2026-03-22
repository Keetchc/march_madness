import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getGroupByInviteToken, addMember, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import type { GroupMember } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/groups/join — join via invite token
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const body = await req.json();
  const { token, bracketId } = body;

  if (!token) return NextResponse.json({ error: "Invite token required" }, { status: 400 });

  const group = await getGroupByInviteToken(token);
  if (!group) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });

  // Check already a member
  const existing = await getGroupMembership(group.groupId, userId);
  if (existing) {
    return NextResponse.json({ group, alreadyMember: true });
  }

  // Validate bracketId belongs to this user
  if (bracketId) {
    const userBrackets = await getBracketsByUser(userId);
    const owned = userBrackets.find((b) => b.bracketId === bracketId);
    if (!owned) {
      return NextResponse.json({ error: "Bracket not found or not yours" }, { status: 400 });
    }
  }

  const member: GroupMember = {
    groupId: group.groupId,
    userId,
    bracketId: bracketId ?? "",
    joinedAt: new Date().toISOString(),
    currentScore: 0,
    rank: 0,
  };

  await addMember(member);
  return NextResponse.json({ group, joined: true }, { status: 201 });
}

