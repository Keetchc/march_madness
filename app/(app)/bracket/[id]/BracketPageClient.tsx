"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { BracketView } from "@/components/bracket/BracketView";
import { BracketWhatIfPanel } from "@/components/bracket/BracketWhatIfPanel";
import type { Game, Team, Picks, Tournament, ScoringRules } from "@/lib/types";
import { LockCountdownBadge } from "@/components/layout/LockCountdownBadge";
import { projectPicksOntoGames } from "@/lib/bracket-utils";
import { picksClosedByTournament } from "@/lib/picks-lock";
import { SaveIcon, LockIcon, RefreshCwIcon } from "lucide-react";
import { clsx } from "clsx";

interface BracketPageClientProps {
  bracketId: string;
  userId: string;
  bracketUserId: string;
  bracketName: string;
  initialPicks: Picks;
  /** Non-owner view while picks are still open — no tree, no stats. */
  picksHiddenUntilLock?: boolean;
  lockHint?: string;
  /** Server omitted picks; refetch when client learns the viewer is the owner. */
  serverRedactedPicks?: boolean;
  /** When opened from a group the user belongs to, what-if uses this pool’s scoring rules. */
  whatIfScoringRules?: ScoringRules;
  whatIfScoringSourceLabel?: string;
}

type SaveState = "saved" | "saving" | "unsaved" | "error";

export function BracketPageClient({
  bracketId,
  userId,
  bracketUserId,
  bracketName,
  initialPicks,
  picksHiddenUntilLock = false,
  lockHint,
  serverRedactedPicks = false,
  whatIfScoringRules,
  whatIfScoringSourceLabel,
}: BracketPageClientProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  /** Server props can miss the viewer id on public routes (CDN/RSC caching). Prefer client session when signed in. */
  const resolvedViewerId = useMemo(() => {
    if (sessionStatus === "authenticated" && session?.user) {
      const u = session.user as { userId?: string; id?: string };
      const fromClient = (u.userId ?? u.id ?? "").toString().trim();
      if (fromClient) return fromClient;
    }
    return (userId ?? "").toString().trim();
  }, [session, sessionStatus, userId]);

  const isOwner =
    resolvedViewerId !== "" &&
    String(resolvedViewerId) === String(bracketUserId);
  const lockedBySchedule = tournament ? picksClosedByTournament(tournament) : false;
  const picksOpenByAdmin = tournament?.picksOpenOverride === true;
  const isLocked = picksOpenByAdmin ? false : lockedBySchedule;
  const canEdit = isOwner && !isLocked;

  /** Server may not have had session; hide others’ picks until lock unless client knows you’re the owner. */
  const hideBracketTree = picksHiddenUntilLock && !isOwner;

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

  useEffect(() => {
    if (!serverRedactedPicks || !isOwner) return;
    let cancelled = false;
    fetch(`/api/bracket/${bracketId}`)
      .then((r) => r.json())
      .then((b: { picks?: Picks }) => {
        if (cancelled || !b?.picks || typeof b.picks !== "object") return;
        if (Object.keys(b.picks).length > 0) setPicks(b.picks);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serverRedactedPicks, isOwner, bracketId]);

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
      <div className="flex items-center justify-center h-64 text-ink-300 font-mono text-sm animate-pulse">
        Loading bracket...
      </div>
    );
  }

  if (hideBracketTree) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-0.5">Private bracket</p>
            <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
              {bracketName}
            </h1>
          </div>
        </div>
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-10 text-center space-y-3 max-w-lg mx-auto">
          <p className="text-ink-100 font-body">
            This player has submitted a bracket. Picks and scores stay hidden until the pool locks.
          </p>
          {lockHint ? <p className="text-sm text-ink-300 font-mono">{lockHint}</p> : null}
        </div>
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
            saveState === "unsaved" && "text-ink-200 border-hardwood-600 bg-hardwood-800",
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

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {!isLocked && tournament ? (
            <LockCountdownBadge tournament={tournament} variant="default" />
          ) : null}
          {isLocked && (
            <div className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border text-red-400 border-red-900 bg-red-950/30">
              <LockIcon className="w-3 h-3" />
              Picks locked
            </div>
          )}
        </div>
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

      <BracketWhatIfPanel
        picks={picks}
        games={games}
        teams={teams}
        scoringRules={whatIfScoringRules}
        scoringSourceLabel={whatIfScoringSourceLabel}
      />
    </div>
  );
}

