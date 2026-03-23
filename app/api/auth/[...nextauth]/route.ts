import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthOptions } from "@/lib/auth";

type RouteCtx = { params: { nextauth: string[] } };

function auth(req: NextRequest, ctx: RouteCtx) {
  return NextAuth(getAuthOptions())(req, ctx);
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return auth(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return auth(req, ctx);
}

