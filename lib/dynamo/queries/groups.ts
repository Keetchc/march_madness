import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { Group, GroupMember } from "../../types";

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function getGroup(groupId: string): Promise<Group | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: "META" },
    })
  );
  return res.Item ? (res.Item as Group) : null;
}

export async function getGroupByInviteToken(token: string): Promise<Group | null> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.GROUPS,
      IndexName: "inviteToken-index",
      KeyConditionExpression: "inviteToken = :t",
      ExpressionAttributeValues: { ":t": token },
    })
  );
  return res.Items?.[0] ? (res.Items[0] as Group) : null;
}

export async function createGroup(group: Group): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.GROUPS,
      Item: {
        pk: `GROUP#${group.groupId}`,
        sk: "META",
        ...group,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );
}

export async function updateGroupScoringRules(
  groupId: string,
  scoringRules: Group["scoringRules"]
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: "META" },
      UpdateExpression: "SET scoringRules = :r",
      ExpressionAttributeValues: { ":r": scoringRules },
    })
  );
}

export async function regenerateInviteToken(
  groupId: string,
  newToken: string
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: "META" },
      UpdateExpression: "SET inviteToken = :t",
      ExpressionAttributeValues: { ":t": newToken },
    })
  );
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.GROUPS,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `GROUP#${groupId}`,
        ":prefix": "MEMBER#",
      },
    })
  );
  return (res.Items ?? []) as GroupMember[];
}

export async function getGroupMembership(
  groupId: string,
  userId: string
): Promise<GroupMember | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: `MEMBER#${userId}` },
    })
  );
  return res.Item ? (res.Item as GroupMember) : null;
}

export async function addMember(member: GroupMember): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.GROUPS,
      Item: {
        pk: `GROUP#${member.groupId}`,
        sk: `MEMBER#${member.userId}`,
        ...member,
      },
    })
  );
}

export async function updateMemberScore(
  groupId: string,
  userId: string,
  score: number,
  rank: number
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: `MEMBER#${userId}` },
      UpdateExpression: "SET currentScore = :s, #r = :r",
      ExpressionAttributeNames: { "#r": "rank" },
      ExpressionAttributeValues: { ":s": score, ":r": rank },
    })
  );
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  await dynamo.send(
    new DeleteCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: `MEMBER#${userId}` },
    })
  );
}

function isMissingIndexError(err: unknown): boolean {
  const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
  return name === "ValidationException" || name === "ResourceNotFoundException";
}

/** Member rows: `userId` + sk MEMBER#… — listed via userId-index when present. */
async function collectGroupIdsFromMemberUserId(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let startKey: Record<string, unknown> | undefined;
  try {
    do {
      const res = await dynamo.send(
        new QueryCommand({
          TableName: TABLES.GROUPS,
          IndexName: "userId-index",
          KeyConditionExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": userId },
          ProjectionExpression: "groupId",
          ExclusiveStartKey: startKey,
        })
      );
      for (const item of res.Items ?? []) {
        const gid = item.groupId as string;
        if (gid) ids.add(gid);
      }
      startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (startKey);
    return ids;
  } catch (e) {
    if (!isMissingIndexError(e)) throw e;
  }

  // Table without userId-index (or query unsupported): full scan — OK for small pools.
  startKey = undefined;
  do {
    const res = await dynamo.send(
      new ScanCommand({
        TableName: TABLES.GROUPS,
        FilterExpression: "userId = :uid AND begins_with(sk, :mp)",
        ExpressionAttributeValues: { ":uid": userId, ":mp": "MEMBER#" },
        ProjectionExpression: "groupId",
        ExclusiveStartKey: startKey,
      })
    );
    for (const item of res.Items ?? []) {
      const gid = item.groupId as string;
      if (gid) ids.add(gid);
    }
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return ids;
}

/** Group META rows where this user is admin (covers legacy creates with no MEMBER row). */
async function collectGroupIdsWhereAdmin(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await dynamo.send(
      new ScanCommand({
        TableName: TABLES.GROUPS,
        FilterExpression: "adminUserId = :uid AND sk = :meta",
        ExpressionAttributeValues: { ":uid": userId, ":meta": "META" },
        ProjectionExpression: "groupId",
        ExclusiveStartKey: startKey,
      })
    );
    for (const item of res.Items ?? []) {
      const gid = item.groupId as string;
      if (gid) ids.add(gid);
    }
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return ids;
}

// Groups the user is in (member row) OR admins (META row), merged and deduped.
export async function getGroupsByUser(userId: string): Promise<Group[]> {
  if (!userId) return [];

  const [memberIds, adminIds] = await Promise.all([
    collectGroupIdsFromMemberUserId(userId),
    collectGroupIdsWhereAdmin(userId),
  ]);

  const allIds = new Set<string>([...memberIds, ...adminIds]);
  const groups = await Promise.all([...allIds].map(getGroup));
  return groups.filter(Boolean) as Group[];
}

