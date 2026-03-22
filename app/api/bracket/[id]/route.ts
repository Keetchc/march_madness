import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getBracket, updatePicks, deleteBracket } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/bracket/[id] — public read access
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bracket);
}

// PUT /api/bracket/[id] — save picks
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = getUserId(session);
  if (bracket.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check tournament lock
  const tournament = await getTournament(TOURNAMENT_ID);
  if (tournament && tournament.status === "active") {
    const lockDate = new Date(tournament.lockDate);
    if (new Date() > lockDate) {
      return NextResponse.json({ error: "Tournament is locked. Picks are closed." }, { status: 403 });
    }
  }

  const body = await req.json();
  const { picks } = body;

  if (!picks || typeof picks !== "object") {
    return NextResponse.json({ error: "picks object required" }, { status: 400 });
  }

  await updatePicks(params.id, picks);
  return NextResponse.json({ ok: true });
}

// DELETE /api/bracket/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = getUserId(session);
  if (bracket.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteBracket(params.id);
  return NextResponse.json({ ok: true });
}

