"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

type Props = {
  name?: string | null;
  email?: string | null;
};

export function LoginSessionPanel({ name, email }: Props) {
  const label = name?.trim() || email?.trim() || "your account";

  return (
    <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-8 w-80 mx-auto shadow-2xl text-left space-y-4">
      <p className="text-sm text-ink-200 font-body">
        You&apos;re already signed in as <span className="text-white font-medium">{label}</span>.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="text-center bg-court-500 hover:bg-court-600 text-white text-sm font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Go to dashboard
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-center border border-hardwood-500 hover:bg-hardwood-700 text-ink-100 text-sm font-mono py-2.5 px-4 rounded-xl transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
