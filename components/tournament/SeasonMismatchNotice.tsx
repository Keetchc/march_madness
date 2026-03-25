import Link from "next/link";
import { getTournament } from "@/lib/dynamo/queries/games";

export async function SeasonMismatchNotice({
  kind,
  resourceTitle,
  resourceTournamentId,
  viewingTournamentId,
}: {
  kind: "bracket" | "group";
  resourceTitle: string;
  resourceTournamentId: string;
  viewingTournamentId: string;
}) {
  const [resT, viewT] = await Promise.all([
    getTournament(resourceTournamentId),
    getTournament(viewingTournamentId),
  ]);
  const resYear = String(resT?.year ?? resourceTournamentId);
  const viewYear = String(viewT?.year ?? viewingTournamentId);
  const kindLabel = kind === "group" ? "pool" : "bracket";

  return (
    <div className="max-w-lg mx-auto mt-8 sm:mt-12 px-4 animate-fade-in">
      <div className="rounded-2xl border border-amber-600/50 bg-hardwood-900/80 p-6 sm:p-8 shadow-lg">
        <p className="font-mono text-xs uppercase tracking-widest text-amber-500/90 mb-2">
          Wrong season
        </p>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white uppercase tracking-tight mb-3">
          This {kindLabel} isn&apos;t for the year you&apos;re viewing
        </h1>
        <p className="text-ink-200 font-body text-sm leading-relaxed mb-2">
          <span className="text-white font-medium">{resourceTitle}</span> belongs to the{" "}
          <span className="text-court-400 font-semibold tabular-nums">{resYear}</span> tournament, but
          your navbar is set to{" "}
          <span className="text-court-400 font-semibold tabular-nums">{viewYear}</span>.
        </p>
        <p className="text-ink-400 font-body text-sm leading-relaxed mb-6">
          Use the <span className="text-ink-200">Season</span> control in the top bar to switch to{" "}
          {resYear}, then open this {kindLabel} again. Historical pools only appear when their year is
          selected.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-court-600 hover:bg-court-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/groups"
            className="inline-flex items-center justify-center rounded-lg border border-hardwood-500 bg-hardwood-800 hover:bg-hardwood-700 text-ink-100 text-sm font-medium px-4 py-2 transition-colors"
          >
            My groups
          </Link>
          {kind === "bracket" && (
            <Link
              href="/bracket"
              className="inline-flex items-center justify-center rounded-lg border border-hardwood-500 bg-hardwood-800 hover:bg-hardwood-700 text-ink-100 text-sm font-medium px-4 py-2 transition-colors"
            >
              My brackets
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
