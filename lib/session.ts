import { getServerSession } from "next-auth";
import { getAuthOptions } from "./auth";
import { NextResponse } from "next/server";

export async function getSession() {
  return getServerSession(getAuthOptions());
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(session.user as any).isAdmin) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}

export function getUserId(session: any): string {
  const id = session?.user?.userId ?? session?.user?.id;
  return id as string;
}

