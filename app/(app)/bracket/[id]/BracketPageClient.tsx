"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import type { Game, Team, Picks, Tournament } from "@/lib/types";
import { projectPicksOntoGames } from "@/lib/bracket-utils";
import { SaveIcon, LockIcon, RefreshCwIcon } from "lucide-react";
import { clsx } from "clsx";

interface BracketPageClientProps {
  bracketId: string;
  userId: string;
  bracketUserId: string;
  bracketName: string;
  initialPicks: Picks;
}

type SaveState = "saved" | "saving" | "unsaved" | "error";

export function BracketPageClient({
  bracketId,
  userId,
  bracketUserId,
  bracketName,
  initialPicks,
}: BracketPageClientProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const isOwner = userId === bracketUserId;
  const lockedBySchedule = tournament
    ? new Date() > new Date(tournament.lockDate) && tournament.status !== "pending"
    : false;
  const picksOpenByAdmin = tournament?.picksOpenOverride === true;
  const isLocked = picksOpenByAdmin ? false : lockedBySchedule;
  const canEdit = isOwner && !isLocked;

  // Load tournament data
  useEffect(() => {
    fetch("/api/tournament")
      .then((r) => r.json())
      .then(({ tournament, games, teams: teamsArr }) => {
        setTournament(tournament);
        setGames(games ?? []);
        setTeams(new Map((teamsArr ?? []).map((t: Team) => [t.id, t])));
      })
      .finally(() => setLoading(false));
  }, []);

  // Poll for game updates every 60s when tournament is active
  useEffect(() => {
    if (tournament?.status !== "active") return;
    const interval = setInterval(() => {
      fetch("/api/tournament")
        .then((r) => r.json())
        .then(({ games }) => setGames(games ?? []));
    }, 60_000);
    return () => clearInterval(interval);
  }, [tournament?.status]);

  // Auto-save picks with 800ms debounce
  const savePicks = useCallback(async (newPicks: Picks) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/bracket/${bracketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: newPicks }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, [bracketId]);

  const handlePick = useCallback((gameId: string, teamId: string) => {
    setPicks((prev) => {
      const next = { ...prev, [gameId]: teamId };

      // Debounced save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState("unsaved");
      saveTimer.current = setTimeout(() => savePicks(next), 800);

      return next;
    });
  }, [savePicks]);

  const { games: projectedGames, projectedSlots, actualTeamOverrides } = useMemo(
    () =>
      projectPicksOntoGames(games, picks, {
        // When the owner can still edit, do not backfill empty slots with real game winners
        // (otherwise a new empty bracket looks like the “official” result tree).
        fillUnpickedFromActualWinners: !canEdit,
      }),
    [games, picks, canEdit],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 font-mono text-sm animate-pulse">
        Loading bracket...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-0.5">
            {isOwner ? "Your Bracket" : "Viewing Bracket"}
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
            {bracketName}
          </h1>
        </div>

        {/* Save status badge */}
        {canEdit && (
          <div className={clsx(
            "flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border transition-all",
            saveState === "saved"   && "text-green-400 border-green-900 bg-green-950/30",
            saveState === "saving"  && "text-yellow-400 border-yellow-900 bg-yellow-950/30",
            saveState === "unsaved" && "text-gray-400 border-hardwood-600 bg-hardwood-800",
            saveState === "error"   && "text-red-400 border-red-900 bg-red-950/30",
          )}>
            {saveState === "saving"  && <RefreshCwIcon className="w-3 h-3 animate-spin" />}
            {saveState === "saved"   && <SaveIcon className="w-3 h-3" />}
            {saveState === "unsaved" && <SaveIcon className="w-3 h-3" />}
            {saveState === "saving"  ? "Saving..." :
             saveState === "saved"   ? "Saved" :
             saveState === "error"   ? "Save failed" : "Unsaved changes"}
          </div>
        )}

        {isLocked && (
          <div className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border text-red-400 border-red-900 bg-red-950/30">
            <LockIcon className="w-3 h-3" />
            Picks locked
          </div>
        )}
      </div>

      {/* Bracket */}
      <BracketView
        games={projectedGames}
        teams={teams}
        picks={picks}
        projectedSlots={projectedSlots}
        actualTeamOverrides={actualTeamOverrides}
        onPick={canEdit ? handlePick : undefined}
        isReadOnly={!canEdit}
      />
    </div>
  );
}

