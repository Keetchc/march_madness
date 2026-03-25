"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Bracket, Group, GroupMember, LeaderboardEntry } from "@/lib/types";
import Link from "next/link";
import { clsx } from "clsx";
import {
  PoolLeaderboardRow,
  PoolLeaderboardTableHeaders,
} from "@/components/leaderboard/PoolLeaderboardRow";
import { RoundMiniLeaderboard } from "@/components/leaderboard/RoundMiniLeaderboard";
import { VsLeaderBanner } from "@/components/groups/VsLeaderBanner";
import { TrophyIcon } from "lucide-react";
import type { VsLeaderSnapshot } from "@/lib/scoring/vs-leader";

interface GroupStandingsClientProps {
  group: Group;
  members: GroupMember[];
  leaderboard: LeaderboardEntry[];
  currentUserId: string;
  isGroupAdmin: boolean;
  isAppAdmin: boolean;
  needsBracket: boolean;
  maskOpponentStandings: boolean;
  gamesCompletedCount: number;
  tournamentName?: string | null;
  vsLeader: VsLeaderSnapshot | null;
  myBracketId: string;
}

export function GroupStandingsClient({
  group,
  members,
  leaderboard,
  currentUserId,
  isGroupAdmin,
  isAppAdmin,
  needsBracket,
  maskOpponentStandings,
  gamesCompletedCount,
  tournamentName,
  vsLeader,
  myBracketId,
}: GroupStandingsClientProps) {
  const [subgroupFilter, setSubgroupFilter] = useState<string | null>(null);

  const bracketFromGroupQuery = `?fromGroup=${encodeURIComponent(group.groupId)}`;

  const canSeeEveryoneStats = !maskOpponentStandings || isGroupAdmin || isAppAdmin;

  const displayLeaderboard = useMemo(() => {
    if (canSeeEveryoneStats) return leaderboard;
    const copy = [...leaderboard].sort((a, b) =>
      a.userName.localeCompare(b.userName, undefined, { sensitivity: "base" }),
    );
    return copy;
  }, [leaderboard, canSeeEveryoneStats]);

  const memberByUserId = useMemo(() => {
    const m = new Map<string, GroupMember>();
    for (const row of members) m.set(String(row.userId), row);
    return m;
  }, [members]);

  const standingsRows = useMemo(() => {
    let list = displayLeaderboard;
    if (subgroupFilter && (group.subgroups?.length ?? 0) > 0 && canSeeEveryoneStats) {
      list = list.filter((e) => memberByUserId.get(String(e.userId))?.subgroupId === subgroupFilter);
    }
    const sorted = [...list].sort((a, b) =>
      b.score !== a.score ? b.score - a.score : b.maxPossibleScore - a.maxPossibleScore,
    );
    let rank = 1;
    return sorted.map((entry, i) => {
      if (i > 0 && sorted[i].score < sorted[i - 1].score) rank = i + 1;
      return { entry, rankDisplay: rank };
    });
  }, [displayLeaderboard, subgroupFilter, group.subgroups, memberByUserId, canSeeEveryoneStats]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrophyIcon className="w-5 h-5 text-court-500" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
            Standings
          </h2>
        </div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest">
          {tournamentName ?? "Tournament"}
        </p>
        <p className="text-ink-300 text-sm font-mono mt-1">
          {gamesCompletedCount} games complete —{" "}
          {subgroupFilter ? `${standingsRows.length} in this segment` : `${leaderboard.length} in this group`}
        </p>
      </div>

      {vsLeader && myBracketId ? (
        <VsLeaderBanner snapshot={vsLeader} groupId={group.groupId} myBracketId={myBracketId} />
      ) : null}

      {needsBracket && <LinkYourBracketCard groupId={group.groupId} />}

      {canSeeEveryoneStats && (group.subgroups?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubgroupFilter(null)}
            className={clsx(
              "font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-lg border transition-colors",
              subgroupFilter === null
                ? "bg-court-500/20 border-court-500 text-court-300"
                : "bg-hardwood-900/50 border-hardwood-600 text-ink-300 hover:border-hardwood-500",
            )}
          >
            Entire pool
          </button>
          {group.subgroups!.map((sg) => (
            <button
              key={sg.id}
              type="button"
              onClick={() => setSubgroupFilter(sg.id)}
              className={clsx(
                "font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-lg border transition-colors",
                subgroupFilter === sg.id
                  ? "bg-court-500/20 border-court-500 text-court-300"
                  : "bg-hardwood-900/50 border-hardwood-600 text-ink-300 hover:border-hardwood-500",
              )}
            >
              {sg.name}
            </button>
          ))}
        </div>
      )}

      {maskOpponentStandings && !canSeeEveryoneStats && (
        <p className="text-xs font-mono text-ink-300 max-w-xl">
          Before the first game goes final, other members’ scores and bracket titles stay hidden so nobody scouts early
          entries. You always see your own row; once games start finishing, everyone’s standings match the pool.
        </p>
      )}

      {!maskOpponentStandings && leaderboard.length > 0 && gamesCompletedCount === 0 && (
        <p className="text-xs font-mono text-amber-600/90 max-w-xl">
          Picks are locked, but there are no finished games in this pool yet — scores stay at 0 until games are marked
          final (e.g. ESPN sync / admin tools). Max points can still show from your remaining picks.
        </p>
      )}

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
        {leaderboard.length > 0 && <PoolLeaderboardTableHeaders />}

        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-ink-400 font-body">No brackets submitted yet.</div>
        ) : standingsRows.length === 0 ? (
          <div className="p-12 text-center text-ink-400 font-body">
            No brackets in this segment yet. Assign members in Settings → Members.
          </div>
        ) : (
          <div className="divide-y divide-hardwood-700">
            {standingsRows.map(({ entry, rankDisplay }) => (
              <PoolLeaderboardRow
                key={entry.bracketId}
                entry={entry}
                isCurrentUser={String(entry.userId) === String(currentUserId)}
                maskStats={maskOpponentStandings && !canSeeEveryoneStats}
                rankDisplay={rankDisplay}
                bracketHrefQuery={bracketFromGroupQuery}
              />
            ))}
          </div>
        )}
      </div>

      {canSeeEveryoneStats && standingsRows.length > 0 && (
        <div className="mt-6">
          <RoundMiniLeaderboard leaderboard={standingsRows.map((r) => r.entry)} />
        </div>
      )}
    </div>
  );
}

