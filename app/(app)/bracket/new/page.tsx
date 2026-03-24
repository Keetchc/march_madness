import { NewBracketForm } from "./NewBracketForm";

export const dynamic = "force-dynamic";

export default function NewBracketPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  const raw = searchParams.returnTo?.trim() ?? "";
  const returnTo = raw.startsWith("/groups/") ? raw : "";
  return <NewBracketForm returnTo={returnTo} />;
}
