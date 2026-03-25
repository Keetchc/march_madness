import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  VIEWING_TOURNAMENT_COOKIE,
  getAllowedTournamentIds,
  getCachedTournamentsForSeasonPicker,
  normalizeViewingTournamentId,
} from "@/lib/viewing-tournament";

export const dynamic = "force-dynamic";

/** Seasons from Dynamo (META rows) + current viewing id (for navbar). */
export async function GET() {
  const tournaments = await getCachedTournamentsForSeasonPicker();
  const allowed = await getAllowedTournamentIds();
  const cookieVal = cookies().get(VIEWING_TOURNAMENT_COOKIE)?.value;
  const viewingTournamentId = normalizeViewingTournamentId(null, cookieVal, allowed);

  const seasons = tournaments.map((t) => ({
    tournamentId: t.tournamentId,
    name: t.name ?? `NCAA Tournament ${t.tournamentId}`,
    year: t.year ?? Number.parseInt(t.tournamentId, 10),
    status: t.status ?? ("pending" as const),
  }));

  return NextResponse.json({ viewingTournamentId, seasons });
}

/** Set viewing season cookie (`mm_view_tid`). */
export async function POST(req: Request) {
  let body: { tournamentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = (body.tournamentId ?? "").trim();
  const allowed = await getAllowedTournamentIds();
  if (!id || !allowed.includes(id)) {
    return NextResponse.json({ error: "Invalid tournament season" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, viewingTournamentId: id });
  res.cookies.set(VIEWING_TOURNAMENT_COOKIE, id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
  });
  return res;
}
