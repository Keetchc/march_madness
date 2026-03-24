import { redirect } from "next/navigation";

/** Bracket lists live under each group: `/groups/[id]/brackets`. */
export default function BracketsRedirectPage() {
  redirect("/groups");
}
