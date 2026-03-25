import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getBracketsByUser, createBracket } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";
import type { Bracket } from "@/lib/types";
import { getViewingTournamentIdFromCookies } from "@/lib/viewing-tournament";

// GET /api/bracket — list my brackets
export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const brackets = await getBracketsByUser(userId);
  return NextResponse.json(brackets);
}

// POST /api/bracket — create a new bracket
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const body = await req.json();
  const { name } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Bracket name is required" }, { status: 400 });
  }

  const viewingId = getViewingTournamentIdFromCookies();
  const tournament = await getTournament(viewingId);
  if (picksEffectivelyClosed(tournament)) {
    return NextResponse.json({ error: "Tournament is locked. No new brackets." }, { status: 403 });
  }

  const bracket: Bracket = {
    bracketId: uuidv4(),
    userId,
    tournamentId: viewingId,
    name: name.trim(),
    picks: {},
    score: 0,
    maxPossibleScore: 0,
    isEliminated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createBracket(bracket);
  return NextResponse.json(bracket, { status: 201 });
}

