import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import "./globals.css";
import { Providers } from "./providers";
import { getAuthOptions } from "@/lib/auth";
import { hydrateAuthEnvFromDisk } from "@/lib/hydrate-auth-env";
import { serverEnv } from "@/lib/server-env";

hydrateAuthEnvFromDisk();

function getMetadataBase(): URL {
  const raw = serverEnv("NEXT_PUBLIC_SITE_URL") ?? serverEnv("NEXTAUTH_URL");
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      /* ignore */
    }
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}

const metadataBase = getMetadataBase();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Brian's Group March Madness",
    template: "%s | Brian's Group",
  },
  description:
    "Track brackets, leaderboard standings, compare picks, and follow March Madness with Brian's Group.",
  openGraph: {
    title: "Brian's Group March Madness",
    description:
      "Brackets, leaderboard, compare picks — your March Madness pool hub.",
    url: "/",
    siteName: "Brian's Group March Madness",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Brian's Group March Madness",
    description:
      "Brackets, leaderboard, compare picks — your March Madness pool hub.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(getAuthOptions());

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-hardwood-900 text-white font-body antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}

