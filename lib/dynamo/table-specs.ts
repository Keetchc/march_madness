import type { CreateTableCommandInput } from "@aws-sdk/client-dynamodb";

/** Logical table keys (suffix after `{prefix}-`). */
export const DYNAMO_TABLE_SUFFIXES = [
  "users",
  "tournament",
  "brackets",
  "groups",
  "next-auth",
] as const;

export type DynamoTableSuffix = (typeof DYNAMO_TABLE_SUFFIXES)[number];

export function dynamoTableName(prefix: string, suffix: DynamoTableSuffix): string {
  const p = prefix.replace(/-+$/, "").trim() || "mm";
  return `${p}-${suffix}`;
}

/**
 * CreateTable inputs for all app tables. Single source for `npm run setup` and clone scripts.
 */
export function getTableCreateInputs(prefix: string): CreateTableCommandInput[] {
  const t = (suffix: DynamoTableSuffix) => dynamoTableName(prefix, suffix);

  return [
    {
      TableName: t("users"),
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
    },
    {
      TableName: t("tournament"),
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
    },
    {
      TableName: t("brackets"),
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" },
        { AttributeName: "tournamentId", AttributeType: "S" },
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
    {
      TableName: t("groups"),
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "inviteToken", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" },
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
    {
      TableName: t("next-auth"),
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
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
}
