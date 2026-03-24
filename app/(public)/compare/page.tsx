import { redirect } from "next/navigation";

/** Compare is available per group: `/groups/[id]/compare`. */
export default function CompareRedirectPage() {
  redirect("/groups");
}
