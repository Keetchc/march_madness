import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getUser } from "@/lib/dynamo/queries/users";
import { notFound } from "next/navigation";
import { BracketPageClient } from "@/app/(app)/bracket/[id]/BracketPageClient";

export default async function PublicBracketPage({ params }: { params: { id: string } }) {
  const bracket = await getBracket(params.id);
  if (!bracket) notFound();

  const user = await getUser(bracket.userId);
  const displayName = user?.name
    ? `${user.name}'s Bracket`
    : bracket.name;

  return (
    <BracketPageClient
      bracketId={bracket.bracketId}
      userId=""
      bracketUserId={bracket.userId}
      bracketName={displayName}
      initialPicks={bracket.picks}
    />
  );
}
