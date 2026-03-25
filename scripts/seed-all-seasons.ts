/**
 * Seed every `bracket-*.json` in scripts/ (2024, 2025, 2026, …).
 *
 *   npm run seed:all
 *
 * The app lists seasons from Dynamo (each seeded tournament). Optional `TOURNAMENT_SEASONS`
 * in `.env.local` can hide some years from the switcher.
 *
 * Uses the same process as `npm run seed` (no nested `npx`), so it works reliably on Windows.
 */
import * as fs from "fs";
import * as path from "path";
import { seedBracketFromFile } from "./seed-tournament";

const scriptsDir = __dirname;
const files = fs
  .readdirSync(scriptsDir)
  .filter((n) => /^bracket-\d{4}\.json$/.test(n))
  .sort();

if (files.length === 0) {
  console.error("No bracket-YYYY.json files found in scripts/");
  process.exit(1);
}

async function run() {
  for (const f of files) {
    const fp = path.join(scriptsDir, f);
    console.log(`\n=== ${f} ===\n`);
    try {
      await seedBracketFromFile(fp);
    } catch (err) {
      console.error(`\n❌ Failed on ${f}:`, err);
      process.exit(1);
    }
  }
  console.log("\n✅ All bracket files seeded.");
}

run().catch((err) => {
  console.error("\n❌ seed:all failed:", err);
  process.exit(1);
});
