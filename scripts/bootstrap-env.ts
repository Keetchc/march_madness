/**
 * Load `.env.local` before any `lib/dynamo` import so `DYNAMO_TABLE_PREFIX` / AWS keys apply.
 * Also set `MM_CLI_SCRIPT=1` so `lib/dynamo/tables` prefers `process.env` over Amplify artifacts.
 *
 * Use as the **first** import in CLI scripts under `scripts/`.
 */
import { config } from "dotenv";
import { resolve } from "path";

process.env.MM_CLI_SCRIPT = "1";
config({ path: resolve(process.cwd(), ".env.local") });
