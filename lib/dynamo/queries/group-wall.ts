import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { GroupWallPost } from "../../types";
import { WALL_MAX_THREAD_DEPTH } from "../../wall-thread";

const WALL_SK_PREFIX = "WALL#";

export { WALL_MAX_THREAD_DEPTH } from "../../wall-thread";

export class GroupWallPostError extends Error {
  constructor(
    public readonly code: "PARENT_NOT_FOUND" | "THREAD_TOO_DEEP",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "GroupWallPostError";
  }
}

function itemToPost(p: Record<string, unknown>): GroupWallPost | null {
  const postId = p.postId as string | undefined;
  const gid = p.groupId as string | undefined;
  const userId = p.userId as string | undefined;
  const userName = p.userName as string | undefined;
  const body = p.body as string | undefined;
  const createdAt = p.createdAt as string | undefined;
  if (!postId || !gid || !userId || !userName || body == null || !createdAt) return null;
  const parentPostId = p.parentPostId as string | undefined;
  const rootPostId = p.rootPostId as string | undefined;
  return {
    postId,
    groupId: gid,
    userId,
    userName,
    body,
    createdAt,
    ...(parentPostId ? { parentPostId } : {}),
    ...(rootPostId ? { rootPostId } : {}),
  };
}

export async function listGroupWallPosts(groupId: string, limit = 150): Promise<GroupWallPost[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.GROUPS,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :pfx)",
      ExpressionAttributeValues: {
        ":pk": `GROUP#${groupId}`,
        ":pfx": WALL_SK_PREFIX,
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  const out: GroupWallPost[] = [];
  for (const item of res.Items ?? []) {
    const post = itemToPost(item as Record<string, unknown>);
    if (post) out.push(post);
  }
  return out;
}

/** Distance from thread root: root = 0, its direct reply = 1, … */
function depthOf(byId: Map<string, GroupWallPost>, post: GroupWallPost): number {
  let d = 0;
  let cur: GroupWallPost | undefined = post;
  while (cur?.parentPostId) {
    d++;
    cur = byId.get(cur.parentPostId);
  }
  return d;
}

export async function addGroupWallPost(input: {
  groupId: string;
  userId: string;
  userName: string;
  body: string;
  parentPostId?: string | null;
}): Promise<GroupWallPost> {
  const all = await listGroupWallPosts(input.groupId, 250);
  const byId = new Map(all.map((p) => [p.postId, p]));

  const trimmedParent = typeof input.parentPostId === "string" ? input.parentPostId.trim() : "";
  const postId = crypto.randomUUID();

  let rootPostId: string;
  let parentPostId: string | undefined;

  if (trimmedParent) {
    const parent = byId.get(trimmedParent);
    if (!parent) throw new GroupWallPostError("PARENT_NOT_FOUND");
    rootPostId = parent.rootPostId ?? parent.postId;
    parentPostId = parent.postId;
    const parentDepth = depthOf(byId, parent);
    if (parentDepth >= WALL_MAX_THREAD_DEPTH) {
      throw new GroupWallPostError("THREAD_TOO_DEEP");
    }
  } else {
    rootPostId = postId;
  }

  const createdAt = new Date().toISOString();
  const sk = `${WALL_SK_PREFIX}${createdAt}#${postId}`;
  const post: GroupWallPost = {
    postId,
    groupId: input.groupId,
    userId: input.userId,
    userName: input.userName,
    body: input.body,
    createdAt,
    rootPostId,
    ...(parentPostId ? { parentPostId } : {}),
  };

  await dynamo.send(
    new PutCommand({
      TableName: TABLES.GROUPS,
      Item: {
        pk: `GROUP#${input.groupId}`,
        sk,
        ...post,
      },
    }),
  );
  return post;
}
