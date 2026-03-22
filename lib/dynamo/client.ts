import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

// In local dev, DYNAMODB_ENDPOINT points to DynamoDB Local container.
// In production on AWS, this env var is unset and the SDK uses real AWS.
const isLocal = !!process.env.DYNAMODB_ENDPOINT;

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
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

