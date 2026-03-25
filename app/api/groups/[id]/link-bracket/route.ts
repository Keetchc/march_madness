import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import {
  getGroup,
  getGroupMembership,
  updateMemberBracketId,
  addMember,
} from "@/lib/dynamo/queries/groups";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import type { GroupMember } from "@/lib/types";
import { isGroupAdmin } from "@/lib/group-permissions";
import { defaultTournamentId } from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

// POST /api/groups/[id]/link-bracket — set or change the caller's bracket for this group
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);

  const body = await req.json();
  const bracketId = typeof body.bracketId === "string" ? body.bracketId.trim() : "";
  if (!bracketId) {
    return NextResponse.json({ error: "bracketId is required" }, { status: 400 });
  }

  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const membership = await getGroupMembership(params.id, userId);
  const adminOk = isGroupAdmin(group, userId);

  if (!membership && !adminOk) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const bracket = await getBracket(bracketId);
  if (!bracket || String(bracket.userId) !== String(userId)) {
    return NextResponse.json({ error: "Bracket not found or not yours" }, { status: 400 });
  }

  const groupTid = group.tournamentId ?? defaultTournamentId();
  if (bracket.tournamentId !== groupTid) {
    return NextResponse.json(
      { error: "That bracket is for a different tournament than this group." },
      { status: 400 }
    );
  }

  if (!membership) {
    const member: GroupMember = {
      groupId: params.id,
      userId,
      bracketId,
      joinedAt: new Date().toISOString(),
      currentScore: 0,
      rank: 0,
    };
    await addMember(member);
  } else {
    await updateMemberBracketId(params.id, userId, bracketId);
  }

  return NextResponse.json({ ok: true, bracketId }, { status: 200 });
}
