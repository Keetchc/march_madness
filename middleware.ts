import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BUILD_TIME_NEXTAUTH_SECRET } from "@/lib/generated-middleware-secret";

/**
 * Edge cannot read amplify-auth.json. Node signs JWTs with serverEnv() (file first, then env).
 * Amplify sometimes injects a different/stale NEXTAUTH_SECRET into the Edge runtime than the
 * value baked into amplify-auth.json — verifying with env first breaks sessions after login.
 * Prefer BUILD_TIME (same CodeBuild value as amplify-auth.json) when set, then env (local dev).
 */
function nextAuthSecretForEdge(): string | undefined {
  if (BUILD_TIME_NEXTAUTH_SECRET !== "") return BUILD_TIME_NEXTAUTH_SECRET;
  const fromEnv = process.env["NEXTAUTH_SECRET"];
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  return undefined;
}

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/runtime-env-check") return true;
  if (pathname === "/api/espn/sync") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/login") return true;
  if (pathname === "/opengraph-image" || pathname === "/twitter-image") return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: nextAuthSecretForEdge(),
    secureCookie: req.nextUrl.protocol === "https:",
  });

  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
