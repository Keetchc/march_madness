/**
 * Copy all items from DynamoDB Local into AWS dev tables (e.g. mm-dev-*).
 *
 * Loads `.env.local` for DYNAMODB_ENDPOINT, DYNAMO_TABLE_PREFIX (local source), and region.
 * Strips dummy `local` AWS keys from env before talking to AWS (same pattern as pull-dev-to-local).
 *
 * Usage:
 *   npm run push-local-to-dev -- --force
 *   npx ts-node --project tsconfig.scripts.json scripts/push-local-to-dev.ts --force
 *
 * Env (optional):
 *   DYNAMO_PUSH_LOCAL_PREFIX   (default DYNAMO_TABLE_PREFIX or mm) — DynamoDB Local source prefix
 *   DYNAMO_PUSH_DEST_PREFIX    (default mm-dev) — AWS destination prefix
 *   DYNAMODB_ENDPOINT          (required) e.g. http://localhost:8000
 *   AWS_REGION / MM_REGION     (default us-east-1)
 *   AWS_PROFILE                — non-default profile for AWS destination
 *
 * Flags:
 *   --force   Required if any destination AWS table already has items (overwrites same keys via Put).
 *   --local-prefix=mm --dest-prefix=mm-dev
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

/** Remove dummy keys so the AWS SDK uses the real credential chain for the destination. */
function stripDummyAwsEnvForAwsDestination(): SavedCreds {
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

async function assertAwsDestTablesExist(
  destPrefix: string,
  client: DynamoDBClient,
  reg: string
): Promise<void> {
  for (const suffix of DYNAMO_TABLE_SUFFIXES) {
    const name = dynamoTableName(destPrefix, suffix);
    try {
      await client.send(new DescribeTableCommand({ TableName: name }));
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err.name === "ResourceNotFoundException") {
        console.error(
          `Destination table "${name}" was not found in AWS region "${reg}".\n` +
            `Create dev tables first: npm run setup:dev-tables\n` +
            `Or fix DYNAMO_PUSH_DEST_PREFIX / --dest-prefix.`
        );
        process.exit(1);
      }
      throw e;
    }
  }
}

async function ensureAwsTablesExist(
  prefix: string,
  rawAws: DynamoDBClient
): Promise<void> {
  const tables = getTableCreateInputs(prefix);
  const existing = await rawAws.send(new ListTablesCommand({}));
  const existingNames = new Set(existing.TableNames ?? []);

  for (const table of tables) {
    const name = table.TableName!;
    if (existingNames.has(name)) {
      console.log(`  ✓ ${name} (exists)`);
      continue;
    }
    try {
      await rawAws.send(new CreateTableCommand(table));
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
  const localPrefix =
    arg("--local-prefix")?.trim() ||
    process.env.DYNAMO_PUSH_LOCAL_PREFIX?.trim() ||
    process.env.DYNAMO_TABLE_PREFIX?.trim() ||
    "mm";
  const destPrefix =
    arg("--dest-prefix")?.trim() ||
    process.env.DYNAMO_PUSH_DEST_PREFIX?.trim() ||
    "mm-dev";
  const endpoint =
    arg("--endpoint")?.trim() ||
    process.env.DYNAMODB_ENDPOINT?.trim() ||
    "";
  const force = hasFlag("--force");
  const createDest = hasFlag("--create-dest");
  const reg = region();

  if (!endpoint) {
    console.error(
      "DYNAMODB_ENDPOINT is not set (e.g. http://localhost:8000).\n" +
        "This script reads from DynamoDB Local only."
    );
    process.exit(1);
  }

  if (localPrefix === destPrefix) {
    console.error(
      "Local source and AWS destination prefix must differ (avoid copying onto itself)."
    );
    process.exit(1);
  }

  console.log(`Local source prefix:  ${localPrefix}  (endpoint ${endpoint})`);
  console.log(`AWS dest prefix:      ${destPrefix}  (region ${reg})\n`);

  const localRaw = new DynamoDBClient({
    region: reg,
    endpoint,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    },
  });
  const localDoc = DynamoDBDocumentClient.from(localRaw, { marshallOptions });

  const saved = stripDummyAwsEnvForAwsDestination();
  if (Object.keys(saved).length > 0) {
    console.log(
      "Using default AWS credential chain for destination (dummy local keys removed from env).\n" +
        `Set AWS_PROFILE if needed (current: ${process.env.AWS_PROFILE || "default"}).\n`
    );
  }

  const awsRaw = new DynamoDBClient({ region: reg });
  const awsDoc = DynamoDBDocumentClient.from(awsRaw, { marshallOptions });

  try {
    if (createDest) {
      console.log("Ensuring AWS destination tables exist...\n");
      await ensureAwsTablesExist(destPrefix, awsRaw);
      console.log("");
    } else {
      await assertAwsDestTablesExist(destPrefix, awsRaw, reg);
    }

    let destHasAnyData = false;
    for (const suffix of DYNAMO_TABLE_SUFFIXES) {
      const dst = dynamoTableName(destPrefix, suffix);
      if (await tableHasAnyItem(awsDoc, dst)) {
        destHasAnyData = true;
        break;
      }
    }
    if (destHasAnyData && !force) {
      console.error(
        "At least one AWS destination table already has items.\n" +
          "Re-run with --force to upsert from local (Put overwrites matching keys only).\n" +
          "Items that exist only in AWS are not deleted."
      );
      process.exit(1);
    }
    if (destHasAnyData && force) {
      console.warn(
        "\n⚠ --force: destination has existing data — local rows will overwrite same pk/sk keys.\n"
      );
    }

    for (const suffix of DYNAMO_TABLE_SUFFIXES) {
      const src = dynamoTableName(localPrefix, suffix);
      const dst = dynamoTableName(destPrefix, suffix);

      console.log(`\nCopying ${src} (local) → ${dst} (AWS) ...`);
      const n = await copyTable(localDoc, awsDoc, src, dst);
      console.log(`  ${n} items`);
    }

    console.log(
      `\n✅ Done. Deployed app using ${destPrefix}-* tables should see this data (same region: ${reg}).`
    );
  } finally {
    restoreEnv(saved);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
