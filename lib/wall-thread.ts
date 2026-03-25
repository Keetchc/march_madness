import type { GroupWallPost } from "./types";

/**
 * Max depth of the **parent** (0 = top-level). New reply depth = parentDepth + 1.
 * Must stay in sync with validation in `addGroupWallPost`.
 */
export const WALL_MAX_THREAD_DEPTH = 8;

export type WallThreadChainItem = { post: GroupWallPost; depth: number };

export type WallThread = {
  root: GroupWallPost;
  /** Root first at depth 0, then replies in tree order (oldest sibling first). */
  chain: WallThreadChainItem[];
};

function latestActivityMs(rootId: string, all: GroupWallPost[]): number {
  let max = 0;
  for (const p of all) {
    const inThread = p.postId === rootId || p.rootPostId === rootId;
    if (inThread) max = Math.max(max, +new Date(p.createdAt));
  }
  return max;
}

/** Group flat posts into threads, roots sorted by most recent activity in the thread. */
export function buildWallThreads(posts: GroupWallPost[]): WallThread[] {
  const childrenOf = new Map<string | null, GroupWallPost[]>();
  for (const p of posts) {
    const key = p.parentPostId ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(p);
  }
  Array.from(childrenOf.values()).forEach((arr) => {
    arr.sort((a: GroupWallPost, b: GroupWallPost) => a.createdAt.localeCompare(b.createdAt));
  });

  const roots = [...(childrenOf.get(null) ?? [])];
  roots.sort((a, b) => latestActivityMs(b.postId, posts) - latestActivityMs(a.postId, posts));

  function flatUnder(parentId: string, depth: number): WallThreadChainItem[] {
    const out: WallThreadChainItem[] = [];
    for (const k of childrenOf.get(parentId) ?? []) {
      out.push({ post: k, depth });
      out.push(...flatUnder(k.postId, depth + 1));
    }
    return out;
  }

  return roots.map((root) => ({
    root,
    chain: [{ post: root, depth: 0 }, ...flatUnder(root.postId, 1)],
  }));
}
