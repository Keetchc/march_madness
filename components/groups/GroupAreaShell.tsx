"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LockCountdownBadge } from "@/components/layout/LockCountdownBadge";
import type { Tournament } from "@/lib/types";

type Props = {
  groupId: string;
  groupName: string;
  isGroupAdmin: boolean;
  tournamentLockPick?: Pick<Tournament, "lockDate" | "picksOpenOverride">;
  children: React.ReactNode;
};

function tabActive(pathname: string, href: string, groupId: string): boolean {
  const base = `/groups/${groupId}`;
  if (href === base) {
    return pathname === base || pathname === `${base}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GroupAreaShell({
  groupId,
  groupName,
  isGroupAdmin,
  tournamentLockPick,
  children,
}: Props) {
  const pathname = usePathname() ?? "";
  const base = `/groups/${groupId}`;

  const tabs: { href: string; label: string; adminOnly?: boolean }[] = [
    { href: base, label: "Standings" },
    { href: `${base}/wall`, label: "Wall" },
    { href: `${base}/compare`, label: "Compare" },
    { href: `${base}/brackets`, label: "Brackets" },
    { href: `${base}/scoring`, label: "Scoring" },
    { href: `${base}/invite`, label: "Invite", adminOnly: true },
    { href: `${base}/settings`, label: "Settings", adminOnly: true },
  ];

  const visible = tabs.filter((t) => !t.adminOnly || isGroupAdmin);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-6">
        <div className="min-w-0">
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Group</p>
          <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-white truncate">
            {groupName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <LockCountdownBadge tournament={tournamentLockPick} variant="default" />
        </div>
      </div>

      <nav
        className="-mx-1 px-1 mb-8 flex gap-1 overflow-x-auto pb-2 border-b border-hardwood-600"
        aria-label="Group sections"
      >
        {visible.map((t) => {
          const active = tabActive(pathname, t.href, groupId);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                "font-body text-sm font-semibold whitespace-nowrap rounded-lg px-3 py-2 transition-colors shrink-0",
                active
                  ? "bg-court-500/15 text-court-400 border border-court-500/40"
                  : "text-ink-200 hover:text-white hover:bg-hardwood-700 border border-transparent",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
