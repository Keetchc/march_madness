/**
 * Copy all items from AWS DynamoDB tables (e.g. mm-dev-*) into DynamoDB Local.
 *
 * Loads `.env.local` for DYNAMODB_ENDPOINT, DYNAMO_TABLE_PREFIX, and region.
 * If AWS_ACCESS_KEY_ID is the dummy `local` value, it is temporarily unset so the
 * source client uses ~/.aws/credentials (or your default AWS credential chain).
 *
 * Usage:
 *   npm run pull-dev-to-local
 *   npx ts-node --project tsconfig.scripts.json scripts/pull-dynamo-dev-to-local.ts --force
 *
 * Env (optional):
 *   DYNAMO_PULL_SOURCE_PREFIX   (default mm-dev) — AWS table prefix to scan
 *   DYNAMO_PULL_LOCAL_PREFIX    (default DYNAMO_TABLE_PREFIX or mm) — local destination prefix
 *   DYNAMODB_ENDPOINT           (required) e.g. http://localhost:8000
 *   AWS_REGION / MM_REGION      (default us-east-1) — must match AWS tables’ region
 *   AWS_PROFILE                 — profile for source credentials when dummy local keys are stripped
 */
import { resolve } from "path";
import { config } from "dotenv";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import {
  DYNAMO_TABLE_SUFFIXES,
  dynamoTableName,
  getTableCreateInputs,
} from "../lib/dynamo/table-specs";

config({ path: resolve(process.cwd(), ".env.local") });

const BATCH_SIZE = 25;

const marshallOptions = {
  removeUndefinedValues: true,
  convertClassInstanceToMap: true,
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim() || undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function region(): string {
  return (
    process.env.MM_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-1"
  );
}

type SavedCreds = {
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  MM_ACCESS_KEY_ID?: string;
  MM_SECRET_ACCESS_KEY?: string;
};

function stripDummyAwsEnvForSource(): SavedCreds {
  const saved: SavedCreds = {};
  const key =
    process.env.AWS_ACCESS_KEY_ID ?? process.env.MM_ACCESS_KEY_ID ?? "";
  if (key.toLowerCase() === "local") {
    for (const k of [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "MM_ACCESS_KEY_ID",
      "MM_SECRET_ACCESS_KEY",
    ] as const) {
      if (process.env[k] !== undefined) {
        saved[k] = process.env[k];
        delete process.env[k];
      }
    }
  }
  return saved;
}

function restoreEnv(saved: SavedCreds): void {
  for (const [k, v] of Object.entries(saved)) {
    if (v !== undefined) process.env[k] = v;
  }
}

async function assertAwsSourceTablesExist(
  sourcePrefix: string,
  client: DynamoDBClient,
  reg: string
): Promise<void> {
  for (const suffix of DYNAMO_TABLE_SUFFIXES) {
    const name = dynamoTableName(sourcePrefix, suffix);
    try {
      await client.send(new DescribeTableCommand({ TableName: name }));
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err.name === "ResourceNotFoundException") {
        console.error(
          `Source table "${name}" was not found in AWS region "${reg}".\n` +
            `Check DYNAMO_PULL_SOURCE_PREFIX and AWS_REGION / MM_REGION, and that this profile can see the table.`
        );
        process.exit(1);
      }
      throw e;
    }
  }
}

