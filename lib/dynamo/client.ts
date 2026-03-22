import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

// MM_* env vars are used in Amplify (which reserves AWS_* prefixes).
// Falls back to AWS_* for local dev / standard AWS environments.
const region =
  process.env.MM_REGION ?? process.env.AWS_REGION ?? "us-east-1";
const accessKeyId =
  process.env.MM_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.MM_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const hasExplicitCreds = !!(accessKeyId && secretAccessKey);

const rawClient = new DynamoDBClient({
  region,
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
  }),
  ...(hasExplicitCreds && {
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  }),
});

const marshallOptions = {
  removeUndefinedValues: true,
  convertClassInstanceToMap: true,
};

// DynamoDBDocumentClient handles marshalling/unmarshalling JS <-> DynamoDB types
export const dynamo = DynamoDBDocumentClient.from(rawClient, { marshallOptions });

// DynamoDBDocument provides convenience methods (.query, .put, .get, etc.)
// required by @next-auth/dynamodb-adapter
export const docClient = DynamoDBDocument.from(rawClient, { marshallOptions });

export { rawClient };

