"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/leaderboard",       label: "Leaderboard" },
  { href: "/brackets",          label: "All Brackets" },
  { href: "/official-bracket",  label: "Official Bracket" },
  { href: "/rules",             label: "Rules" },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <header className="relative bg-hardwood-800 border-b border-hardwood-600 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-[2000px]">
        <div className="flex items-center justify-between gap-3 h-14 min-w-0">
          <Link href="/leaderboard" className="flex items-center gap-2 group min-w-0 shrink">
            <span className="font-display text-lg sm:text-xl font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors truncate">
              Brian's<span className="text-court-500">Group</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                  pathname.startsWith(link.href)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:text-white hover:bg-hardwood-700 transition-colors flex-shrink-0"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 top-14 bg-black/50 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="md:hidden absolute left-0 right-0 top-full border-b border-hardwood-600 bg-hardwood-800 shadow-xl z-50 flex flex-col p-3 gap-1 animate-fade-in">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-4 py-3 rounded-lg transition-colors",
                  pathname.startsWith(link.href)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
