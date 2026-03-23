/**
 * Create prefixed “dev” tables and optionally copy all items from prod tables.
 *
 * Prerequisites: AWS credentials with dynamodb:Scan, dynamodb:BatchWriteItem, dynamodb:CreateTable
 * (same as `npm run setup`). Do not point DYNAMODB_ENDPOINT at local when cloning real AWS.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/clone-dynamo-tables.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/clone-dynamo-tables.ts --source-prefix=mm --dest-prefix=mm-dev
 *   npx ts-node --project tsconfig.scripts.json scripts/clone-dynamo-tables.ts --create-only
 *
 * Env (optional):
 *   DYNAMO_CLONE_SOURCE_PREFIX (default mm)
 *   DYNAMO_CLONE_DEST_PREFIX   (default mm-dev)
 *   MM_REGION or AWS_REGION    (must match region where source tables exist; default us-east-1)
 */
import { BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, rawClient } from "../lib/dynamo/client";
import {
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import {
  DYNAMO_TABLE_SUFFIXES,
  dynamoTableName,
  getTableCreateInputs,
} from "../lib/dynamo/table-specs";

const BATCH_SIZE = 25;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim() || undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function dynamoClientRegion(): string {
  return (
    process.env.MM_REGION ??
    process.env.AWS_REGION ??
    "us-east-1"
  );
}

/** Fail fast if prod/source tables are not in this account+region (matches `lib/dynamo/client.ts`). */
async function assertSourceTablesExist(sourcePrefix: string): Promise<void> {
  const region = dynamoClientRegion();
  for (const suffix of DYNAMO_TABLE_SUFFIXES) {
    const name = dynamoTableName(sourcePrefix, suffix);
    try {
      await rawClient.send(new DescribeTableCommand({ TableName: name }));
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name === "ResourceNotFoundException") {
        console.error(
          `Source table "${name}" was not found in region "${region}".\n` +
            `Set MM_REGION or AWS_REGION to the region where your prod tables live (same as Amplify / Dynamo console), ` +
            `or fix --source-prefix if tables use another prefix.\n` +
            `This app’s Dynamo client uses: MM_REGION → AWS_REGION → us-east-1.`
        );
        process.exit(1);
      }
      throw e;
    }
  }
}

async function ensureTablesExist(prefix: string): Promise<void> {
  const tables = getTableCreateInputs(prefix);
  const existing = await rawClient.send(new ListTablesCommand({}));
  const existingNames = new Set(existing.TableNames ?? []);

  for (const table of tables) {
    const name = table.TableName!;
    if (existingNames.has(name)) {
      console.log(`  ✓ ${name} (exists)`);
      continue;
    }
    try {
      await rawClient.send(new CreateTableCommand(table));
      console.log(`  ✅ Created: ${name}`);
    } catch (err) {
      if (err instanceof ResourceInUseException) {
        console.log(`  ✓ ${name} (exists)`);
      } else {
        throw err;
      }
    }
  }
}

async function tableHasAnyItem(tableName: string): Promise<boolean> {
  const out = await dynamo.send(
    new ScanCommand({
      TableName: tableName,
      Limit: 1,
      ProjectionExpression: "pk",
    })
  );
  return (out.Items?.length ?? 0) > 0;
}

async function copyTable(source: string, dest: string): Promise<number> {
  let total = 0;
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await dynamo.send(
      new ScanCommand({
        TableName: source,
        ExclusiveStartKey: startKey,
      })
    );
    const items = page.Items ?? [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      let requestItems = {
        [dest]: chunk.map((Item) => ({ PutRequest: { Item } })),
      };

      let attempt = 0;
      while (true) {
        const res = await dynamo.send(
          new BatchWriteCommand({ RequestItems: requestItems })
        );
        const unprocessed = res.UnprocessedItems?.[dest];
        if (!unprocessed?.length) break;
        // UnprocessedItems is typed with optional PutRequest; runtime shape matches RequestItems.
        requestItems = { [dest]: unprocessed } as typeof requestItems;
        attempt++;
        if (attempt >= 12) {
          throw new Error(
            `BatchWrite still has ${unprocessed.length} unprocessed items for ${dest}`
          );
        }
        await new Promise((r) => setTimeout(r, 50 * attempt));
      }
    }
    total += items.length;
    startKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);

  return total;
}

async function main() {
  const createOnly = hasFlag("--create-only");
  const sourcePrefix =
    arg("--source-prefix") ?? process.env.DYNAMO_CLONE_SOURCE_PREFIX ?? "mm";
  const destPrefix =
    arg("--dest-prefix") ?? process.env.DYNAMO_CLONE_DEST_PREFIX ?? "mm-dev";
  const force = hasFlag("--force");

  if (process.env.DYNAMODB_ENDPOINT) {
    console.error(
      "DYNAMODB_ENDPOINT is set (DynamoDB Local). Unset it to clone real AWS tables."
    );
    process.exit(1);
  }

  if (sourcePrefix === destPrefix) {
    console.error("Source and dest prefix must differ.");
    process.exit(1);
  }

  console.log(`Source prefix: ${sourcePrefix}`);
  console.log(`Dest prefix:   ${destPrefix}`);
  console.log(`AWS region:    ${dynamoClientRegion()} (MM_REGION or AWS_REGION)\n`);
  console.log(createOnly ? "Mode: create tables only\n" : "Mode: create + copy data\n");

  if (!createOnly) {
    await assertSourceTablesExist(sourcePrefix);
  }

  await ensureTablesExist(destPrefix);

  if (createOnly) {
    console.log("\n✅ Dev tables ready (empty). Point the dev app at DYNAMO_TABLE_PREFIX=" + destPrefix);
    return;
  }

  for (const suffix of DYNAMO_TABLE_SUFFIXES) {
    const src = dynamoTableName(sourcePrefix, suffix);
    const dst = dynamoTableName(destPrefix, suffix);

    if (await tableHasAnyItem(dst)) {
      if (!force) {
        console.error(
          `\nDestination ${dst} is not empty. Re-run with --force to overwrite, or truncate the table first.`
        );
        process.exit(1);
      }
      console.warn(`\n⚠ ${dst} has data; --force set — copying from ${src} will upsert/overwrite keys.`);
    }

    console.log(`\nCopying ${src} → ${dst} ...`);
    const n = await copyTable(src, dst);
    console.log(`  ${n} items`);
  }

  console.log(
    `\n✅ Done. Set DYNAMO_TABLE_PREFIX=${destPrefix} on your dev Amplify branch (and redeploy). Dev users must sign in again (separate NextAuth rows).`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
