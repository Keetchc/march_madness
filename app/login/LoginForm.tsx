"use client";

import { useEffect, useState } from "react";
import { getCsrfToken } from "next-auth/react";

type Props = {
  callbackUrl: string;
  authError?: string;
};

/** Google often blocks or breaks OAuth inside embedded in-app browsers (Instagram, Facebook, etc.). */
function likelyInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /(FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger|Snapchat|Twitter for iPhone|Twitter for Android)/i.test(
    ua
  );
}

export function LoginForm({ callbackUrl, authError }: Props) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [csrfFailed, setCsrfFailed] = useState(false);
  const [inAppHint, setInAppHint] = useState(false);

  useEffect(() => {
    setInAppHint(likelyInAppBrowser());
  }, []);

  useEffect(() => {
    void getCsrfToken()
      .then((t) => setCsrfToken(t ?? null))
      .catch(() => {
        setCsrfFailed(true);
        setCsrfToken(null);
      });
  }, []);

  return (
    <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-8 w-80 mx-auto shadow-2xl">
      <p className="text-sm text-ink-200 mb-6 font-body">
        Sign in to submit your bracket, join groups, and trash-talk your friends.
      </p>
      {inAppHint && (
        <p className="text-sm text-sky-200/90 bg-sky-950/40 border border-sky-800/50 rounded-lg px-3 py-2 mb-4 font-body text-left leading-snug">
          You may be inside another app&apos;s browser. Google often shows errors or extra warnings there.
          Use <span className="font-semibold text-sky-100">Open in Safari</span> or{" "}
          <span className="font-semibold text-sky-100">Open in Chrome</span> from the share/menu, then try
          again.
        </p>
      )}
      {authError === "OAuthSignin" && (
        <p className="text-sm text-amber-200/90 bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2 mb-4 font-body text-left leading-snug">
          Google sign-in could not start on the server. Most often{" "}
          <span className="font-semibold text-amber-100">GOOGLE_CLIENT_ID</span> or{" "}
          <span className="font-semibold text-amber-100">GOOGLE_CLIENT_SECRET</span> is missing in your
          hosting environment, or <span className="font-semibold text-amber-100">NEXTAUTH_URL</span> does
          not match this site&apos;s public URL. In Google Cloud, the redirect URI must be{" "}
          <code className="font-mono text-xs text-amber-100/95 break-all">
            https://YOUR_DOMAIN/api/auth/callback/google
          </code>
          .
        </p>
      )}
      <form action="/api/auth/signin/google" method="post" className="w-full">
        <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button
          type="submit"
          disabled={!csrfToken || csrfFailed}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none text-gray-900 font-body font-semibold py-3 px-6 rounded-xl transition-all duration-150 shadow-lg hover:shadow-xl active:scale-95"
        >
          <GoogleIcon />
          {csrfFailed
            ? "Sign-in unavailable — refresh the page"
            : csrfToken
              ? "Continue with Google"
              : "Preparing sign-in…"}
        </button>
      </form>
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
