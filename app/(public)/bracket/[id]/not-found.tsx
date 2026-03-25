import Link from "next/link";

export default function BracketNotFound() {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center px-4 text-center animate-fade-in">
      <p className="font-mono text-xs uppercase tracking-widest text-court-500 mb-2">Bracket</p>
      <h1 className="font-display text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-3">
        Not found
      </h1>
      <p className="text-ink-300 font-body text-sm max-w-md mb-8 leading-relaxed">
        This bracket doesn&apos;t exist or the link is wrong. If you switched tournament years in the
        navbar, try another season—or ask your pool admin for an updated link.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/leaderboard"
          className="inline-flex items-center rounded-lg bg-court-600 hover:bg-court-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          Global leaderboard
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg border border-hardwood-500 bg-hardwood-800 hover:bg-hardwood-700 text-ink-100 text-sm font-medium px-4 py-2 transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
