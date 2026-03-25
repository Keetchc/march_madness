"use client";

import { useMemo, useState } from "react";
import type { GroupWallPost } from "@/lib/types";
import { buildWallThreads, WALL_MAX_THREAD_DEPTH, type WallThread } from "@/lib/wall-thread";
import { clsx } from "clsx";
import { MessageCircleIcon, SendIcon, CornerDownRightIcon, ChevronRightIcon, ChevronUpIcon } from "lucide-react";

type Props = {
  groupId: string;
  initialPosts: GroupWallPost[];
  canPost: boolean;
};

function formatWallTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GroupWall({ groupId, initialPosts, canPost }: Props) {
  const [posts, setPosts] = useState<GroupWallPost[]>(initialPosts);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [err, setErr] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  /** Root post ids whose reply chains are expanded (default collapsed when there are replies). */
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  const threads = useMemo(() => buildWallThreads(posts), [posts]);

  async function refresh() {
    const res = await fetch(`/api/groups/${groupId}/wall`);
    if (!res.ok) return;
    const data = (await res.json()) as { posts?: GroupWallPost[] };
    if (Array.isArray(data.posts)) setPosts(data.posts);
  }

  async function sendTopLevel() {
    const t = body.trim();
    if (!t || sending) return;
    setSending(true);
    setErr("");
    try {
      const res = await fetch(`/api/groups/${groupId}/wall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Could not post.");
        return;
      }
      setBody("");
      await refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setSending(false);
    }
  }

  async function sendReply(parentPostId: string) {
    const t = replyDraft.trim();
    if (!t || sendingReply) return;
    setSendingReply(true);
    setErr("");
    try {
      const res = await fetch(`/api/groups/${groupId}/wall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t, parentPostId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Could not reply.");
        return;
      }
      setReplyDraft("");
      setReplyingTo(null);
      await refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setSendingReply(false);
    }
  }

  function startReply(postId: string) {
    setReplyingTo(postId);
    setReplyDraft("");
    setErr("");
  }

  function openThread(rootId: string) {
    setExpandedThreads((prev) => ({ ...prev, [rootId]: true }));
  }

  function collapseThread(thread: WallThread) {
    const rootId = thread.root.postId;
    setExpandedThreads((prev) => ({ ...prev, [rootId]: false }));
    const nested = thread.chain.some((c) => c.post.postId === replyingTo && c.depth > 0);
    if (nested) {
      setReplyingTo(null);
      setReplyDraft("");
    }
  }

  return (
    <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircleIcon className="w-4 h-4 text-court-500" />
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white">Group wall</h2>
      </div>
      <p className="text-xs text-ink-300 font-body mb-4">
        Threads with replies stay <span className="text-ink-200">collapsed</span> until you open them—keeps the wall
        scannable. You can still reply to the first message from the preview.
      </p>

      <div className="space-y-4 max-h-[28rem] overflow-y-auto mb-4 pr-1">
        {threads.length === 0 ? (
          <p className="text-sm text-ink-400 font-body">No messages yet. Be the first!</p>
        ) : (
          threads.map((thread) => {
            const rootId = thread.root.postId;
            const replyCount = thread.chain.length - 1;
            const isExpanded = expandedThreads[rootId] === true;
            const showAll = replyCount === 0 || isExpanded;
            const chainSlice = showAll ? thread.chain : thread.chain.slice(0, 1);

            return (
              <div
                key={rootId}
                className="rounded-xl bg-hardwood-900/50 border border-hardwood-600/90 overflow-hidden"
              >
                {replyCount > 0 && isExpanded ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-hardwood-600/80 bg-hardwood-900/70">
                    <span className="text-[10px] font-mono text-ink-500 uppercase tracking-wide">
                      {replyCount} {replyCount === 1 ? "reply" : "replies"}
                    </span>
                    <button
                      type="button"
                      onClick={() => collapseThread(thread)}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-400 hover:text-ink-200"
                    >
                      <ChevronUpIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      Collapse thread
                    </button>
                  </div>
                ) : null}

                {chainSlice.map(({ post, depth }, idx) => (
                  <div key={post.postId}>
                    <div
                      className={clsx(
                        "border-b border-hardwood-700/80 px-3 py-2.5",
                        depth > 0 && "bg-hardwood-900/30",
                        idx === chainSlice.length - 1 && "border-b-0",
                      )}
                      style={{ paddingLeft: `${0.75 + Math.min(depth, 10) * 0.75}rem` }}
                    >
                      {depth > 0 ? (
                        <div className="flex items-center gap-1 text-ink-500 mb-1">
                          <CornerDownRightIcon className="w-3 h-3 shrink-0" />
                          <span className="text-[10px] font-mono uppercase tracking-wide">Reply</span>
                        </div>
                      ) : null}
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="font-display text-xs font-bold text-court-400 uppercase tracking-wide truncate">
                          {post.userName}
                        </span>
                        <time className="text-[10px] text-ink-400 font-mono shrink-0" dateTime={post.createdAt}>
                          {formatWallTime(post.createdAt)}
                        </time>
                      </div>
                      <p className="text-sm text-ink-50 font-body whitespace-pre-wrap break-words">{post.body}</p>

                      {canPost && depth < WALL_MAX_THREAD_DEPTH ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {replyingTo === post.postId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyDraft("");
                              }}
                              className="text-[10px] font-mono text-ink-400 hover:text-ink-200"
                            >
                              Cancel
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startReply(post.postId)}
                              className="text-[10px] font-mono font-semibold text-court-400 hover:text-court-300"
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      ) : null}

                      {replyingTo === post.postId && canPost ? (
                        <div className="mt-2 space-y-2 border-l-2 border-court-600/40 pl-3 ml-0.5">
                          <textarea
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            placeholder="Write a reply…"
                            rows={2}
                            maxLength={500}
                            className="w-full bg-hardwood-800 border border-hardwood-500 focus:border-court-500 rounded-lg px-2.5 py-2 text-sm text-white font-body outline-none resize-y min-h-[3.5rem]"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-ink-400 font-mono">{replyDraft.length}/500</span>
                            <button
                              type="button"
                              onClick={() => sendReply(post.postId)}
                              disabled={sendingReply || !replyDraft.trim()}
                              className="inline-flex items-center gap-1.5 bg-court-500 hover:bg-court-600 disabled:opacity-40 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <SendIcon className="w-3 h-3" />
                              {sendingReply ? "Sending…" : "Send reply"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {replyCount > 0 && !isExpanded ? (
                  <div className="px-3 py-2 border-t border-hardwood-700/60 bg-hardwood-900/40">
                    <button
                      type="button"
                      onClick={() => openThread(rootId)}
                      className="w-full text-left inline-flex items-center gap-2 text-xs font-mono text-court-400 hover:text-court-300 py-1"
                    >
                      <ChevronRightIcon className="w-4 h-4 shrink-0 text-court-500" aria-hidden />
                      <span>
                        {replyCount} {replyCount === 1 ? "reply" : "replies"}
                        <span className="text-ink-400"> — show thread</span>
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {canPost ? (
        <div className="space-y-2 border-t border-hardwood-600 pt-4">
          <p className="text-[10px] font-mono text-ink-400 uppercase tracking-wide">New thread</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start a new topic for the pool…"
            rows={2}
            maxLength={500}
            className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-3 py-2 text-sm text-white font-body outline-none resize-y min-h-[4rem]"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-ink-400 font-mono">{body.length}/500</span>
            <button
              type="button"
              onClick={sendTopLevel}
              disabled={sending || !body.trim()}
              className={clsx(
                "inline-flex items-center gap-1.5 bg-court-500 hover:bg-court-600 disabled:opacity-40 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors",
              )}
            >
              <SendIcon className="w-3.5 h-3.5" />
              {sending ? "Posting…" : "Post"}
            </button>
          </div>
          {err ? <p className="text-red-400 text-xs font-mono">{err}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-ink-400 font-mono">Join this group to post on the wall.</p>
      )}
    </div>
  );
}
