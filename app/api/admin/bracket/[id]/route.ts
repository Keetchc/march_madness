import { NextResponse } from "next/server";
import { getBracket, updatePicks } from "@/lib/dynamo/queries/brackets";
import type { Picks } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bracket);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { picks } = body as { picks?: Picks };

  if (!picks || typeof picks !== "object") {
    return NextResponse.json({ error: "picks object required" }, { status: 400 });
  }

  await updatePicks(params.id, picks);
  return NextResponse.json({ ok: true, bracketId: params.id });
}
