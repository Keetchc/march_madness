import type { Group } from "./types";

/** Primary creator or listed co-admin. */
export function isGroupAdmin(group: Group, userId: string): boolean {
  const u = String(userId ?? "").trim();
  if (!u) return false;
  if (String(group.adminUserId) === u) return true;
  return (group.coAdminUserIds ?? []).some((id) => String(id) === u);
}
