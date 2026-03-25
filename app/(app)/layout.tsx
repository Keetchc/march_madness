import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SiteNavbar } from "@/components/layout/SiteNavbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(getAuthOptions());
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-hardwood-900 flex flex-col">
      <SiteNavbar />
      <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8 max-w-[min(100%,2000px)] leading-relaxed">
        {children}
      </main>
    </div>
  );
}

