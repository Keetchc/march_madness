"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Group, GroupMember, GroupSubgroup, ScoringRules, Round, ScoringPresetId } from "@/lib/types";
import { BRIANS_SCORING_RULES, UPSET_SCORING_RULES, detectScoringPreset } from "@/lib/types";
import { clsx } from "clsx";
import { PlusIcon, Trash2Icon, ShieldIcon, UserMinusIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const ROUND_LABELS: Record<Round, string> = {
  R64: "Rd of 64",
  R32: "Rd of 32",
  S16: "Sweet 16",
  E8: "Elite 8",
  F4: "Final Four",
  NCG: "Championship",
};

type MemberRow = { member: GroupMember; displayName: string };

export function GroupSettingsClient({
  group,
  memberRows,
  currentUserId,
}: {
  group: Group;
  memberRows: MemberRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [groupName, setGroupName] = useState(group.name);
  const [subgroups, setSubgroups] = useState<GroupSubgroup[]>(group.subgroups ?? []);
  const [scoringPreset, setScoringPreset] = useState<ScoringPresetId>(() => detectScoringPreset(group.scoringRules));
  const [scoringRules, setScoringRules] = useState<ScoringRules>(group.scoringRules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [memberBusy, setMemberBusy] = useState<string | null>(null);

  const basesEditable = scoringPreset === "brians" || scoringPreset === "custom";
  const advancedEditable = scoringPreset === "custom";

  const isCoAdmin = (uid: string) =>
    (group.coAdminUserIds ?? []).some((id) => String(id) === String(uid));

  function applyPreset(preset: ScoringPresetId) {
    setScoringPreset(preset);
    if (preset === "brians") setScoringRules(BRIANS_SCORING_RULES);
    if (preset === "upset") setScoringRules(UPSET_SCORING_RULES);
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          subgroups,
          scoringRules,
        }),
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

  async function setMemberSubgroup(userId: string, subgroupId: string | null) {
    setMemberBusy(userId);
    try {
      // Member PATCH validates subgroup ids against the DB. New segments only exist in local state until saved—persist them first.
      if (subgroupId !== null) {
        const persistRes = await fetch(`/api/groups/${group.groupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subgroups }),
        });
        if (!persistRes.ok) {
          const d = await persistRes.json().catch(() => ({}));
          alert((d as { error?: string }).error ?? "Could not save segments. Fix segment names or use Save pool settings.");
          return;
        }
      }

      const res = await fetch(`/api/groups/${group.groupId}/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subgroupId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Could not update segment.");
        return;
      }
      router.refresh();
    } finally {
      setMemberBusy(null);
    }
  }

  async function promoteAdmin(userId: string) {
    setMemberBusy(userId);
    try {
      const res = await fetch(`/api/groups/${group.groupId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Could not promote.");
        return;
      }
      router.refresh();
    } finally {
      setMemberBusy(null);
    }
  }

  async function demoteAdmin(userId: string) {
    setMemberBusy(userId);
    try {
      const res = await fetch(
        `/api/groups/${group.groupId}/admins/${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Could not demote.");
        return;
      }
      router.refresh();
    } finally {
      setMemberBusy(null);
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Remove this person from the group? Their bracket will no longer count here.")) return;
    setMemberBusy(userId);
    try {
      const res = await fetch(`/api/groups/${group.groupId}/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Could not remove.");
        return;
      }
      router.refresh();
    } finally {
      setMemberBusy(null);
    }
  }

  function addSubgroup() {
    setSubgroups((prev) => [...prev, { id: uuidv4(), name: "New segment" }]);
  }

  return (
    <div className="max-w-3xl mx-auto pt-2 animate-fade-in space-y-8">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Settings</p>
        <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">Pool admin</h2>
        <p className="text-ink-300 text-sm font-body mt-2">
          Rename the pool, organize segments, manage members and co-admins, and tune scoring.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">Pool name</h2>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={120}
          className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-2.5 text-white font-body outline-none"
        />
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">Segments (subgroups)</h2>
        <p className="text-xs text-ink-300 font-body">
          Optional mini-standings (e.g. departments, families). Save pool settings below, then assign each member to
          a segment. They&apos;ll use the segment chips on the Standings tab to filter the board.
        </p>
        <div className="space-y-2">
          {subgroups.map((sg, i) => (
            <div key={sg.id} className="flex gap-2 items-center">
              <input
                type="text"
                value={sg.name}
                onChange={(e) => {
                  const next = [...subgroups];
                  next[i] = { ...next[i], name: e.target.value.slice(0, 80) };
                  setSubgroups(next);
                }}
                className="flex-1 bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-court-500"
              />
              <button
                type="button"
                onClick={() => setSubgroups((prev) => prev.filter((x) => x.id !== sg.id))}
                className="p-2 text-ink-300 hover:text-red-400 border border-hardwood-600 rounded-lg"
                title="Remove segment"
              >
                <Trash2Icon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSubgroup}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-court-400 hover:text-court-300"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add segment
        </button>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4 overflow-x-auto">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">Members</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-300 font-mono text-[10px] uppercase border-b border-hardwood-600">
              <th className="pb-2 pr-3">Player</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2 pr-3">Segment</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="font-body">
            {memberRows.map(({ member: m, displayName }) => {
              const isOwner = String(m.userId) === String(group.adminUserId);
              const isCo = isCoAdmin(m.userId);
              const busy = memberBusy === m.userId;
              return (
                <tr key={m.userId} className="border-b border-hardwood-700/80">
                  <td className="py-3 pr-3 text-white">
                    {displayName}
                    {String(m.userId) === String(currentUserId) ? (
                      <span className="text-[10px] text-court-600 font-mono ml-1">(you)</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-ink-200 text-xs">
                    {isOwner ? "Owner" : isCo ? "Co-admin" : "Member"}
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={m.subgroupId ?? ""}
                      disabled={busy || subgroups.length === 0}
                      onChange={(e) =>
                        setMemberSubgroup(m.userId, e.target.value === "" ? null : e.target.value)
                      }
                      className="bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-xs text-white max-w-[10rem]"
                    >
                      <option value="">— None —</option>
                      {subgroups.map((sg) => (
                        <option key={sg.id} value={sg.id}>
                          {sg.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {!isOwner && !isCo ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => promoteAdmin(m.userId)}
                        className="text-[10px] font-mono text-amber-400 hover:text-amber-300 mr-2 disabled:opacity-40"
                        title="Make co-admin"
                      >
                        <ShieldIcon className="w-3.5 h-3.5 inline mr-0.5" />
                        Admin
                      </button>
                    ) : null}
                    {isCo ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => demoteAdmin(m.userId)}
                        className="text-[10px] font-mono text-ink-200 hover:text-white mr-2 disabled:opacity-40"
                      >
                        Demote
                      </button>
                    ) : null}
                    {!isOwner ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeMember(m.userId)}
                        className="text-[10px] font-mono text-red-400 hover:text-red-300 disabled:opacity-40"
                      >
                        <UserMinusIcon className="w-3.5 h-3.5 inline mr-0.5" />
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">Scoring rules</h2>

        <div className="flex gap-2 flex-wrap">
          {(["brians", "upset", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={clsx(
                "px-4 py-1.5 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all",
                scoringPreset === p
                  ? "bg-court-500 text-white"
                  : "bg-hardwood-700 text-ink-200 border border-hardwood-500 hover:text-white"
              )}
            >
              {p === "brians" && "Brian's Rules"}
              {p === "upset" && "Upset bonus"}
              {p === "custom" && "Custom"}
            </button>
          ))}
        </div>

        <p className="text-xs font-body text-ink-400">
          {scoringPreset === "brians" &&
            "Base points × team seed for each correct pick. Edit the base per round below; use Custom for upset multipliers or bonuses."}
          {scoringPreset === "upset" && "Extra credit when lower seeds win (plus champion bonus). Switch to Custom to edit."}
          {scoringPreset === "custom" && "Edit base points, upset multipliers, and bonuses below."}
        </p>

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

        <div className="pt-3 border-t border-hardwood-600 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-xs text-ink-300">Champion bonus</span>
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
                    correctChampion: parseInt(e.target.value, 10) || 0,
                  },
                }))
              }
              className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-ink-300 block">Perfect round bonus</span>
              <span className="text-[10px] text-ink-400 font-body">
                Extra points when you nail every game in a round that&apos;s fully final.
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={999}
              value={scoringRules.bonuses.perfectRound}
              disabled={!advancedEditable}
              onChange={(e) =>
                setScoringRules((prev) => ({
                  ...prev,
                  bonuses: {
                    ...prev.bonuses,
                    perfectRound: parseInt(e.target.value, 10) || 0,
                  },
                }))
              }
              className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={loading || !groupName.trim()}
        className="w-full bg-court-500 hover:bg-court-600 disabled:opacity-40 text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors"
      >
        {loading ? "Saving…" : "Save pool settings"}
      </button>
    </div>
  );
}
