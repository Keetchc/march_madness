export const dynamic = "force-dynamic";

/** Only allow same-site relative paths (NextAuth also validates on the server). */
function safeCallbackUrl(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const fallback = "/dashboard";
  if (!v) return fallback;
  if (!v.startsWith("/") || v.startsWith("//")) return fallback;
  return v;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string | string[] };
}) {
  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl);
  const signinHref = `/api/auth/signin?${new URLSearchParams({ callbackUrl }).toString()}`;

  return (
    <div className="min-h-screen bg-hardwood-900 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 border-white" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white" />
      </div>

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

        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-8 w-80 mx-auto shadow-2xl">
          <p className="text-sm text-gray-400 mb-6 font-body">
            Sign in to submit your bracket, join groups, and trash-talk your friends.
          </p>
          {/*
            Use a full document navigation (plain <a>), not next/link, so the browser loads NextAuth’s
            HTML sign-in page and receives CSRF cookies in that response.
          */}
          <a
            href={signinHref}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-body font-semibold py-3 px-6 rounded-xl transition-all duration-150 shadow-lg hover:shadow-xl active:scale-95"
          >
            <GoogleIcon />
            Continue with Google
          </a>
        </div>

        <p className="text-hardwood-600 text-xs mt-6 font-mono">
          No account needed — just your Google login.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
