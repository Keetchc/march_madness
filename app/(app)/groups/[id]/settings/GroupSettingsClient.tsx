"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Group, ScoringRules, Round } from "@/lib/types";
import { DEFAULT_SCORING_RULES, UPSET_SCORING_RULES } from "@/lib/types";
import { clsx } from "clsx";
import { ArrowLeftIcon } from "lucide-react";

const ROUND_LABELS: Record<Round, string> = {
  R64: "Rd of 64",
  R32: "Rd of 32",
  S16: "Sweet 16",
  E8: "Elite 8",
  F4: "Final Four",
  NCG: "Championship",
};

function detectPreset(rules: ScoringRules): "standard" | "upset" | "custom" {
  if (JSON.stringify(rules) === JSON.stringify(DEFAULT_SCORING_RULES)) return "standard";
  if (JSON.stringify(rules) === JSON.stringify(UPSET_SCORING_RULES)) return "upset";
  return "custom";
}

export function GroupSettingsClient({ group }: { group: Group }) {
  const router = useRouter();
  const [scoringPreset, setScoringPreset] = useState<"standard" | "upset" | "custom">(() =>
    detectPreset(group.scoringRules)
  );
  const [scoringRules, setScoringRules] = useState<ScoringRules>(group.scoringRules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function applyPreset(preset: "standard" | "upset" | "custom") {
    setScoringPreset(preset);
    if (preset === "standard") setScoringRules(DEFAULT_SCORING_RULES);
    if (preset === "upset") setScoringRules(UPSET_SCORING_RULES);
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoringRules }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Could not save settings.");
        return;
      }
      router.push(`/groups/${group.groupId}`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto pt-8 animate-fade-in space-y-6">
      <Link
        href={`/groups/${group.groupId}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-court-400 font-body transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to group
      </Link>

      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Settings</p>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-white">{group.name}</h1>
        <p className="text-gray-500 text-sm font-body mt-2">Scoring rules apply to this group&apos;s leaderboard.</p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">Scoring rules</h2>

        <div className="flex gap-2 flex-wrap">
          {(["standard", "upset", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={clsx(
                "px-4 py-1.5 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all",
                scoringPreset === p
                  ? "bg-court-500 text-white"
                  : "bg-hardwood-700 text-gray-400 border border-hardwood-500 hover:text-white"
              )}
            >
              {p === "standard" && "Standard"}
              {p === "upset" && "Upset bonus"}
              {p === "custom" && "Custom"}
            </button>
          ))}
        </div>

        <p className="text-xs font-body text-gray-600">
          {scoringPreset === "standard" && "Points per correct pick, doubling each round."}
          {scoringPreset === "upset" && "Extra credit when lower seeds win."}
          {scoringPreset === "custom" && "Edit values below."}
        </p>

        <div className="space-y-2">
          {(Object.keys(ROUND_LABELS) as Round[]).map((round) => (
            <div key={round} className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs text-gray-500 w-28">{ROUND_LABELS[round]}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600 font-mono">pts</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={scoringRules.rounds[round].basePoints}
                    disabled={scoringPreset !== "custom"}
                    onChange={(e) =>
                      setScoringRules((prev) => ({
                        ...prev,
                        rounds: {
                          ...prev.rounds,
                          [round]: {
                            ...prev.rounds[round],
                            basePoints: parseInt(e.target.value, 10) || 0,
                          },
                        },
                      }))
                    }
                    className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600 font-mono">upset×</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={scoringRules.rounds[round].upsetMultiplier}
                    disabled={scoringPreset !== "custom"}
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

        <div className="pt-3 border-t border-hardwood-600 flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-gray-500">Champion bonus</span>
          <input
            type="number"
            min={0}
            max={999}
            value={scoringRules.bonuses.correctChampion}
            disabled={scoringPreset !== "custom"}
            onChange={(e) =>
              setScoringRules((prev) => ({
                ...prev,
                bonuses: {
                  ...prev.bonuses,
                  correctChampion: parseInt(e.target.value, 10) || 0,
                },
              }))
            }
            className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-court-500 hover:bg-court-600 disabled:opacity-40 text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
