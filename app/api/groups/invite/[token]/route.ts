import { NextResponse } from "next/server";
import { getGroupByInviteToken } from "@/lib/dynamo/queries/groups";

export const dynamic = "force-dynamic";

// GET /api/groups/invite/[token] — public; invite token acts as capability (group name only)
export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const group = await getGroupByInviteToken(params.token);
  if (!group) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  return NextResponse.json({ name: group.name });
}
