"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Bracket } from "@/lib/types";

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selectedBracket, setSelectedBracket] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");

  // Fetch user's brackets so they can pick which one to enter
  useEffect(() => {
    fetch("/api/bracket").then((r) => r.json()).then(setBrackets);
  }, []);

  async function handleJoin() {
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, bracketId: selectedBracket }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to join."); return; }
      router.push(`/groups/${data.group.groupId}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="max-w-md mx-auto pt-16 animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🏀</div>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-white mb-2">
          You're Invited!
        </h1>
        <p className="text-gray-500 font-body">
          Join a March Madness bracket group.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-5">
        {brackets.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 font-body text-sm mb-4">
              You need a bracket first before joining a group.
            </p>
            <a
              href="/bracket/new"
              className="inline-block bg-court-500 hover:bg-court-600 text-white font-display font-bold uppercase px-5 py-2.5 rounded-lg transition-colors"
            >
              Create a Bracket First
            </a>
          </div>
        ) : (
          <>
            <div>
              <label className="block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">
                Select Your Bracket
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

            {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

            <button
              onClick={handleJoin}
              disabled={joining || !selectedBracket}
              className="w-full bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors"
            >
              {joining ? "Joining..." : "Join Group"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

