import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BUILD_TIME_NEXTAUTH_SECRET } from "@/lib/generated-middleware-secret";

/** Edge has no fs (cannot read amplify-auth.json); use runtime env then build-time secret from Amplify prebuild. */
function nextAuthSecretForEdge(): string | undefined {
  const fromEnv = process.env["NEXTAUTH_SECRET"];
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  if (BUILD_TIME_NEXTAUTH_SECRET !== "") return BUILD_TIME_NEXTAUTH_SECRET;
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

  const token = await getToken({ req, secret: nextAuthSecretForEdge() });

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
