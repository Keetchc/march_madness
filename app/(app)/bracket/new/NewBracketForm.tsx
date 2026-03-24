"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

export function NewBracketForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      setError("Give your bracket a name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      if (returnTo) {
        const groupId = returnTo.replace(/^\/groups\//, "").split("/")[0]?.trim();
        if (groupId) {
          const linkRes = await fetch(`/api/groups/${groupId}/link-bracket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bracketId: data.bracketId }),
          });
          if (linkRes.ok) {
            router.push(returnTo);
            return;
          }
        }
      }

      router.push(`/bracket/${data.bracketId}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto pt-16 animate-fade-in">
      <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white mb-2">
        New Bracket
      </h1>
      <p className="text-gray-500 font-body mb-8">
        Give it a name — you can always update it later.
        {returnTo ? (
          <span className="block text-court-500/90 text-sm mt-2 font-mono">
            After creating, we&apos;ll link it to your group and take you back.
          </span>
        ) : null}
      </p>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">
            Bracket Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. My Cinderella Bracket"
            maxLength={60}
            className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-3 text-white font-body placeholder-gray-600 outline-none transition-colors"
          />
          {error && <p className="text-red-400 text-xs font-mono mt-2">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="w-full flex items-center justify-center gap-2 bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-wide py-3 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          {loading ? "Creating..." : "Create Bracket"}
        </button>
      </div>
    </div>
  );
}
