# Feature backlog

Running list of ideas we might add later. Check things off or move them to a “Done” section when implemented.

---

## Done (recent)

- **Same bracket, multiple pools** — Supported in data/API; UX copy + “also in these groups” hint + `GET /api/bracket/[id]/groups`.
- **What-if toggles** — Hypothetical winners on bracket view; simulated score / max (default scoring rules).
- **Round-by-round mini leaderboard** — Points by NCAA round; group page + public leaderboard.
- **Group wall** — Short posts per group (Dynamo `WALL#` items).
- **Pool admin expansion** — Co-admins (`coAdminUserIds`), remove members (not owner), subgroups + segment filter on standings, rename pool, perfect-round bonus in engine + custom scoring UI, `isGroupAdmin()` everywhere.

---

## Insight & strategy

- [ ] **Head-to-head vs leader (or vs you)** — One-row summary on the group page: games you still disagree on and rough swing remaining (beyond full compare).
- [ ] **What-if using group scoring rules** — When opening a bracket from a group context, pass that group’s `scoringRules` into the simulator so it matches the pool.
- [ ] **“If this pick wins” single-game drill-down** — For the next few high-leverage games, show marginal impact on max score, current score, and rough rank vs key opponents (label heuristics clearly).
- [ ] **Sparklines / trend** — Tiny visual of rank or score over time (needs historical snapshots or event log).

---

## Stats-nerd lane (analytics & field view)

Ideas that lean into statistics-heavy bracket play; many compose with customizable scoring and what-ifs.

- [ ] **Group “Insights” strip** — One place on the group page: next high-needle games for *you*, quick vs-leader disagreement summary, optional “what changed since last score sync” (pairs well with audit trail).
- [ ] **Expected swing / equity heuristics** — For upcoming games, approximate impact narrative (e.g. uniqueness in pool, max path, rough title “equity”) with explicit “model is rough” copy; no need for perfect win probability on day one.
- [ ] **Pick overlap / consensus view** — Pool-wide % (or counts) on teams by region/round; optional “your picks vs field” overlay (chalk vs contrarian at a glance).
- [ ] **Contrarian index** — Simple score for how far a bracket is from pool consensus; optional badge on leaderboard or bracket card.
- [ ] **Round attribution** — Beyond round mini-leaderboard: points *gained* that round, max points *lost* to busts, short copy so nerds can explain standings.
- [ ] **Max vs realized / path remaining** — Persistent summary: current score, max still possible, which outcomes killed max (ties into what-if).
- [ ] **Scoring sensitivity** — What-if presets or slider: “if upset bonus were +N, your rank would be ~X” using same engine as custom rules.
- [ ] **CSV export** — Picks, per-round points, standings snapshot or history columns for spreadsheet people (export is trust + depth).

---

## Ops, trust & admin

- [ ] **Score / sync audit trail** — Timestamped log when ESPN sync or admin edits change a game; helps settle disputes.
- [ ] **Lock countdown everywhere** — Consistent “picks lock at …” in nav, group cards, bracket header.
- [ ] **Bracket in groups discovery** — Optional GSI on `bracketId` for member rows if we need “which groups use this bracket?” without scanning.

---

## Growth & retention

- [ ] **Email or SMS reminders** — e.g. first tipoff, “you’re X pts behind leader,” weekly digest (needs provider + prefs).
- [ ] **Share / OG cards** — One image or link preview: “I’m 3rd with 420 max” after a round.
- [ ] **Digest: biggest swings** — After each slate, auto post to group wall or email (“Biggest gainers: …”).

---

## Social & engagement (extensions)

- [ ] **Threaded comments or reactions** — On wall posts or per game.
- [ ] **Moderation** — Group admin delete wall posts; report flow.
- [ ] **@mentions** — If user directory is acceptable privacy-wise.

---

## Polish & UX

- [ ] **Mobile bracket gestures** — Pinch/zoom regions if the tree is still desktop-heavy.
- [ ] **Accessibility pass** — Leaderboard chips, contrast, `aria` / tooltips for competitive stats.
- [ ] **Public vs group scoring clarity** — Any surface using default rules should say so (partially done on public round board).

---

## Add new ideas below

<!-- Append bullets here as they come up -->
