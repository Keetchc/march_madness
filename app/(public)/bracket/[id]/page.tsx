import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getUser } from "@/lib/dynamo/queries/users";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getUserId } from "@/lib/session";
import { BracketPageClient } from "@/app/(app)/bracket/[id]/BracketPageClient";

export const dynamic = "force-dynamic";

export default async function PublicBracketPage({ params }: { params: { id: string } }) {
  const bracket = await getBracket(params.id);
  if (!bracket) notFound();

  const session = await getServerSession(getAuthOptions());
  const sessionUserId = session?.user ? (getUserId(session) ?? "") : "";

  const user = await getUser(bracket.userId);
  const displayName = user?.name
    ? `${user.name}'s Bracket`
    : bracket.name;

  return (
    <BracketPageClient
      bracketId={bracket.bracketId}
      userId={sessionUserId}
      bracketUserId={bracket.userId}
      bracketName={displayName}
      initialPicks={bracket.picks}
    />
  );
}
