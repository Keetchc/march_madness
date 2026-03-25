import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getUserId } from "@/lib/session";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { listGroupsUsingBracket } from "@/lib/dynamo/queries/groups";

export const dynamic = "force-dynamic";

/** Groups where the signed-in user has this bracket linked (same bracket, multiple pools). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  const userId = session?.user ? getUserId(session) : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (String(bracket.userId) !== String(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groups = await listGroupsUsingBracket(userId, params.id);
  return NextResponse.json({ groups });
}
