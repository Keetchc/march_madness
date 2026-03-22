/**
 * Run once to create all DynamoDB tables (local or prod).
 * Usage: npm run setup
 */
import {
  CreateTableCommand,
  ListTablesCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import { rawClient } from "../lib/dynamo/client";

const tables = [
  // ── Users ──────────────────────────────────────────────────────────────────
  {
    TableName: "mm-users",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
  },

  // ── Tournament + Games + Teams ────────────────────────────────────────────
  {
    TableName: "mm-tournament",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
  },

  // ── Brackets ──────────────────────────────────────────────────────────────
  {
    TableName: "mm-brackets",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk",            AttributeType: "S" },
      { AttributeName: "sk",            AttributeType: "S" },
      { AttributeName: "userId",        AttributeType: "S" },
      { AttributeName: "tournamentId",  AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "tournamentId-index",
        KeySchema: [{ AttributeName: "tournamentId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },

  // ── Groups + Members ──────────────────────────────────────────────────────
  {
    TableName: "mm-groups",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk",            AttributeType: "S" },
      { AttributeName: "sk",            AttributeType: "S" },
      { AttributeName: "inviteToken",   AttributeType: "S" },
      { AttributeName: "userId",        AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "inviteToken-index",
        KeySchema: [{ AttributeName: "inviteToken", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },

  // ── NextAuth sessions/accounts (required by DynamoDB adapter) ─────────────
  {
    TableName: "mm-next-auth",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk",  AttributeType: "S" },
      { AttributeName: "sk",  AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
];

async function main() {
  console.log("🏀 Setting up DynamoDB tables...\n");

  const existing = await rawClient.send(new ListTablesCommand({}));
  const existingNames = new Set(existing.TableNames ?? []);

  for (const table of tables) {
    if (existingNames.has(table.TableName)) {
      console.log(`  ✓ ${table.TableName} (already exists)`);
      continue;
    }
    try {
      await rawClient.send(new CreateTableCommand(table as any));
      console.log(`  ✅ Created: ${table.TableName}`);
    } catch (err) {
      if (err instanceof ResourceInUseException) {
        console.log(`  ✓ ${table.TableName} (already exists)`);
      } else {
        console.error(`  ❌ Failed: ${table.TableName}`, err);
        throw err;
      }
    }
  }

  console.log("\n✅ All tables ready. Run `npm run seed` to import tournament data.");
}

main().catch(console.error);

