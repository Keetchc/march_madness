import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getTournament, updateTournamentPicksSettings } from "@/lib/dynamo/queries/games";

export const dynamic = "force-dynamic";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// PATCH /api/admin/tournament — lockDate + picksOpenOverride (site admins only)
export async function PATCH(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!(session!.user as { isAdmin?: boolean }).isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getTournament(TOURNAMENT_ID);
  if (!existing) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    lockDate?: string;
    picksOpenOverride?: boolean;
  };

  if (body.lockDate === undefined && body.picksOpenOverride === undefined) {
    return NextResponse.json(
      { error: "Provide lockDate and/or picksOpenOverride" },
      { status: 400 }
    );
  }

  if (body.lockDate !== undefined && Number.isNaN(Date.parse(body.lockDate))) {
    return NextResponse.json({ error: "Invalid lockDate" }, { status: 400 });
  }

  await updateTournamentPicksSettings(TOURNAMENT_ID, {
    ...(body.lockDate !== undefined ? { lockDate: body.lockDate } : {}),
    ...(body.picksOpenOverride !== undefined ? { picksOpenOverride: body.picksOpenOverride } : {}),
  });

  const tournament = await getTournament(TOURNAMENT_ID);
  return NextResponse.json({ tournament });
}
