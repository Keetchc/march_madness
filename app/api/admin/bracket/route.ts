import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/dynamo/queries/users";
import { getUser } from "@/lib/dynamo/queries/users";
import { createBracket, getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { v4 as uuidv4 } from "uuid";
import type { Bracket, AppUser, Picks } from "@/lib/types";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const brackets = await getBracketsByTournament(TOURNAMENT_ID);

  const enriched = await Promise.all(
    brackets.map(async (b) => {
      const user = await getUser(b.userId);
      return {
        bracketId: b.bracketId,
        userId: b.userId,
        name: b.name,
        userName: user?.name ?? b.userId,
        pickCount: Object.keys(b.picks).length,
      };
    })
  );

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, picks } = body as { name?: string; picks?: Picks };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!picks || typeof picks !== "object" || Object.keys(picks).length === 0) {
    return NextResponse.json({ error: "Picks are required" }, { status: 400 });
  }

  const userId = slugify(name);

  const user: AppUser = {
    userId,
    name: name.trim(),
    email: "",
    picture: "",
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };
  await upsertUser(user);

  const bracket: Bracket = {
    bracketId: uuidv4(),
    userId,
    tournamentId: TOURNAMENT_ID,
    name: `${name.trim()}'s Bracket`,
    picks,
    score: 0,
    maxPossibleScore: 0,
    isEliminated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await createBracket(bracket);

  return NextResponse.json({ user, bracket }, { status: 201 });
}
