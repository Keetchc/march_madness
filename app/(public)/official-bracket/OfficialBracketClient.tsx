"use client";
import { useEffect, useState } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import type { Game, Team } from "@/lib/types";

export function OfficialBracketClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tournament")
      .then((r) => r.json())
      .then(({ games, teams: teamsArr }) => {
        setGames(games ?? []);
        setTeams(new Map((teamsArr ?? []).map((t: Team) => [t.id, t])));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 font-mono text-sm animate-pulse">
        Loading bracket...
      </div>
    );
  }

  return (
    <BracketView
      games={games}
      teams={teams}
      picks={{}}
      isReadOnly
    />
  );
}
