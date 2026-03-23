import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { addMember, createGroup, getGroupsByUser } from "@/lib/dynamo/queries/groups";
import { v4 as uuidv4 } from "uuid";
import type { Group, GroupMember } from "@/lib/types";

export const dynamic = "force-dynamic";
import { DEFAULT_SCORING_RULES } from "@/lib/types";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/groups — list groups I belong to
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const groups = await getGroupsByUser(userId);
  return NextResponse.json(groups);
}

// POST /api/groups — create a new group
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const body = await req.json();
  const { name, scoringRules } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  const group: Group = {
    groupId: uuidv4(),
    name: name.trim(),
    adminUserId: userId,
    tournamentId: TOURNAMENT_ID,
    inviteToken: uuidv4(),
    scoringRules: scoringRules ?? DEFAULT_SCORING_RULES,
    createdAt: new Date().toISOString(),
  };

  await createGroup(group);

  // Member row required for userId-index — otherwise the group never appears on dashboard / groups list.
  const creatorMembership: GroupMember = {
    groupId: group.groupId,
    userId,
    bracketId: "",
    joinedAt: new Date().toISOString(),
    currentScore: 0,
    rank: 0,
  };
  await addMember(creatorMembership);

  return NextResponse.json(group, { status: 201 });
}

