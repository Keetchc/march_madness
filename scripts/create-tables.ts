/**
 * Create all DynamoDB tables (local or AWS).
 *
 * Usage:
 *   npm run setup
 *   DYNAMO_TABLE_PREFIX=mm-dev npm run setup
 *   npm run setup -- --prefix=mm-dev
 */
import {
  CreateTableCommand,
  ListTablesCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import { rawClient } from "../lib/dynamo/client";
import { getTableCreateInputs } from "../lib/dynamo/table-specs";

function parsePrefixFromArgv(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--prefix="));
  return arg?.slice("--prefix=".length)?.trim() || undefined;
}

async function main() {
  const prefix =
    parsePrefixFromArgv() ??
    (process.env.DYNAMO_TABLE_PREFIX?.trim() || "mm");

  console.log(`🏀 Setting up DynamoDB tables (prefix: ${prefix})...\n`);

  const tables = getTableCreateInputs(prefix);
  const existing = await rawClient.send(new ListTablesCommand({}));
  const existingNames = new Set(existing.TableNames ?? []);

  for (const table of tables) {
    const name = table.TableName!;
    if (existingNames.has(name)) {
      console.log(`  ✓ ${name} (already exists)`);
      continue;
    }
    try {
      await rawClient.send(new CreateTableCommand(table));
      console.log(`  ✅ Created: ${name}`);
    } catch (err) {
      if (err instanceof ResourceInUseException) {
        console.log(`  ✓ ${name} (already exists)`);
      } else {
        console.error(`  ❌ Failed: ${name}`, err);
        throw err;
      }
    }
  }

  console.log(
    "\n✅ All tables ready. Run `npm run seed` to import tournament data (use the same DYNAMO_TABLE_PREFIX)."
  );
}

main().catch(console.error);
