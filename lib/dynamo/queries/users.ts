import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { AppUser } from "../../types";

export async function getUser(userId: string): Promise<AppUser | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.USERS,
      Key: { pk: `USER#${userId}`, sk: "PROFILE" },
    })
  );
  return res.Item ? (res.Item as AppUser) : null;
}

export async function upsertUser(user: AppUser): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.USERS,
      Item: {
        pk: `USER#${user.userId}`,
        sk: "PROFILE",
        ...user,
      },
    })
  );
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { pk: `USER#${userId}`, sk: "PROFILE" },
      UpdateExpression: "SET isAdmin = :v",
      ExpressionAttributeValues: { ":v": isAdmin },
    })
  );
}

