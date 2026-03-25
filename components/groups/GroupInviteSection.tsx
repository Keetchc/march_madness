"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { CopyIcon, CheckIcon, RefreshCwIcon, LinkIcon } from "lucide-react";
import type { Group } from "@/lib/types";

type Props = {
  group: Group;
  isGroupAdmin: boolean;
};

export function GroupInviteSection({ group, isGroupAdmin }: Props) {
  const [inviteToken, setInviteToken] = useState(group.inviteToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const invitePath = `/groups/join/${inviteToken}`;

  async function copyInvite() {
    const absolute = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(absolute);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateInvite() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateInvite: true }),
      });
      const data = await res.json();
      if (data.inviteToken) setInviteToken(data.inviteToken);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Invite</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
          Share this pool
        </h2>
        <p className="text-ink-300 text-sm font-body mt-2">
          Anyone with the link can join. The same bracket can live in multiple groups—one set of picks.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-4 h-4 text-court-500" />
          <h3 className="font-display font-bold uppercase tracking-wide text-sm text-white">Invite link</h3>
        </div>
        <p className="text-xs text-ink-300 font-body mb-3">
          Share this path or the full URL after copying. Admins can rotate the token if a link leaks.
        </p>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex-1 min-w-[12rem] bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2 font-mono text-xs text-ink-200 truncate">
            {invitePath}
          </div>
          <button
            type="button"
            onClick={copyInvite}
            className="flex items-center gap-1.5 bg-court-500 hover:bg-court-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          {isGroupAdmin && (
            <button
              type="button"
              onClick={regenerateInvite}
              disabled={regenerating}
              className="flex items-center gap-1.5 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-ink-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
              title="Regenerate invite link (invalidates old one)"
            >
              <RefreshCwIcon className={clsx("w-3.5 h-3.5", regenerating && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-400 font-body">
        Prefer email or text? Copy the link above. New members sign in, then choose an existing bracket or create one.
      </p>
      <Link
        href={`/groups/join/${inviteToken}`}
        className="inline-flex text-sm font-semibold text-court-400 hover:text-court-300 transition-colors"
      >
        Preview join page →
      </Link>
    </div>
  );
}