async function ensureLocalTablesExist(
  prefix: string,
  rawLocal: DynamoDBClient
): Promise<void> {
  const tables = getTableCreateInputs(prefix);
  const existing = await rawLocal.send(new ListTablesCommand({}));
  const existingNames = new Set(existing.TableNames ?? []);

  for (const table of tables) {
    const name = table.TableName!;
    if (existingNames.has(name)) {
      console.log(`  ✓ ${name} (exists)`);
      continue;
    }
    try {
      await rawLocal.send(new CreateTableCommand(table));
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

async function tableHasAnyItem(
  doc: DynamoDBDocumentClient,
  tableName: string
): Promise<boolean> {
  const out = await doc.send(
    new ScanCommand({
      TableName: tableName,
      Limit: 1,
      ProjectionExpression: "pk",
    })
  );
  return (out.Items?.length ?? 0) > 0;
}

async function copyTable(
  sourceDoc: DynamoDBDocumentClient,
  destDoc: DynamoDBDocumentClient,
  source: string,
  dest: string
): Promise<number> {
  let total = 0;
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await sourceDoc.send(
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
        const res = await destDoc.send(
          new BatchWriteCommand({ RequestItems: requestItems })
        );
        const unprocessed = res.UnprocessedItems?.[dest];
        if (!unprocessed?.length) break;
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
  const sourcePrefix =
    arg("--source-prefix")?.trim() ||
    process.env.DYNAMO_PULL_SOURCE_PREFIX?.trim() ||
    "mm-dev";
  const localPrefix =
    arg("--local-prefix")?.trim() ||
    process.env.DYNAMO_PULL_LOCAL_PREFIX?.trim() ||
    process.env.DYNAMO_TABLE_PREFIX?.trim() ||
    "mm";
  const endpoint =
    arg("--endpoint")?.trim() ||
    process.env.DYNAMODB_ENDPOINT?.trim() ||
    "";
  const force = hasFlag("--force");
  const reg = region();

  if (!endpoint) {
    console.error(
      "DYNAMODB_ENDPOINT is not set (e.g. http://localhost:8000).\n" +
        "Add it to .env.local and start DynamoDB Local (docker compose up -d dynamodb-local)."
    );
    process.exit(1);
  }

  if (sourcePrefix === localPrefix) {
    console.error(
      "Source and local prefix must differ (avoid copying AWS onto itself)."
    );
    process.exit(1);
  }

  console.log(`AWS source prefix:  ${sourcePrefix}  (region ${reg})`);
  console.log(`Local dest prefix:  ${localPrefix}`);
  console.log(`Local endpoint:     ${endpoint}\n`);

  const saved = stripDummyAwsEnvForSource();
  if (Object.keys(saved).length > 0) {
    console.log(
      "Using default AWS credential chain for source (ignored dummy local keys in .env.local).\n" +
        `Set AWS_PROFILE if you need a non-default profile (current: ${process.env.AWS_PROFILE || "default"}).\n`
    );
  }

  const sourceRaw = new DynamoDBClient({ region: reg });
  const sourceDoc = DynamoDBDocumentClient.from(sourceRaw, {
    marshallOptions,
  });

  const localRaw = new DynamoDBClient({
    region: reg,
    endpoint,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    },
  });
  const localDoc = DynamoDBDocumentClient.from(localRaw, { marshallOptions });

  try {
    await assertAwsSourceTablesExist(sourcePrefix, sourceRaw, reg);
    console.log("Ensuring local tables exist...\n");
    await ensureLocalTablesExist(localPrefix, localRaw);

    for (const suffix of DYNAMO_TABLE_SUFFIXES) {
      const src = dynamoTableName(sourcePrefix, suffix);
      const dst = dynamoTableName(localPrefix, suffix);

      if (await tableHasAnyItem(localDoc, dst)) {
        if (!force) {
          console.error(
            `\nLocal table ${dst} is not empty. Re-run with --force to upsert over existing keys, or delete the table in DynamoDB Local first.`
          );
          process.exit(1);
        }
        console.warn(
          `\n⚠ ${dst} has data; --force set — copying from ${src} (Put overwrites same keys).`
        );
      }

      console.log(`\nCopying ${src} (AWS) → ${dst} (local) ...`);
      const n = await copyTable(sourceDoc, localDoc, src, dst);
      console.log(`  ${n} items`);
    }

    console.log(
      `\n✅ Done. Ensure DYNAMO_TABLE_PREFIX=${localPrefix} and DYNAMODB_ENDPOINT=${endpoint} in .env.local for npm run dev.`
    );
  } finally {
    restoreEnv(saved);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
