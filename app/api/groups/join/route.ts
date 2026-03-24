import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getGroupByInviteToken, addMember, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import { upsertUser } from "@/lib/dynamo/queries/users";
import type { GroupMember } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

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

  // Validate bracketId belongs to this user and matches group tournament
  if (bracketId) {
    const userBrackets = await getBracketsByUser(userId);
    const owned = userBrackets.find((b) => b.bracketId === bracketId);
    if (!owned) {
      return NextResponse.json({ error: "Bracket not found or not yours" }, { status: 400 });
    }
    const groupTid = group.tournamentId ?? TOURNAMENT_ID;
    if (owned.tournamentId !== groupTid) {
      return NextResponse.json(
        { error: "That bracket is for a different tournament than this group." },
        { status: 400 }
      );
    }
  }

  const su = session.user;
  if (su) {
    await upsertUser({
      userId,
      name: su.name ?? "",
      email: su.email ?? "",
      picture: (su as { image?: string }).image ?? "",
      isAdmin: Boolean((su as { isAdmin?: boolean }).isAdmin),
      createdAt: new Date().toISOString(),
    });
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

