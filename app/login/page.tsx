import { LoginForm } from "./LoginForm";

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

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string | string[]; error?: string | string[] };
}) {
  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl);
  const authError = pickFirst(searchParams.error);

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

        <LoginForm callbackUrl={callbackUrl} authError={authError} />

        <p className="text-hardwood-600 text-xs mt-6 font-mono">
          No account needed — just your Google login.
        </p>
      </div>
    </div>
  );
}
