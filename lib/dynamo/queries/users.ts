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

/** NextAuth DynamoDB adapter stores the account user at pk/sk both `USER#<id>`. */
async function getNextAuthAdapterUserRow(userId: string): Promise<Record<string, unknown> | null> {
  const id = String(userId).trim();
  if (!id) return null;
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.NEXTAUTH,
      Key: { pk: `USER#${id}`, sk: `USER#${id}` },
    })
  );
  const item = res.Item as Record<string, unknown> | undefined;
  if (!item || item.type !== "USER") return null;
  return item;
}

/**
 * Name/picture for UI (standings, pick lists): uses `{prefix}-users` PROFILE first,
 * then falls back to `{prefix}-next-auth` (where Google sign-in always writes).
 * Optionally backfills PROFILE so future getUser calls succeed.
 */
export async function resolveUserDisplayProfile(userId: string): Promise<{ name: string; picture: string }> {
  const id = String(userId).trim();
  if (!id) return { name: "Unknown", picture: "" };

  const app = await getUser(id);
  const na = await getNextAuthAdapterUserRow(id);

  const naName = typeof na?.name === "string" ? na.name.trim() : "";
  const naImage = typeof na?.image === "string" ? na.image : "";
  const naEmail = typeof na?.email === "string" ? na.email.trim() : "";

  let name = typeof app?.name === "string" ? app.name.trim() : "";
  let picture = typeof app?.picture === "string" ? app.picture : "";

  if (!name) {
    name = naName || (naEmail ? naEmail.split("@")[0] ?? "" : "") || "";
  }
  if (!picture && naImage) picture = naImage;

  const displayName = name || "Unknown";

  if (na && (!app || !app.name?.trim())) {
    try {
      await upsertUser({
        userId: id,
        name: naName || displayName,
        email: naEmail || app?.email || "",
        picture: picture || naImage,
        isAdmin: app?.isAdmin ?? false,
        createdAt: app?.createdAt ?? new Date().toISOString(),
      });
    } catch {
      // non-fatal: display still works from NextAuth row
    }
  }

  return { name: displayName, picture };
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
