import { OfficialBracketClient } from "./OfficialBracketClient";

export const dynamic = "force-dynamic";

export default function OfficialBracketPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          2026 NCAA Tournament
        </p>
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          Official Bracket
        </h1>
      </div>
      <OfficialBracketClient />
    </div>
  );
}
