import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getUserId } from "@/lib/session";
import { getGroup, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { isGroupAdmin } from "@/lib/group-permissions";
import type { Group } from "@/lib/types";
import {
  listGroupWallPosts,
  addGroupWallPost,
  GroupWallPostError,
} from "@/lib/dynamo/queries/group-wall";
import { resolveUserDisplayProfile } from "@/lib/dynamo/queries/users";

export const dynamic = "force-dynamic";

const MAX_LEN = 500;

async function canAccessGroupWall(group: Group, userId: string, isAppAdmin: boolean): Promise<boolean> {
  if (isAppAdmin) return true;
  if (isGroupAdmin(group, userId)) return true;
  const m = await getGroupMembership(group.groupId, userId);
  return Boolean(m);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  const userId = session?.user ? getUserId(session) : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAppAdmin = Boolean((session?.user as { isAdmin?: boolean })?.isAdmin);
  if (!(await canAccessGroupWall(group, userId, isAppAdmin))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const posts = await listGroupWallPosts(params.id);
  return NextResponse.json({ posts });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  const userId = session?.user ? getUserId(session) : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAppAdmin = Boolean((session?.user as { isAdmin?: boolean })?.isAdmin);
  if (!(await canAccessGroupWall(group, userId, isAppAdmin))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let bodyText = "";
  let parentPostId: string | undefined;
  try {
    const json = (await req.json()) as { body?: unknown; parentPostId?: unknown };
    bodyText = typeof json.body === "string" ? json.body.trim() : "";
    if (typeof json.parentPostId === "string" && json.parentPostId.trim()) {
      parentPostId = json.parentPostId.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!bodyText) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  }
  if (bodyText.length > MAX_LEN) {
    return NextResponse.json({ error: `Keep it under ${MAX_LEN} characters.` }, { status: 400 });
  }

  const profile = await resolveUserDisplayProfile(userId);
  try {
    const post = await addGroupWallPost({
      groupId: params.id,
      userId,
      userName: profile.name,
      body: bodyText,
      parentPostId: parentPostId ?? null,
    });
    return NextResponse.json({ post });
  } catch (e) {
    if (e instanceof GroupWallPostError) {
      if (e.code === "PARENT_NOT_FOUND") {
        return NextResponse.json({ error: "That message is gone or invalid." }, { status: 400 });
      }
      if (e.code === "THREAD_TOO_DEEP") {
        return NextResponse.json(
          { error: "This thread is too deep to add another reply." },
          { status: 400 },
        );
      }
    }
    throw e;
  }
}
