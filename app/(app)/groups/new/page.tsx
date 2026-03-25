"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoringRules, Round, ScoringPresetId } from "@/lib/types";
import { BRIANS_SCORING_RULES, DEFAULT_SCORING_RULES, UPSET_SCORING_RULES } from "@/lib/types";
import { clsx } from "clsx";

const ROUND_LABELS: Record<Round, string> = {
  R64: "Rd of 64", R32: "Rd of 32", S16: "Sweet 16",
  E8: "Elite 8", F4: "Final Four", NCG: "Championship",
};

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scoringPreset, setScoringPreset] = useState<ScoringPresetId>("brians");
  const [scoringRules, setScoringRules] = useState<ScoringRules>(DEFAULT_SCORING_RULES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const basesEditable = scoringPreset === "brians" || scoringPreset === "custom";
  const advancedEditable = scoringPreset === "custom";

  function applyPreset(preset: ScoringPresetId) {
    setScoringPreset(preset);
    if (preset === "brians") setScoringRules(BRIANS_SCORING_RULES);
    if (preset === "upset") setScoringRules(UPSET_SCORING_RULES);
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Group name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scoringRules }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create group."); return; }
      router.push(`/groups/${data.groupId}`);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto pt-8 animate-fade-in">
      <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white mb-8">
        New Group
      </h1>

      <div className="space-y-6">
        {/* Group name */}
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6">
          <label className="block font-mono text-xs uppercase tracking-widest text-ink-300 mb-2">
            Group Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office Bracket Challenge"
            maxLength={60}
            className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-3 text-white font-body placeholder-gray-600 outline-none transition-colors"
          />
        </div>

        {/* Scoring rules */}
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">
            Scoring Rules
          </h2>

          {/* Presets */}
          <div className="flex gap-2 flex-wrap">
            {(["brians", "upset", "custom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={clsx(
                  "px-4 py-1.5 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all",
                  scoringPreset === p
                    ? "bg-court-500 text-white"
                    : "bg-hardwood-700 text-ink-200 border border-hardwood-500 hover:text-white"
                )}
              >
                {p === "brians" && "Brian's Rules"}
                {p === "upset" && "🔥 Upset bonus"}
                {p === "custom" && "Custom"}
              </button>
            ))}
          </div>

          <p className="text-xs font-body text-ink-400">
            {scoringPreset === "brians" &&
              "Base × seed per correct pick. Adjust bases per round; use Custom for upset multipliers or champion bonus."}
            {scoringPreset === "upset" && "Lower-seed wins pay extra; includes champion bonus. Use Custom to edit."}
            {scoringPreset === "custom" && "Edit base points, upset multipliers, and bonuses below."}
          </p>

          {/* Round points table */}
          <div className="space-y-2">
            {(Object.keys(ROUND_LABELS) as Round[]).map((round) => (
              <div key={round} className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-ink-300 w-28">{ROUND_LABELS[round]}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-400 font-mono">pts</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={scoringRules.rounds[round].basePoints}
                      disabled={!basesEditable}
                      onChange={(e) => {
                        if (scoringPreset === "brians") setScoringPreset("custom");
                        setScoringRules((prev) => ({
                          ...prev,
                          rounds: {
                            ...prev.rounds,
                            [round]: {
                              ...prev.rounds[round],
                              basePoints: parseInt(e.target.value, 10) || 0,
                            },
                          },
                        }));
                      }}
                      className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-400 font-mono">upset×</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={scoringRules.rounds[round].upsetMultiplier}
                      disabled={!advancedEditable}
                      onChange={(e) =>
                        setScoringRules((prev) => ({
                          ...prev,
                          rounds: {
                            ...prev.rounds,
                            [round]: {
                              ...prev.rounds[round],
                              upsetMultiplier: parseFloat(e.target.value) || 0,
                            },
                          },
                        }))
                      }
                      className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Champion bonus */}
          <div className="pt-3 border-t border-hardwood-600 flex items-center justify-between gap-4">
            <span className="font-mono text-xs text-ink-300">🏆 Champion Bonus</span>
            <input
              type="number"
              min={0}
              max={999}
              value={scoringRules.bonuses.correctChampion}
              disabled={!advancedEditable}
              onChange={(e) =>
                setScoringRules((prev) => ({
                  ...prev,
                  bonuses: {
                    ...prev.bonuses,
                    correctChampion: parseInt(e.target.value) || 0,
                  },
                }))
              }
              className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="w-full bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors text-lg"
        >
          {loading ? "Creating..." : "Create Group"}
        </button>
      </div>
    </div>
  );
}

