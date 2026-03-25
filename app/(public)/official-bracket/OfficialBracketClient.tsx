"use client";
import { useEffect, useState } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import type { Game, Team } from "@/lib/types";

type Props = {
  initialGames: Game[];
  initialTeams: Team[];
  /** Season from SSR (may lag cookie); client always refetches via /api/tournament (cookie). */
  initialTournamentId: string;
};

export function OfficialBracketClient({
  initialGames,
  initialTeams,
  initialTournamentId,
}: Props) {
  const [games, setGames] = useState<Game[]>(initialGames);
  const [teams, setTeams] = useState<Map<string, Team>>(
    () => new Map(initialTeams.map((t) => [t.id, t])),
  );
  const [tournamentId, setTournamentId] = useState(initialTournamentId);
  /** SSR can miss the viewing cookie; client fetch is authoritative. */
  const [loadState, setLoadState] = useState<"loading" | "ok" | "missing">(() =>
    initialGames.length > 0 ? "ok" : "loading",
  );

  useEffect(() => {
    setGames(initialGames);
    setTeams(new Map(initialTeams.map((t) => [t.id, t])));
    setTournamentId(initialTournamentId);
    if (initialGames.length > 0) {
      setLoadState("ok");
    } else {
      setLoadState("loading");
    }
  }, [initialGames, initialTeams, initialTournamentId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tournament")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok || !j?.tournament) {
          setGames([]);
          setTeams(new Map());
          setLoadState("missing");
          return;
        }
        setGames((j.games as Game[]) ?? []);
        const arr = (j.teams as Team[]) ?? [];
        setTeams(new Map(arr.filter((t) => t?.id).map((t) => [t.id, t])));
        const tid = (j as { tournament?: { tournamentId?: string } }).tournament?.tournamentId;
        if (tid) setTournamentId(tid);
        setLoadState("ok");
      })
      .catch(() => {
        if (!cancelled) setLoadState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [initialTournamentId]);

  if (loadState === "loading") {
    return (
      <div className="rounded-xl border border-hardwood-600 bg-hardwood-800 px-6 py-16 text-center">
        <p className="text-ink-300 font-mono text-sm animate-pulse">Loading bracket…</p>
      </div>
    );
  }

  if (loadState === "missing") {
    return (
      <div className="rounded-xl border border-hardwood-600 bg-hardwood-800 px-6 py-10 text-center">
        <p className="text-ink-200 font-body max-w-md mx-auto">
          Tournament data isn&apos;t available yet. After the tournament is seeded in the database, the
          official bracket will show here.
        </p>
      </div>
    );
  }

  return (
    <BracketView
      games={games}
      teams={teams}
      picks={{}}
      isReadOnly
      hidePickStatus
      pickListMode="aggregate"
      tournamentId={tournamentId}
    />
  );
}
