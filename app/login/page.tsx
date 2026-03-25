import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { LoginCourtBackground } from "@/components/login/LoginCourtBackground";
import { LoginForm } from "./LoginForm";
import { LoginSessionPanel } from "./LoginSessionPanel";

export const dynamic = "force-dynamic";

function pickFirst(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function safeCallbackUrl(raw: string | string[] | undefined): string {
  const v = pickFirst(raw);
  const fallback = "/dashboard";
  if (!v) return fallback;
  if (!v.startsWith("/") || v.startsWith("//")) return fallback;
  return v;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string | string[]; error?: string | string[] };
}) {
  const session = await getServerSession(getAuthOptions());
  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl);
  const authError = pickFirst(searchParams.error);

  return (
    <div className="min-h-screen bg-hardwood-900 flex items-center justify-center relative overflow-hidden">
      <LoginCourtBackground />

      <div className="relative z-10 text-center animate-fade-in">
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-6xl">🏀</span>
          </div>
          <h1 className="font-display text-7xl font-black tracking-tight text-white uppercase">
            Bracket
            <span className="text-court-500"> Bash</span>
          </h1>
          <p className="font-body text-hardwood-500 text-lg mt-2 tracking-wide">
            March Madness with your crew
          </p>
        </div>

        {session?.user ? (
          <LoginSessionPanel name={session.user.name} email={session.user.email} />
        ) : (
          <LoginForm callbackUrl={callbackUrl} authError={authError} />
        )}

        <p className="text-hardwood-600 text-xs mt-6 font-mono">
          No account needed — just your Google login.
        </p>
      </div>
    </div>
  );
}
