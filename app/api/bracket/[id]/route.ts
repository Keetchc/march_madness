import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSession, getUserId } from "@/lib/session";
import { getAuthOptions } from "@/lib/auth";
import { getBracket, updatePicks, deleteBracket } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import { defaultTournamentId } from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

const DEFAULT_TOURNAMENT_ID = defaultTournamentId();

// GET /api/bracket/[id] — full bracket for owner/admin after lock; others get redacted picks before lock
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tid = bracket.tournamentId ?? DEFAULT_TOURNAMENT_ID;
  const tournament = await getTournament(tid);
  const closed = picksEffectivelyClosed(tournament);

  const session = await getServerSession(getAuthOptions());
  const viewerId = session?.user ? getUserId(session) : "";
  const isOwner = viewerId !== "" && String(viewerId) === String(bracket.userId);
  const isAppAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);

  if (!closed && !isOwner && !isAppAdmin) {
    return NextResponse.json({
      ...bracket,
      picks: {},
      score: 0,
      maxPossibleScore: 0,
      isEliminated: false,
    });
  }

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

  const tid = bracket.tournamentId ?? DEFAULT_TOURNAMENT_ID;
  const tournament = await getTournament(tid);
  if (picksEffectivelyClosed(tournament)) {
    return NextResponse.json({ error: "Tournament is locked. Picks are closed." }, { status: 403 });
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

