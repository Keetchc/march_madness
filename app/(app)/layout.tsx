import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-hardwood-900 flex flex-col">
      <Navbar user={session.user as any} />
      <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8 max-w-[min(100%,2000px)]">
        {children}
      </main>
    </div>
  );
}

