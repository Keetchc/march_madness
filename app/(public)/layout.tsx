import { PublicNavbar } from "@/components/layout/PublicNavbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-hardwood-900 flex flex-col">
      <PublicNavbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-[2000px]">
        {children}
      </main>
    </div>
  );
}
