"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";

type Season = { tournamentId: string; name: string; year: number; status: string };

export function SeasonSelector({ className }: { className?: string }) {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/viewing-tournament")
      .then((r) => r.json())
      .then((d: { viewingTournamentId?: string; seasons?: Season[] }) => {
        if (Array.isArray(d.seasons)) setSeasons(d.seasons);
        if (typeof d.viewingTournamentId === "string") setCurrent(d.viewingTournamentId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (tid: string) => {
    if (!tid || tid === current) return;
    setBusy(true);
    fetch("/api/viewing-tournament", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: tid }),
    })
      .then((r) => {
        if (!r.ok) return;
        setCurrent(tid);
        router.refresh();
      })
      .finally(() => setBusy(false));
  };

  if (seasons.length <= 1) return null;

  return (
    <label className={clsx("flex items-center gap-1.5 shrink-0", className)}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-400 hidden lg:inline">
        Season
      </span>
      <select
        className="bg-hardwood-700 border border-hardwood-500 rounded-md px-2 py-1 text-xs text-white font-mono max-w-[5.5rem] sm:max-w-[9rem]"
        value={current}
        disabled={busy || !current}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Tournament season"
      >
        {seasons.map((s) => (
          <option key={s.tournamentId} value={s.tournamentId}>
            {s.year}
          </option>
        ))}
      </select>
    </label>
  );
}