function BracketAlsoInGroupsHint({
  groupId,
  selectedBracketId,
}: {
  groupId: string;
  selectedBracketId: string;
}) {
  const [groups, setGroups] = useState<{ groupId: string; name: string }[]>([]);

  useEffect(() => {
    if (!selectedBracketId) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/bracket/${encodeURIComponent(selectedBracketId)}/groups`)
      .then((r) => r.json())
      .then((d: { groups?: { groupId: string; name: string }[] }) => {
        if (cancelled || !Array.isArray(d.groups)) return;
        setGroups(d.groups.filter((g) => g.groupId !== groupId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedBracketId, groupId]);

  if (!selectedBracketId || groups.length === 0) return null;

  return (
    <p className="text-[11px] text-sky-500/90 font-mono mb-3 leading-relaxed">
      This bracket is also in{" "}
      {groups.map((g, i) => (
        <span key={g.groupId}>
          {i > 0 ? ", " : null}
          <Link href={`/groups/${g.groupId}`} className="text-sky-300 hover:underline">
            {g.name}
          </Link>
        </span>
      ))}
      .
    </p>
  );
}

function LinkYourBracketCard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/bracket")
      .then((r) => r.json())
      .then((d) => setBrackets(Array.isArray(d) ? d : []));
  }, []);

  async function link() {
    if (!selected) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/groups/${groupId}/link-bracket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracketId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Could not link bracket.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-court-500/10 border border-court-500/40 rounded-2xl p-5">
      <h3 className="font-display font-bold uppercase tracking-wide text-court-400 text-sm mb-2">Add your bracket</h3>
      <p className="text-xs text-ink-200 font-body mb-4 max-w-xl">
        You&apos;re in this group but no bracket is linked to your entry yet — group creators start here too. Pick an
        existing bracket or create one; you can also use the invite link flow (&quot;join now, add later&quot;) for the
        same options. One bracket can be used in every pool you join—link the same entry everywhere if you like.
      </p>
      {brackets.length > 0 ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 min-w-0 bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-2.5 text-white font-body text-sm outline-none transition-colors"
          >
            <option value="">-- Choose a bracket --</option>
            {brackets.map((b) => (
              <option key={b.bracketId} value={b.bracketId}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={link}
            disabled={busy || !selected}
            className="shrink-0 bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase text-xs tracking-wide px-4 py-2.5 rounded-lg transition-colors"
          >
            {busy ? "Linking..." : "Link to group"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-ink-300 font-body mb-3">You don&apos;t have any brackets in this pool yet.</p>
      )}
      <BracketAlsoInGroupsHint groupId={groupId} selectedBracketId={selected} />
      <Link
        href={`/bracket/new?returnTo=${encodeURIComponent(`/groups/${groupId}`)}`}
        className="inline-block mt-3 text-sm font-semibold text-court-400 hover:text-court-300 transition-colors"
      >
        Create a new bracket →
      </Link>
      {err ? <p className="text-red-400 text-xs font-mono mt-3">{err}</p> : null}
    </div>
  );
}
