export default function RulesPage() {
  const rounds = [
    { name: "Round of 64", code: "R64", base: 1, example: { seed: 12, points: 12 } },
    { name: "Round of 32", code: "R32", base: 2, example: { seed: 7, points: 14 } },
    { name: "Sweet 16",    code: "S16", base: 4, example: { seed: 5, points: 20 } },
    { name: "Elite 8",     code: "E8",  base: 8, example: { seed: 3, points: 24 } },
    { name: "Final Four",  code: "F4",  base: 14, example: { seed: 2, points: 28 } },
    { name: "Championship", code: "NCG", base: 22, example: { seed: 1, points: 22 } },
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          Brian's Group
        </p>
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          Scoring Rules
        </h1>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">
          How Scoring Works
        </h2>
        <p className="text-ink-200 font-body leading-relaxed">
          For each correct pick, you earn points based on the round and the seed
          of the team you picked. The formula is:
        </p>
        <div className="bg-hardwood-700 border border-hardwood-500 rounded-xl px-6 py-4 text-center">
          <p className="font-mono text-lg text-white">
            Points = <span className="text-court-400">Base Points</span> x{" "}
            <span className="text-amber-400">Team Seed</span>
          </p>
        </div>
        <p className="text-ink-200 font-body leading-relaxed">
          This means picking upsets is rewarded -- correctly picking a 12-seed
          to win in the first round earns 12 points, while a 1-seed only earns 1.
          The risk/reward scales up in later rounds where base points are higher.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_5rem_8rem] gap-4 px-6 py-3 border-b border-hardwood-600 bg-hardwood-700">
          <span className="font-mono text-xs text-ink-400 uppercase">Round</span>
          <span className="font-mono text-xs text-ink-400 uppercase text-right">Base Pts</span>
          <span className="font-mono text-xs text-ink-400 uppercase text-right">Example</span>
        </div>
        <div className="divide-y divide-hardwood-700">
          {rounds.map((round) => (
            <div
              key={round.code}
              className="grid grid-cols-[1fr_5rem_8rem] gap-4 px-6 py-4 items-center"
            >
              <div>
                <p className="font-display font-bold uppercase tracking-wide text-white">
                  {round.name}
                </p>
                <p className="text-xs text-ink-400 font-mono">{round.code}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-xl font-bold text-court-400">{round.base}</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-ink-200">
                  {round.base} x {round.example.seed} ={" "}
                  <span className="text-white font-bold">{round.example.points}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">
          Max Possible Score
        </h2>
        <p className="text-ink-200 font-body leading-relaxed">
          Your "Max" on the leaderboard shows the highest score you can still
          achieve. It adds up your current points plus the potential points from
          every remaining game where your picked team is still alive. Once your
          team is eliminated, those future points drop off.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">
          Leaderboard Status
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-yellow-400 w-24">Leader</span>
            <span className="text-ink-200 font-body text-sm">Currently in first place</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-green-400 w-24">Alive</span>
            <span className="text-ink-200 font-body text-sm">Has a realistic path to overtake the leader</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-amber-400 w-24">Long Shot</span>
            <span className="text-ink-200 font-body text-sm">Mathematically possible but needs nearly everything to go right</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-red-400 w-24">Eliminated</span>
            <span className="text-ink-200 font-body text-sm">Cannot catch the leader even with all remaining picks correct</span>
          </div>
        </div>
      </div>
    </div>
  );
}
