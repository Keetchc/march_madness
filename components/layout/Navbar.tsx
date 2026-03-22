"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { clsx } from "clsx";

interface NavbarProps {
  user: { name?: string; email?: string; image?: string; isAdmin?: boolean };
}

const NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/bracket",     label: "My Brackets" },
  { href: "/groups",      label: "Groups" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="bg-hardwood-800 border-b border-hardwood-600 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="text-2xl">🏀</span>
            <span className="font-display text-xl font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors">
              Bracket<span className="text-court-500">Bash</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
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
            {user.isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors",
                  pathname.startsWith("/admin")
                    ? "text-court-400 bg-hardwood-700"
                    : "text-yellow-500 hover:text-yellow-400 hover:bg-hardwood-700"
                )}
              >
                ⚡ Admin
              </Link>
            )}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-hardwood-600"
              />
            )}
            <span className="hidden sm:block text-sm text-gray-400 font-body">
              {user.name?.split(" ")[0]}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

