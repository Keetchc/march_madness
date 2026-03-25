import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { notFound, redirect } from "next/navigation";
import { BracketPageClient } from "./BracketPageClient";
import { defaultTournamentId } from "@/lib/viewing-tournament";

export default async function BracketPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  const bracket = await getBracket(params.id);
  if (!bracket) notFound();

  const userId = (session.user as any).userId as string;
  const isAdmin = (session.user as any).isAdmin as boolean;

  if (bracket.userId !== userId && !isAdmin) {
    redirect("/dashboard");
  }

  return (
    <BracketPageClient
      bracketId={bracket.bracketId}
      userId={userId}
      bracketUserId={bracket.userId}
      bracketName={bracket.name}
      initialPicks={bracket.picks}
      bracketTournamentId={bracket.tournamentId ?? defaultTournamentId()}
    />
  );
}
