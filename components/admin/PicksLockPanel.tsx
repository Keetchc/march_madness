"use client";

import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { picksEffectivelyClosed } from "@/lib/picks-lock";
import { clsx } from "clsx";
import { LockIcon, CircleCheckIcon } from "lucide-react";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  tournament: Tournament;
  onSaved: (t: Tournament) => void;
};

export function PicksLockPanel({ tournament: initial, onSaved }: Props) {
  const [lockLocal, setLockLocal] = useState(() => toDatetimeLocalValue(initial.lockDate));
  const [override, setOverride] = useState(initial.picksOpenOverride === true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLockLocal(toDatetimeLocalValue(initial.lockDate));
    setOverride(initial.picksOpenOverride === true);
  }, [initial.tournamentId, initial.lockDate, initial.picksOpenOverride]);

  const previewTournament: Tournament = useMemo(() => {
    let lockDate = initial.lockDate;
    if (lockLocal) {
      const parsed = new Date(lockLocal);
      if (!Number.isNaN(parsed.getTime())) lockDate = parsed.toISOString();
    }
    return {
      ...initial,
      lockDate,
      picksOpenOverride: override,
    };
  }, [initial, lockLocal, override]);

  const previewClosed = picksEffectivelyClosed(previewTournament);

  async function save() {
    if (!lockLocal) {
      setMessage("Set a picks close date/time.");
      return;
    }
    const parsed = new Date(lockLocal);
    if (Number.isNaN(parsed.getTime())) {
      setMessage("Invalid date/time.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/tournament", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockDate: parsed.toISOString(),
          picksOpenOverride: override,
        }),
      });
      const data = (await res.json()) as { error?: string; tournament?: Tournament };
      if (!res.ok || !data.tournament) {
        setMessage(data.error ?? "Save failed");
        return;
      }
      onSaved(data.tournament);
      setMessage("Saved.");
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-5 max-w-xl">
      <div>
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white mb-1">
          Bracket picks
        </h2>
        <p className="text-sm text-ink-300 font-body">
          Control when players can create brackets and change picks. Tournament status (
          <span className="font-mono text-ink-200">{initial.status}</span>) is separate — lock time alone
          closes the pick window and unlocks group standings visibility.
        </p>
      </div>

      <div
        className={clsx(
          "flex items-center gap-3 rounded-xl border px-4 py-3",
          previewClosed ? "border-red-900/60 bg-red-950/20" : "border-green-900/50 bg-green-950/15"
        )}
      >
        {previewClosed ? (
          <LockIcon className="w-5 h-5 text-red-400 shrink-0" />
        ) : (
          <CircleCheckIcon className="w-5 h-5 text-green-400 shrink-0" />
        )}
        <div>
          <p className="text-sm font-semibold text-white">
            {previewClosed ? "Players cannot edit picks" : "Players can edit picks"}
          </p>
          <p className="text-xs text-ink-300 font-mono mt-0.5">
            {override
              ? "Override is on — picks stay open until you turn it off."
              : previewClosed
                ? "Lock time has passed — picks are closed."
                : "Before picks close time."}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block font-mono text-xs uppercase tracking-widest text-ink-300">
          Picks close (your local time)
        </label>
        <input
          type="datetime-local"
          value={lockLocal}
          onChange={(e) => setLockLocal(e.target.value)}
          className="w-full max-w-sm bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-3 py-2 text-white font-mono text-sm outline-none"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={override}
          onChange={(e) => setOverride(e.target.checked)}
          className="mt-1 rounded border-hardwood-500 text-court-500 focus:ring-court-500 bg-hardwood-700"
        />
        <span>
          <span className="block text-sm font-medium text-white group-hover:text-court-200 transition-colors">
            Keep picks open (ignore lock time)
          </span>
          <span className="block text-xs text-ink-300 mt-1 font-body">
            Use for late entries or corrections. Turn off to enforce the close time above again.
          </span>
        </span>
      </label>

      {message && (
        <p
          className={clsx(
            "text-sm font-mono",
            message === "Saved." ? "text-green-400" : "text-amber-300"
          )}
        >
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-court-500 hover:bg-court-600 disabled:opacity-50 text-white font-display font-bold uppercase tracking-wide px-6 py-2.5 rounded-lg transition-colors"
      >
        {saving ? "Saving…" : "Save pick settings"}
      </button>
    </div>
  );
}
