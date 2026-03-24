"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Bracket } from "@/lib/types";
import { clsx } from "clsx";

type JoinMode = "existing" | "new" | "later";

export default function JoinGroupPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const token = params.token as string;

  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [groupName, setGroupName] = useState("");
  const [mode, setMode] = useState<JoinMode>("new");
  const [selectedBracket, setSelectedBracket] = useState("");
  const [newBracketName, setNewBracketName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups/invite/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.name) setGroupName(d.name);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/bracket")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setBrackets(list);
        setMode(list.length > 0 ? "existing" : "new");
      });
  }, [status]);

  const callbackUrl = pathname || `/groups/join/${encodeURIComponent(token)}`;

  async function joinWithBracketId(bracketId: string) {
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, bracketId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to join.");
      return false;
    }
    router.push(`/groups/${data.group.groupId}`);
    return true;
  }

  async function handleJoin() {
    setJoining(true);
    setError("");
    try {
      if (mode === "later") {
        await joinWithBracketId("");
        return;
      }
      if (mode === "existing") {
        if (!selectedBracket) {
          setError("Choose one of your brackets, or pick another option below.");
          return;
        }
        await joinWithBracketId(selectedBracket);
        return;
      }
      if (mode === "new") {
        if (!newBracketName.trim()) {
          setError("Enter a name for your new bracket.");
          return;
        }
        const res = await fetch("/api/bracket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newBracketName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not create bracket.");
          return;
        }
        await joinWithBracketId(data.bracketId);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setJoining(false);
    }
  }

  const canSubmit =
    mode === "later" ||
    (mode === "existing" && Boolean(selectedBracket)) ||
    (mode === "new" && Boolean(newBracketName.trim()));

  return (
    <div className="max-w-md mx-auto pt-16 animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🏀</div>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-white mb-2">
          You&apos;re Invited!
        </h1>
        <p className="text-gray-500 font-body">
          {groupName ? (
            <>
              Join <span className="text-gray-300 font-semibold">{groupName}</span>.
            </>
          ) : (
            "Join a March Madness bracket group."
          )}
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-5">
        {status === "loading" ? (
          <p className="text-center text-gray-500 font-body text-sm py-6">Loading…</p>
        ) : status === "unauthenticated" ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-400 font-body">
              Sign in to join this group. You&apos;ll be able to link an existing bracket, create a new one, or join
              now and add a bracket later.
            </p>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="inline-flex w-full justify-center bg-court-500 hover:bg-court-600 text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors"
            >
              Sign in to continue
            </Link>
          </div>
        ) : (
          <>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-3">
                How do you want to enter?
              </p>
              <div className="space-y-2">
                {brackets.length > 0 && (
                  <label
                    className={clsx(
                      "flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                      mode === "existing"
                        ? "border-court-500 bg-court-500/10"
                        : "border-hardwood-500 hover:border-hardwood-400"
                    )}
                  >
                    <input
                      type="radio"
                      name="joinMode"
                      className="mt-1"
                      checked={mode === "existing"}
                      onChange={() => setMode("existing")}
                    />
                    <span>
                      <span className="block font-display font-bold text-white text-sm uppercase tracking-wide">
                        Link an existing bracket
                      </span>
                      <span className="text-xs text-gray-500 font-body">
                        Pick a bracket you already created in this app.
                      </span>
                    </span>
                  </label>
                )}
                <label
                  className={clsx(
                    "flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                    mode === "new"
                      ? "border-court-500 bg-court-500/10"
                      : "border-hardwood-500 hover:border-hardwood-400"
                  )}
                >
                  <input
                    type="radio"
                    name="joinMode"
                    className="mt-1"
                    checked={mode === "new"}
                    onChange={() => setMode("new")}
                  />
                  <span>
                    <span className="block font-display font-bold text-white text-sm uppercase tracking-wide">
                      Create a new bracket
                    </span>
                    <span className="text-xs text-gray-500 font-body">
                      We&apos;ll create an empty bracket and attach it to this group.
                    </span>
                  </span>
                </label>
                <label
                  className={clsx(
                    "flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                    mode === "later"
                      ? "border-court-500 bg-court-500/10"
                      : "border-hardwood-500 hover:border-hardwood-400"
                  )}
                >
                  <input
                    type="radio"
                    name="joinMode"
                    className="mt-1"
                    checked={mode === "later"}
                    onChange={() => setMode("later")}
                  />
                  <span>
                    <span className="block font-display font-bold text-white text-sm uppercase tracking-wide">
                      Join now, add a bracket later
                    </span>
                    <span className="text-xs text-gray-500 font-body">
                      Enter the group now; link a bracket from the group page when you&apos;re ready.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {mode === "existing" && brackets.length > 0 && (
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">
                  Your bracket
                </label>
                <select
                  value={selectedBracket}
                  onChange={(e) => setSelectedBracket(e.target.value)}
                  className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-3 text-white font-body outline-none transition-colors"
                >
                  <option value="">-- Choose a bracket --</option>
                  {brackets.map((b) => (
                    <option key={b.bracketId} value={b.bracketId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mode === "new" && (
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">
                  New bracket name
                </label>
                <input
                  type="text"
                  value={newBracketName}
                  onChange={(e) => setNewBracketName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmit && !joining && handleJoin()}
                  placeholder="e.g. Office pool picks"
                  maxLength={60}
                  className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-3 text-white font-body placeholder-gray-600 outline-none transition-colors"
                />
              </div>
            )}

            {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

            <button
              type="button"
              onClick={handleJoin}
              disabled={joining || !canSubmit}
              className="w-full bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors"
            >
              {joining ? "Working..." : "Join group"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
