"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV_LINKS = [
  { href: "/leaderboard",       label: "Leaderboard" },
  { href: "/brackets",          label: "All Brackets" },
  { href: "/official-bracket",  label: "Official Bracket" },
  { href: "/rules",             label: "Rules" },
];

export function PublicNavbar() {
  const pathname = usePathname();

  return (
    <header className="bg-hardwood-800 border-b border-hardwood-600 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-[2000px]">
        <div className="flex items-center justify-between h-14">
          <Link href="/leaderboard" className="flex items-center gap-2 group">
            <span className="font-display text-xl font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors">
              Brian's<span className="text-court-500">Group</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors",
                  pathname.startsWith(link.href)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
