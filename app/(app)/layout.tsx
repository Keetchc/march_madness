import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-hardwood-900 flex flex-col">
      <Navbar user={session.user as any} />
      <main className="flex-1 container mx-auto px-2 sm:px-3 md:px-4 py-8 max-w-[min(100%,2000px)]">
        {children}
      </main>
    </div>
  );
}

