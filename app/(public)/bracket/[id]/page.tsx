import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getUser } from "@/lib/dynamo/queries/users";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BracketPageClient } from "@/app/(app)/bracket/[id]/BracketPageClient";

export default async function PublicBracketPage({ params }: { params: { id: string } }) {
  const bracket = await getBracket(params.id);
  if (!bracket) notFound();

  const session = await getServerSession(authOptions);
  const sessionUserId =
    session?.user != null ? ((session.user as { userId?: string }).userId ?? "") : "";

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
