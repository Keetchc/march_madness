#!/usr/bin/env bash
# ================================================================
# BracketBash — Bootstrap Script
# Run this from inside your cloned repo:
#   git clone https://github.com/keetchc/march_madness.git
#   cd march_madness
#   bash bootstrap.sh
# ================================================================
set -e
echo "🏀 Bootstrapping BracketBash..."

cat > '.env.local.example' << 'HEREDOC_END'
# ─── NextAuth ────────────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# ─── Google OAuth ─────────────────────────────────────────────────────────────
# Get from: https://console.cloud.google.com → APIs & Services → Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ─── AWS / DynamoDB ───────────────────────────────────────────────────────────
# For local development these are set in docker-compose.yml automatically.
# For production, use real AWS credentials or an IAM role.
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local

# Set this for local dev; leave empty for production (uses real AWS)
DYNAMODB_ENDPOINT=http://localhost:8000

# ─── App Config ───────────────────────────────────────────────────────────────
# Comma-separated Google email addresses of app admins
ADMIN_EMAILS=you@gmail.com

# Tournament lock date - picks close at this ISO timestamp
TOURNAMENT_LOCK_DATE=2026-03-19T12:00:00Z

# ESPN polling interval in ms (default 60s - only polls during active games)
ESPN_POLL_INTERVAL_MS=60000

HEREDOC_END

cat > 'Dockerfile' << 'HEREDOC_END'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]

HEREDOC_END

cat > 'Dockerfile.dev' << 'HEREDOC_END'
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

HEREDOC_END

cat > 'docker-compose.yml' << 'HEREDOC_END'
version: "3.9"

services:
  # ─── DynamoDB Local ───────────────────────────────────────────────────────
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    container_name: mm-dynamodb
    ports:
      - "8000:8000"
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath /data"
    volumes:
      - dynamodb-data:/data
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:8000 || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 10

  # ─── DynamoDB Admin UI (nice local GUI) ───────────────────────────────────
  dynamodb-admin:
    image: aaronshaf/dynamodb-admin:latest
    container_name: mm-dynamo-admin
    ports:
      - "8001:8001"
    environment:
      DYNAMO_ENDPOINT: http://dynamodb-local:8000
      AWS_REGION: us-east-1
      AWS_ACCESS_KEY_ID: local
      AWS_SECRET_ACCESS_KEY: local
    depends_on:
      dynamodb-local:
        condition: service_healthy

  # ─── Next.js App ──────────────────────────────────────────────────────────
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: mm-app
    ports:
      - "3000:3000"
    environment:
      - DYNAMODB_ENDPOINT=http://dynamodb-local:8000
      - AWS_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=local
      - AWS_SECRET_ACCESS_KEY=local
    env_file:
      - .env.local
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      dynamodb-local:
        condition: service_healthy
    command: npm run dev

volumes:
  dynamodb-data:

HEREDOC_END

cat > 'next.config.js' << 'HEREDOC_END'
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com", "a.espncdn.com"],
  },
};

module.exports = nextConfig;

HEREDOC_END

cat > 'package.json' << 'HEREDOC_END'
{
  "name": "march-madness",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "setup": "npx ts-node --project tsconfig.scripts.json scripts/create-tables.ts",
    "seed": "npx ts-node --project tsconfig.scripts.json scripts/seed-tournament.ts",
    "poll": "npx ts-node --project tsconfig.scripts.json scripts/poll-espn.ts"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.540.0",
    "@aws-sdk/lib-dynamodb": "^3.540.0",
    "@next-auth/dynamodb-adapter": "^1.2.0",
    "next": "14.2.3",
    "next-auth": "^4.24.7",
    "react": "^18",
    "react-dom": "^18",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "uuid": "^9.0.1",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/uuid": "^9.0.8",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "ts-node": "^10.9.2",
    "typescript": "^5"
  }
}

HEREDOC_END

cat > 'postcss.config.js' << 'HEREDOC_END'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

HEREDOC_END

cat > 'tailwind.config.js' << 'HEREDOC_END'
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        court: {
          50:  "#fff8ed",
          100: "#ffefd3",
          200: "#ffdba5",
          300: "#ffc06d",
          400: "#ff9a32",
          500: "#ff7c0a",
          600: "#f06000",
          700: "#c74602",
          800: "#9e370b",
          900: "#7f2f0c",
        },
        hardwood: {
          900: "#0f0e0c",
          800: "#1a1814",
          700: "#252219",
          600: "#312c20",
          500: "#3d3628",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "score-pop": "scorePop 0.3s ease forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(16px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        scorePop: {
          "0%":   { transform: "scale(1)" },
          "50%":  { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

HEREDOC_END

cat > 'tsconfig.json' << 'HEREDOC_END'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts"]
}

HEREDOC_END

cat > 'tsconfig.scripts.json' << 'HEREDOC_END'
{
  "compilerOptions": {
    "lib": ["esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "outDir": ".scripts-out",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["scripts/**/*.ts", "lib/**/*.ts"],
  "exclude": ["node_modules"]
}

HEREDOC_END

mkdir -p "app"
cat > 'app/globals.css' << 'HEREDOC_END'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --court-orange: #ff7c0a;
  --court-amber: #ffc06d;
  --hardwood-dark: #0f0e0c;
  --hardwood-mid: #1a1814;
  --hardwood-light: #252219;
  --grain-opacity: 0.035;
}

/* Subtle grain texture over everything */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  opacity: var(--grain-opacity);
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--hardwood-dark); }
::-webkit-scrollbar-thumb { background: #3d3628; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #ff7c0a; }

/* Bracket connector lines */
.bracket-connector {
  position: relative;
}
.bracket-connector::after {
  content: "";
  position: absolute;
  right: -1px;
  top: 50%;
  width: 1px;
  height: 100%;
  background: #312c20;
  transform: translateY(-50%);
}

/* Game slot hover glow */
.game-slot {
  transition: all 0.15s ease;
}
.game-slot:hover {
  box-shadow: 0 0 0 1px rgba(255, 124, 10, 0.4);
}
.game-slot.picked {
  box-shadow: 0 0 0 1px rgba(255, 124, 10, 0.7);
}
.game-slot.correct {
  box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.7);
}
.game-slot.incorrect {
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.5);
  opacity: 0.6;
}

HEREDOC_END

mkdir -p "app"
cat > 'app/layout.tsx' << 'HEREDOC_END'
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Bracket Bash",
  description: "March Madness bracket challenge with your crew",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

HEREDOC_END

mkdir -p "app"
cat > 'app/providers.tsx' << 'HEREDOC_END'
"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

HEREDOC_END

mkdir -p "app/(app)"
cat > 'app/(app)/layout.tsx' << 'HEREDOC_END'
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
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}

HEREDOC_END

mkdir -p "app/(app)/dashboard"
cat > 'app/(app)/dashboard/page.tsx' << 'HEREDOC_END'
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import { getGroupsByUser } from "@/lib/dynamo/queries/groups";
import { getTournament } from "@/lib/dynamo/queries/games";
import Link from "next/link";
import { TrophyIcon, UsersIcon, PlusIcon } from "lucide-react";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).userId;

  const [brackets, groups, tournament] = await Promise.all([
    getBracketsByUser(userId),
    getGroupsByUser(userId),
    getTournament(TOURNAMENT_ID),
  ]);

  const isLocked = tournament
    ? new Date() > new Date(tournament.lockDate) && tournament.status !== "pending"
    : false;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div>
        <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-1">
          Welcome back
        </p>
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          {session!.user?.name?.split(" ")[0]}'s Dashboard
        </h1>
        {tournament && (
          <p className="text-gray-500 text-sm mt-1 font-body">
            {tournament.name} •{" "}
            <span className={isLocked ? "text-red-400" : "text-green-400"}>
              {isLocked ? "🔒 Picks locked" : "✅ Picks open"}
            </span>
          </p>
        )}
      </div>

      {/* My Brackets */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-court-500" />
            My Brackets
          </h2>
          {!isLocked && (
            <Link
              href="/bracket/new"
              className="flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Bracket
            </Link>
          )}
        </div>

        {brackets.length === 0 ? (
          <div className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-8 text-center">
            <p className="text-gray-500 font-body mb-4">No brackets yet.</p>
            {!isLocked && (
              <Link
                href="/bracket/new"
                className="inline-flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" /> Create your first bracket
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brackets.map((bracket) => (
              <Link key={bracket.bracketId} href={`/bracket/${bracket.bracketId}`}>
                <div className="bg-hardwood-800 border border-hardwood-600 hover:border-court-500 rounded-xl p-5 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 group">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-display text-xl font-bold text-white group-hover:text-court-400 uppercase tracking-wide">
                      {bracket.name}
                    </h3>
                    <span className="font-mono text-2xl font-bold text-court-500">
                      {bracket.score}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                    <span>Max possible: {bracket.maxPossibleScore}</span>
                    {bracket.isEliminated && (
                      <span className="text-red-400">Eliminated</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* My Groups */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-court-500" />
            My Groups
          </h2>
          <Link
            href="/groups/new"
            className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Group
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="bg-hardwood-800 border border-hardwood-600 rounded-xl p-8 text-center">
            <p className="text-gray-500 font-body mb-4">
              No groups yet. Create one or ask a friend for an invite link.
            </p>
            <Link
              href="/groups/new"
              className="inline-flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" /> Create a group
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Link key={group.groupId} href={`/groups/${group.groupId}`}>
                <div className="bg-hardwood-800 border border-hardwood-600 hover:border-court-500 rounded-xl p-5 transition-all duration-150 hover:-translate-y-0.5 group">
                  <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white group-hover:text-court-400 mb-1">
                    {group.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    {group.adminUserId === userId ? "👑 Admin" : "Member"} ·{" "}
                    {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

HEREDOC_END

mkdir -p "app/api/auth/[...nextauth]"
cat > 'app/api/auth/[...nextauth]/route.ts' << 'HEREDOC_END'
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

HEREDOC_END

mkdir -p "app/api/bracket"
cat > 'app/api/bracket/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getBracketsByUser, createBracket } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";
import { v4 as uuidv4 } from "uuid";
import type { Bracket } from "@/lib/types";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/bracket — list my brackets
export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const brackets = await getBracketsByUser(userId);
  return NextResponse.json(brackets);
}

// POST /api/bracket — create a new bracket
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const body = await req.json();
  const { name } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Bracket name is required" }, { status: 400 });
  }

  // Check tournament lock
  const tournament = await getTournament(TOURNAMENT_ID);
  if (tournament) {
    const lockDate = new Date(tournament.lockDate);
    if (new Date() > lockDate && tournament.status !== "pending") {
      return NextResponse.json({ error: "Tournament is locked. No new brackets." }, { status: 403 });
    }
  }

  const bracket: Bracket = {
    bracketId: uuidv4(),
    userId,
    tournamentId: TOURNAMENT_ID,
    name: name.trim(),
    picks: {},
    score: 0,
    maxPossibleScore: 0,
    isEliminated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createBracket(bracket);
  return NextResponse.json(bracket, { status: 201 });
}

HEREDOC_END

mkdir -p "app/api/bracket/[id]"
cat > 'app/api/bracket/[id]/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getBracket, updatePicks, deleteBracket } from "@/lib/dynamo/queries/brackets";
import { getTournament } from "@/lib/dynamo/queries/games";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/bracket/[id]
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Users can only view their own brackets (admins can view any)
  const userId = getUserId(session);
  const isAdmin = (session as any).user?.isAdmin;
  if (bracket.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(bracket);
}

// PUT /api/bracket/[id] — save picks
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = getUserId(session);
  if (bracket.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check tournament lock
  const tournament = await getTournament(TOURNAMENT_ID);
  if (tournament && tournament.status === "active") {
    const lockDate = new Date(tournament.lockDate);
    if (new Date() > lockDate) {
      return NextResponse.json({ error: "Tournament is locked. Picks are closed." }, { status: 403 });
    }
  }

  const body = await req.json();
  const { picks } = body;

  if (!picks || typeof picks !== "object") {
    return NextResponse.json({ error: "picks object required" }, { status: 400 });
  }

  await updatePicks(params.id, picks);
  return NextResponse.json({ ok: true });
}

// DELETE /api/bracket/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const bracket = await getBracket(params.id);
  if (!bracket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = getUserId(session);
  if (bracket.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteBracket(params.id);
  return NextResponse.json({ ok: true });
}

HEREDOC_END

mkdir -p "app/api/espn/sync"
cat > 'app/api/espn/sync/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { fetchEspnScoreboard, mapEspnStatus, extractEspnWinner, extractEspnScores } from "@/lib/espn/client";
import { getAllGames, setGameResult, advanceWinner, getGameByEspnId } from "@/lib/dynamo/queries/games";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// Internal sync secret - set ESPN_SYNC_SECRET in env, pass as Bearer token
const SYNC_SECRET = process.env.ESPN_SYNC_SECRET ?? "dev-sync-secret";

// POST /api/espn/sync — poll ESPN and update any newly finished games
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${SYNC_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await fetchEspnScoreboard();
  const updated: string[] = [];
  const errors: string[] = [];

  for (const event of events) {
    const status = mapEspnStatus(event.status.type.name);
    if (status !== "final") continue; // Only process completed games

    try {
      const game = await getGameByEspnId(TOURNAMENT_ID, event.id);
      if (!game) continue; // Game not in our DB yet (pre-seeding)
      if (game.status === "final") continue; // Already recorded

      const espnWinnerId = extractEspnWinner(event);
      if (!espnWinnerId) continue;

      // Map ESPN team ID to our team ID
      const competitors = event.competitions?.[0]?.competitors ?? [];
      const winnerEspnTeam = competitors.find((c) => c.team.id === espnWinnerId);
      if (!winnerEspnTeam) continue;

      // Find our team by ESPN ID match (teams were seeded with espnId)
      const [score1, score2] = extractEspnScores(event);

      // We need to resolve espnTeamId → our teamId
      // The game already has team1Id/team2Id; we match by espnId on those teams
      // For now we store the espnTeamId as the winner and resolve during scoring
      // (Full resolution requires a teams lookup - see scoring engine)

      await setGameResult(TOURNAMENT_ID, game.gameId, espnWinnerId, score1, score2);

      // Advance winner into next round
      if (game.nextGameId && game.nextGameSlot) {
        await advanceWinner(TOURNAMENT_ID, game.nextGameId, game.nextGameSlot, espnWinnerId);
      }

      updated.push(game.gameId);
    } catch (err) {
      errors.push(`Event ${event.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    checked: events.length,
    updated: updated.length,
    updatedIds: updated,
    errors,
  });
}

HEREDOC_END

mkdir -p "app/api/games/[id]"
cat > 'app/api/games/[id]/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getGame, getAllTeams, setGameResult, advanceWinner } from "@/lib/dynamo/queries/games";
import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getUser } from "@/lib/dynamo/queries/users";
import { requireAdmin } from "@/lib/session";
import type { GamePicksResponse } from "@/lib/types";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/games/[id] — game details + who picked what
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const game = await getGame(TOURNAMENT_ID, params.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const teams = await getAllTeams(TOURNAMENT_ID);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Get all brackets to find who picked what for this game
  const brackets = await getBracketsByTournament(TOURNAMENT_ID);

  const picks = await Promise.all(
    brackets.map(async (bracket) => {
      const pickedTeamId = bracket.picks[game.gameId];
      if (!pickedTeamId) return null;

      const user = await getUser(bracket.userId);
      const pickedTeam = teamMap.get(pickedTeamId);

      return {
        userId: bracket.userId,
        userName: user?.name ?? "Unknown",
        userPicture: user?.picture ?? "",
        pickedTeamId,
        pickedTeamName: pickedTeam?.name ?? "Unknown",
        isCorrect:
          game.status === "final"
            ? pickedTeamId === game.winnerId
            : null,
      };
    })
  );

  const response: GamePicksResponse = {
    game,
    team1: game.team1Id ? teamMap.get(game.team1Id) ?? null : null,
    team2: game.team2Id ? teamMap.get(game.team2Id) ?? null : null,
    picks: picks.filter(Boolean) as GamePicksResponse["picks"],
  };

  return NextResponse.json(response);
}

// POST /api/games/[id]/result — admin enters game result
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { winnerId, score1, score2 } = body;

  if (!winnerId || score1 == null || score2 == null) {
    return NextResponse.json({ error: "winnerId, score1, score2 required" }, { status: 400 });
  }

  const game = await getGame(TOURNAMENT_ID, params.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  // Save result
  await setGameResult(TOURNAMENT_ID, params.id, winnerId, score1, score2);

  // Advance winner to next game if applicable
  if (game.nextGameId && game.nextGameSlot) {
    await advanceWinner(TOURNAMENT_ID, game.nextGameId, game.nextGameSlot, winnerId);
  }

  return NextResponse.json({ ok: true });
}

HEREDOC_END

mkdir -p "app/api/groups"
cat > 'app/api/groups/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { createGroup, getGroupsByUser } from "@/lib/dynamo/queries/groups";
import { v4 as uuidv4 } from "uuid";
import type { Group } from "@/lib/types";
import { DEFAULT_SCORING_RULES } from "@/lib/types";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/groups — list groups I belong to
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const groups = await getGroupsByUser(userId);
  return NextResponse.json(groups);
}

// POST /api/groups — create a new group
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const body = await req.json();
  const { name, scoringRules } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  const group: Group = {
    groupId: uuidv4(),
    name: name.trim(),
    adminUserId: userId,
    tournamentId: TOURNAMENT_ID,
    inviteToken: uuidv4(),
    scoringRules: scoringRules ?? DEFAULT_SCORING_RULES,
    createdAt: new Date().toISOString(),
  };

  await createGroup(group);
  return NextResponse.json(group, { status: 201 });
}

HEREDOC_END

mkdir -p "app/api/groups/[id]"
cat > 'app/api/groups/[id]/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import {
  getGroup,
  getGroupMembers,
  getGroupMembership,
  addMember,
  updateMemberScore,
  regenerateInviteToken,
  updateGroupScoringRules,
} from "@/lib/dynamo/queries/groups";
import { getBracket, getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { v4 as uuidv4 } from "uuid";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// GET /api/groups/[id] — group info + leaderboard
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const membership = await getGroupMembership(params.id, userId);
  const isAdmin = (session as any).user?.isAdmin;

  if (!membership && group.adminUserId !== userId && !isAdmin) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const members = await getGroupMembers(params.id);

  // Build leaderboard for this group
  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const brackets = await Promise.all(bracketIds.map((id) => getBracket(id)));
  const validBrackets = brackets.filter(Boolean) as Awaited<ReturnType<typeof getBracket>>[];

  const [games, teams] = await Promise.all([
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
  ]);

  const userRecords = await Promise.all(
    members.map(async (m) => {
      const u = await getUser(m.userId);
      return [m.userId, { name: u?.name ?? "Unknown", picture: u?.picture ?? "" }] as const;
    })
  );
  const usersMap = new Map(userRecords);
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = buildLeaderboard(
    validBrackets as any,
    usersMap,
    games,
    teamsMap,
    group.scoringRules
  );

  // Persist updated scores back to member records
  await Promise.all(
    leaderboard.map((entry) =>
      updateMemberScore(params.id, entry.userId, entry.score, entry.rank)
    )
  );

  return NextResponse.json({ group, members, leaderboard });
}

// PATCH /api/groups/[id] — update scoring rules (admin only)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const group = await getGroup(params.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (group.adminUserId !== userId && !(session as any).user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (body.scoringRules) {
    await updateGroupScoringRules(params.id, body.scoringRules);
  }

  if (body.regenerateInvite) {
    const newToken = uuidv4();
    await regenerateInviteToken(params.id, newToken);
    return NextResponse.json({ inviteToken: newToken });
  }

  return NextResponse.json({ ok: true });
}

HEREDOC_END

mkdir -p "app/api/groups/join"
cat > 'app/api/groups/join/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { requireSession, getUserId } from "@/lib/session";
import { getGroupByInviteToken, addMember, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracketsByUser } from "@/lib/dynamo/queries/brackets";
import type { GroupMember } from "@/lib/types";

// POST /api/groups/join — join via invite token
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = getUserId(session);
  const body = await req.json();
  const { token, bracketId } = body;

  if (!token) return NextResponse.json({ error: "Invite token required" }, { status: 400 });

  const group = await getGroupByInviteToken(token);
  if (!group) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });

  // Check already a member
  const existing = await getGroupMembership(group.groupId, userId);
  if (existing) {
    return NextResponse.json({ group, alreadyMember: true });
  }

  // Validate bracketId belongs to this user
  if (bracketId) {
    const userBrackets = await getBracketsByUser(userId);
    const owned = userBrackets.find((b) => b.bracketId === bracketId);
    if (!owned) {
      return NextResponse.json({ error: "Bracket not found or not yours" }, { status: 400 });
    }
  }

  const member: GroupMember = {
    groupId: group.groupId,
    userId,
    bracketId: bracketId ?? "",
    joinedAt: new Date().toISOString(),
    currentScore: 0,
    rank: 0,
  };

  await addMember(member);
  return NextResponse.json({ group, joined: true }, { status: 201 });
}

HEREDOC_END

mkdir -p "app/api/tournament"
cat > 'app/api/tournament/route.ts' << 'HEREDOC_END'
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const [tournament, games, teams] = await Promise.all([
    getTournament(TOURNAMENT_ID),
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
  ]);

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  return NextResponse.json({ tournament, games, teams });
}

HEREDOC_END

mkdir -p "app/login"
cat > 'app/login/page.tsx' << 'HEREDOC_END'
"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  return (
    <div className="min-h-screen bg-hardwood-900 flex items-center justify-center relative overflow-hidden">
      {/* Background court lines */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 border-white" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white" />
      </div>

      <div className="relative z-10 text-center animate-fade-in">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-6xl">🏀</span>
          </div>
          <h1 className="font-display text-7xl font-black tracking-tight text-white uppercase">
            Bracket
            <span className="text-court-500"> Bash</span>
          </h1>
          <p className="font-body text-hardwood-500 text-lg mt-2 tracking-wide">
            March Madness with your crew
          </p>
        </div>

        {/* Sign in card */}
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-8 w-80 mx-auto shadow-2xl">
          <p className="text-sm text-gray-400 mb-6 font-body">
            Sign in to submit your bracket, join groups, and trash-talk your friends.
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-body font-semibold py-3 px-6 rounded-xl transition-all duration-150 shadow-lg hover:shadow-xl active:scale-95"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p className="text-hardwood-600 text-xs mt-6 font-mono">
          No account needed — just your Google login.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

HEREDOC_END

mkdir -p "components/bracket"
cat > 'components/bracket/GamePickModal.tsx' << 'HEREDOC_END'
"use client";
import { useEffect, useState } from "react";
import { XIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon } from "lucide-react";
import Image from "next/image";
import type { GamePicksResponse } from "@/lib/types";

interface GamePickModalProps {
  gameId: string | null;
  onClose: () => void;
}

export function GamePickModal({ gameId, onClose }: GamePickModalProps) {
  const [data, setData] = useState<GamePicksResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    setData(null);
    fetch(`/api/games/${gameId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [gameId]);

  if (!gameId) return null;

  const team1Picks = data?.picks.filter((p) => p.pickedTeamId === data.game.team1Id) ?? [];
  const team2Picks = data?.picks.filter((p) => p.pickedTeamId === data.game.team2Id) ?? [];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-hardwood-800 border border-hardwood-500 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-hardwood-600">
          <div>
            <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-0.5">
              {data?.game.round} · {data?.game.region}
            </p>
            <h2 className="font-display text-2xl font-black uppercase text-white">
              {data?.team1?.name ?? "TBD"}{" "}
              <span className="text-court-500">vs</span>{" "}
              {data?.team2?.name ?? "TBD"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Game status */}
        {data?.game.status === "final" && (
          <div className="px-5 py-3 bg-hardwood-700 border-b border-hardwood-600">
            <p className="text-sm font-mono text-gray-400">
              Final:{" "}
              <span className="text-white font-semibold">
                {data.team1?.name} {data.game.score1} –{" "}
                {data.game.score2} {data.team2?.name}
              </span>
              {" · "}
              <span className="text-green-400">
                Winner: {data.game.winnerId === data.game.team1Id
                  ? data.team1?.name
                  : data.team2?.name}
              </span>
            </p>
          </div>
        )}

        {loading && (
          <div className="p-10 text-center text-gray-500 font-mono text-sm">
            Loading picks...
          </div>
        )}

        {data && !loading && (
          <div className="p-5">
            {data.picks.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4 font-body">
                No one has picked this game yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Team 1 picks */}
                <PickColumn
                  teamName={data.team1?.name ?? "TBD"}
                  seed={data.team1?.seed}
                  picks={team1Picks}
                  isWinner={data.game.status === "final" && data.game.winnerId === data.game.team1Id}
                  isLoser={data.game.status === "final" && data.game.winnerId === data.game.team2Id}
                />
                {/* Team 2 picks */}
                <PickColumn
                  teamName={data.team2?.name ?? "TBD"}
                  seed={data.team2?.seed}
                  picks={team2Picks}
                  isWinner={data.game.status === "final" && data.game.winnerId === data.game.team2Id}
                  isLoser={data.game.status === "final" && data.game.winnerId === data.game.team1Id}
                />
              </div>
            )}

            {/* Summary bar */}
            {data.picks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-hardwood-600">
                <div className="flex gap-2 text-xs font-mono text-gray-500">
                  <span>{team1Picks.length} picked {data.team1?.shortName ?? "T1"}</span>
                  <span>·</span>
                  <span>{team2Picks.length} picked {data.team2?.shortName ?? "T2"}</span>
                </div>
                <div className="mt-2 h-2 bg-hardwood-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-court-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(team1Picks.length / data.picks.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PickColumn({
  teamName,
  seed,
  picks,
  isWinner,
  isLoser,
}: {
  teamName: string;
  seed?: number;
  picks: GamePicksResponse["picks"];
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div>
      <div
        className={`text-xs font-display font-bold uppercase tracking-wide mb-2 flex items-center gap-1 ${
          isWinner ? "text-green-400" : isLoser ? "text-red-400" : "text-gray-400"
        }`}
      >
        {seed && <span className="text-gray-600">#{seed}</span>}
        {teamName}
        {isWinner && <CheckCircleIcon className="w-3 h-3" />}
        {isLoser && <XCircleIcon className="w-3 h-3" />}
      </div>
      <div className="space-y-1.5">
        {picks.map((pick) => (
          <div
            key={pick.userId}
            className="flex items-center gap-2 bg-hardwood-700 rounded-lg px-2.5 py-1.5"
          >
            {pick.userPicture ? (
              <Image
                src={pick.userPicture}
                alt={pick.userName}
                width={20}
                height={20}
                className="rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-hardwood-500 flex-shrink-0" />
            )}
            <span className="text-sm text-white font-body truncate flex-1">
              {pick.userName.split(" ")[0]}
            </span>
            {pick.isCorrect === true && (
              <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
            )}
            {pick.isCorrect === false && (
              <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            {pick.isCorrect === null && (
              <MinusCircleIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
            )}
          </div>
        ))}
        {picks.length === 0 && (
          <p className="text-xs text-gray-600 font-mono py-1">No picks</p>
        )}
      </div>
    </div>
  );
}

HEREDOC_END

mkdir -p "components/layout"
cat > 'components/layout/Navbar.tsx' << 'HEREDOC_END'
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { clsx } from "clsx";

interface NavbarProps {
  user: { name?: string; email?: string; image?: string; isAdmin?: boolean };
}

const NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/bracket",     label: "My Brackets" },
  { href: "/groups",      label: "Groups" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="bg-hardwood-800 border-b border-hardwood-600 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="text-2xl">🏀</span>
            <span className="font-display text-xl font-black uppercase tracking-tight text-white group-hover:text-court-400 transition-colors">
              Bracket<span className="text-court-500">Bash</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors",
                  pathname.startsWith(link.href)
                    ? "text-court-400 bg-hardwood-700"
                    : "text-gray-400 hover:text-white hover:bg-hardwood-700"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user.isAdmin && (
              <Link
                href="/admin"
                className={clsx(
                  "font-body text-sm font-medium px-3 py-1.5 rounded-lg transition-colors",
                  pathname.startsWith("/admin")
                    ? "text-court-400 bg-hardwood-700"
                    : "text-yellow-500 hover:text-yellow-400 hover:bg-hardwood-700"
                )}
              >
                ⚡ Admin
              </Link>
            )}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-hardwood-600"
              />
            )}
            <span className="hidden sm:block text-sm text-gray-400 font-body">
              {user.name?.split(" ")[0]}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

HEREDOC_END

mkdir -p "lib"
cat > 'lib/auth.ts' << 'HEREDOC_END'
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DynamoDBAdapter } from "@next-auth/dynamodb-adapter";
import { rawClient } from "./dynamo/client";
import { upsertUser } from "./dynamo/queries/users";

const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  adapter: DynamoDBAdapter(rawClient, {
    tableName: "mm-next-auth",
  }),

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user }) {
      // On first sign-in, create our own user record in mm-users
      if (user.email && user.id) {
        await upsertUser({
          userId: user.id,
          name: user.name ?? "",
          email: user.email ?? "",
          picture: user.image ?? "",
          isAdmin: adminEmails.includes(user.email ?? ""),
          createdAt: new Date().toISOString(),
        });
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.isAdmin = adminEmails.includes(user.email ?? "");
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).userId = token.userId;
        (session.user as any).isAdmin = token.isAdmin;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

HEREDOC_END

mkdir -p "lib"
cat > 'lib/session.ts' << 'HEREDOC_END'
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(session.user as any).isAdmin) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}

export function getUserId(session: any): string {
  return session.user.userId as string;
}

HEREDOC_END

mkdir -p "lib"
cat > 'lib/types.ts' << 'HEREDOC_END'
// ─── Tournament & Games ───────────────────────────────────────────────────────

export type Round =
  | "R64"   // Round of 64
  | "R32"   // Round of 32
  | "S16"   // Sweet 16
  | "E8"    // Elite 8
  | "F4"    // Final Four
  | "NCG";  // National Championship Game

export type Region = "East" | "West" | "South" | "Midwest" | "FinalFour";

export type GameStatus = "scheduled" | "in_progress" | "final";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  seed: number;
  region: Region;
  espnId?: string;
  logoUrl?: string;
  color?: string;
}

export interface Game {
  gameId: string;
  tournamentId: string;
  round: Round;
  region: Region;
  // Slot in bracket (e.g. which game in R64 = 1-32)
  bracketSlot: number;
  // The two teams playing (null if not yet determined)
  team1Id: string | null;
  team2Id: string | null;
  // Feeds into which game in the next round
  nextGameId: string | null;
  nextGameSlot: 1 | 2 | null; // which slot (team1 or team2) winner fills
  // Results
  winnerId: string | null;
  score1: number | null;
  score2: number | null;
  status: GameStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  // ESPN sync
  espnGameId?: string;
}

export interface Tournament {
  tournamentId: string;
  name: string;
  year: number;
  status: "pending" | "active" | "complete";
  lockDate: string; // ISO - picks close at this time
  createdAt: string;
}

// ─── Brackets & Picks ─────────────────────────────────────────────────────────

// Map of gameId -> teamId (the team the user picked to win that game)
export type Picks = Record<string, string>;

export interface Bracket {
  bracketId: string;
  userId: string;
  tournamentId: string;
  name: string;
  picks: Picks;
  score: number;
  maxPossibleScore: number;
  isEliminated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface RoundScoringRule {
  basePoints: number;
  upsetMultiplier: number; // multiplier applied when a lower seed wins
}

export interface ScoringRules {
  rounds: Record<Round, RoundScoringRule>;
  bonuses: {
    correctChampion: number;
    perfectRound: number;
  };
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  rounds: {
    R64: { basePoints: 1,  upsetMultiplier: 0 },
    R32: { basePoints: 2,  upsetMultiplier: 0 },
    S16: { basePoints: 4,  upsetMultiplier: 0 },
    E8:  { basePoints: 8,  upsetMultiplier: 0 },
    F4:  { basePoints: 16, upsetMultiplier: 0 },
    NCG: { basePoints: 32, upsetMultiplier: 0 },
  },
  bonuses: {
    correctChampion: 0,
    perfectRound: 0,
  },
};

export const UPSET_SCORING_RULES: ScoringRules = {
  rounds: {
    R64: { basePoints: 1,  upsetMultiplier: 1.0 },
    R32: { basePoints: 2,  upsetMultiplier: 1.5 },
    S16: { basePoints: 4,  upsetMultiplier: 2.0 },
    E8:  { basePoints: 8,  upsetMultiplier: 2.5 },
    F4:  { basePoints: 16, upsetMultiplier: 3.0 },
    NCG: { basePoints: 32, upsetMultiplier: 0.0 },
  },
  bonuses: {
    correctChampion: 25,
    perfectRound: 50,
  },
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export interface Group {
  groupId: string;
  name: string;
  adminUserId: string;
  tournamentId: string;
  inviteToken: string;
  scoringRules: ScoringRules;
  createdAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  bracketId: string;
  joinedAt: string;
  currentScore: number;
  rank: number;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AppUser {
  userId: string; // Google sub
  name: string;
  email: string;
  picture: string;
  isAdmin: boolean;
  createdAt: string;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userPicture: string;
  bracketId: string;
  bracketName: string;
  score: number;
  maxPossibleScore: number;
  roundBreakdown: Record<Round, number>;
  correctPicks: number;
  totalPicks: number;
}

// ─── ESPN API ─────────────────────────────────────────────────────────────────

export interface EspnCompetitor {
  id: string;
  score: string;
  winner: boolean;
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    color?: string;
    logo?: string;
  };
}

export interface EspnEvent {
  id: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string; // "STATUS_FINAL" | "STATUS_IN_PROGRESS" | "STATUS_SCHEDULED"
      completed: boolean;
    };
  };
  competitions: Array<{
    competitors: EspnCompetitor[];
  }>;
  season?: {
    type: number;
    slug: string;
  };
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface GamePicksResponse {
  game: Game;
  team1: Team | null;
  team2: Team | null;
  picks: Array<{
    userId: string;
    userName: string;
    userPicture: string;
    pickedTeamId: string;
    pickedTeamName: string;
    isCorrect: boolean | null; // null if game not complete
  }>;
}

HEREDOC_END

mkdir -p "lib/dynamo"
cat > 'lib/dynamo/client.ts' << 'HEREDOC_END'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// In local dev, DYNAMODB_ENDPOINT points to DynamoDB Local container.
// In production on AWS, this env var is unset and the SDK uses real AWS.
const isLocal = !!process.env.DYNAMODB_ENDPOINT;

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
    },
  }),
});

// DynamoDBDocumentClient handles marshalling/unmarshalling JS <-> DynamoDB types
export const dynamo = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export { rawClient };

HEREDOC_END

mkdir -p "lib/dynamo"
cat > 'lib/dynamo/tables.ts' << 'HEREDOC_END'
// Centralised table names. Prefix with env if you want staging/prod separation.
const prefix = process.env.DYNAMO_TABLE_PREFIX ?? "mm";

export const TABLES = {
  USERS:      `${prefix}-users`,
  TOURNAMENT: `${prefix}-tournament`,
  BRACKETS:   `${prefix}-brackets`,
  GROUPS:     `${prefix}-groups`,
  SCORES:     `${prefix}-scores`,
} as const;

HEREDOC_END

mkdir -p "lib/dynamo/queries"
cat > 'lib/dynamo/queries/brackets.ts' << 'HEREDOC_END'
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { Bracket, Picks } from "../../types";

export async function getBracket(bracketId: string): Promise<Bracket | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
    })
  );
  return res.Item ? (res.Item as Bracket) : null;
}

export async function getBracketsByUser(userId: string): Promise<Bracket[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.BRACKETS,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );
  return (res.Items ?? []) as Bracket[];
}

export async function getBracketsByTournament(tournamentId: string): Promise<Bracket[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.BRACKETS,
      IndexName: "tournamentId-index",
      KeyConditionExpression: "tournamentId = :tid",
      ExpressionAttributeValues: { ":tid": tournamentId },
    })
  );
  return (res.Items ?? []) as Bracket[];
}

export async function createBracket(bracket: Bracket): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.BRACKETS,
      Item: {
        pk: `BRACKET#${bracket.bracketId}`,
        sk: "META",
        ...bracket,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );
}

export async function updatePicks(
  bracketId: string,
  picks: Picks
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
      UpdateExpression: "SET picks = :p, updatedAt = :u",
      ExpressionAttributeValues: {
        ":p": picks,
        ":u": new Date().toISOString(),
      },
    })
  );
}

export async function updateScore(
  bracketId: string,
  score: number,
  maxPossibleScore: number,
  isEliminated: boolean
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
      UpdateExpression:
        "SET score = :s, maxPossibleScore = :m, isEliminated = :e, updatedAt = :u",
      ExpressionAttributeValues: {
        ":s": score,
        ":m": maxPossibleScore,
        ":e": isEliminated,
        ":u": new Date().toISOString(),
      },
    })
  );
}

export async function deleteBracket(bracketId: string): Promise<void> {
  await dynamo.send(
    new DeleteCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
    })
  );
}

HEREDOC_END

mkdir -p "lib/dynamo/queries"
cat > 'lib/dynamo/queries/games.ts' << 'HEREDOC_END'
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { Tournament, Game, Team } from "../../types";

// ─── Tournament ───────────────────────────────────────────────────────────────

export async function getTournament(tournamentId: string): Promise<Tournament | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: "META" },
    })
  );
  return res.Item ? (res.Item as Tournament) : null;
}

export async function upsertTournament(t: Tournament): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.TOURNAMENT,
      Item: { pk: `TOURNAMENT#${t.tournamentId}`, sk: "META", ...t },
    })
  );
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getTeam(tournamentId: string, teamId: string): Promise<Team | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `TEAM#${teamId}` },
    })
  );
  return res.Item ? (res.Item as Team) : null;
}

export async function getAllTeams(tournamentId: string): Promise<Team[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.TOURNAMENT,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `TOURNAMENT#${tournamentId}`,
        ":prefix": "TEAM#",
      },
    })
  );
  return (res.Items ?? []) as Team[];
}

export async function upsertTeam(tournamentId: string, team: Team): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.TOURNAMENT,
      Item: {
        pk: `TOURNAMENT#${tournamentId}`,
        sk: `TEAM#${team.id}`,
        ...team,
      },
    })
  );
}

// ─── Games ────────────────────────────────────────────────────────────────────

export async function getGame(tournamentId: string, gameId: string): Promise<Game | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `GAME#${gameId}` },
    })
  );
  return res.Item ? (res.Item as Game) : null;
}

export async function getAllGames(tournamentId: string): Promise<Game[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.TOURNAMENT,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `TOURNAMENT#${tournamentId}`,
        ":prefix": "GAME#",
      },
    })
  );
  return (res.Items ?? []) as Game[];
}

export async function upsertGame(tournamentId: string, game: Game): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.TOURNAMENT,
      Item: {
        pk: `TOURNAMENT#${tournamentId}`,
        sk: `GAME#${game.gameId}`,
        ...game,
      },
    })
  );
}

export async function setGameResult(
  tournamentId: string,
  gameId: string,
  winnerId: string,
  score1: number,
  score2: number
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `GAME#${gameId}` },
      UpdateExpression:
        "SET winnerId = :w, score1 = :s1, score2 = :s2, #st = :st, completedAt = :ca",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":w":  winnerId,
        ":s1": score1,
        ":s2": score2,
        ":st": "final",
        ":ca": new Date().toISOString(),
      },
    })
  );
}

// Advance winner into the next game's team slot
export async function advanceWinner(
  tournamentId: string,
  nextGameId: string,
  nextGameSlot: 1 | 2,
  teamId: string
): Promise<void> {
  const field = nextGameSlot === 1 ? "team1Id" : "team2Id";
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `GAME#${nextGameId}` },
      UpdateExpression: `SET ${field} = :t`,
      ExpressionAttributeValues: { ":t": teamId },
    })
  );
}

// Find a game by its ESPN ID (used during polling sync)
export async function getGameByEspnId(
  tournamentId: string,
  espnGameId: string
): Promise<Game | null> {
  const all = await getAllGames(tournamentId);
  return all.find((g) => g.espnGameId === espnGameId) ?? null;
}

HEREDOC_END

mkdir -p "lib/dynamo/queries"
cat > 'lib/dynamo/queries/groups.ts' << 'HEREDOC_END'
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { Group, GroupMember } from "../../types";

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function getGroup(groupId: string): Promise<Group | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: "META" },
    })
  );
  return res.Item ? (res.Item as Group) : null;
}

export async function getGroupByInviteToken(token: string): Promise<Group | null> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.GROUPS,
      IndexName: "inviteToken-index",
      KeyConditionExpression: "inviteToken = :t",
      ExpressionAttributeValues: { ":t": token },
    })
  );
  return res.Items?.[0] ? (res.Items[0] as Group) : null;
}

export async function createGroup(group: Group): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.GROUPS,
      Item: {
        pk: `GROUP#${group.groupId}`,
        sk: "META",
        ...group,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );
}

export async function updateGroupScoringRules(
  groupId: string,
  scoringRules: Group["scoringRules"]
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: "META" },
      UpdateExpression: "SET scoringRules = :r",
      ExpressionAttributeValues: { ":r": scoringRules },
    })
  );
}

export async function regenerateInviteToken(
  groupId: string,
  newToken: string
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: "META" },
      UpdateExpression: "SET inviteToken = :t",
      ExpressionAttributeValues: { ":t": newToken },
    })
  );
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.GROUPS,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `GROUP#${groupId}`,
        ":prefix": "MEMBER#",
      },
    })
  );
  return (res.Items ?? []) as GroupMember[];
}

export async function getGroupMembership(
  groupId: string,
  userId: string
): Promise<GroupMember | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: `MEMBER#${userId}` },
    })
  );
  return res.Item ? (res.Item as GroupMember) : null;
}

export async function addMember(member: GroupMember): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.GROUPS,
      Item: {
        pk: `GROUP#${member.groupId}`,
        sk: `MEMBER#${member.userId}`,
        ...member,
      },
    })
  );
}

export async function updateMemberScore(
  groupId: string,
  userId: string,
  score: number,
  rank: number
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: `MEMBER#${userId}` },
      UpdateExpression: "SET currentScore = :s, #r = :r",
      ExpressionAttributeNames: { "#r": "rank" },
      ExpressionAttributeValues: { ":s": score, ":r": rank },
    })
  );
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  await dynamo.send(
    new DeleteCommand({
      TableName: TABLES.GROUPS,
      Key: { pk: `GROUP#${groupId}`, sk: `MEMBER#${userId}` },
    })
  );
}

// Get all groups a user belongs to (via GSI on userId)
export async function getGroupsByUser(userId: string): Promise<Group[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.GROUPS,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );
  // These items are member records; we need to fetch each group META
  const groupIds = (res.Items ?? []).map((i) => i.groupId as string);
  const groups = await Promise.all(groupIds.map(getGroup));
  return groups.filter(Boolean) as Group[];
}

HEREDOC_END

mkdir -p "lib/dynamo/queries"
cat > 'lib/dynamo/queries/users.ts' << 'HEREDOC_END'
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { AppUser } from "../../types";

export async function getUser(userId: string): Promise<AppUser | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.USERS,
      Key: { pk: `USER#${userId}`, sk: "PROFILE" },
    })
  );
  return res.Item ? (res.Item as AppUser) : null;
}

export async function upsertUser(user: AppUser): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.USERS,
      Item: {
        pk: `USER#${user.userId}`,
        sk: "PROFILE",
        ...user,
      },
    })
  );
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { pk: `USER#${userId}`, sk: "PROFILE" },
      UpdateExpression: "SET isAdmin = :v",
      ExpressionAttributeValues: { ":v": isAdmin },
    })
  );
}

HEREDOC_END

mkdir -p "lib/espn"
cat > 'lib/espn/client.ts' << 'HEREDOC_END'
import type { EspnEvent, Game } from "../types";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

// groups=100 scopes to NCAA Tournament games during March Madness
const SCOREBOARD_URL = `${ESPN_BASE}/scoreboard?groups=100&limit=50`;

export interface EspnScoreboardResponse {
  events: EspnEvent[];
}

/**
 * Fetch the current NCAA tournament scoreboard from ESPN's unofficial API.
 * Returns raw ESPN events. Caller maps to our Game type.
 */
export async function fetchEspnScoreboard(): Promise<EspnEvent[]> {
  const res = await fetch(SCOREBOARD_URL, {
    // No-cache so we always get fresh data during polling
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MarchMadnessBracketApp/1.0)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`ESPN API error: ${res.status} ${res.statusText}`);
  }

  const data: EspnScoreboardResponse = await res.json();
  return data.events ?? [];
}

/**
 * Fetch details for a single ESPN game by ID.
 */
export async function fetchEspnGame(espnGameId: string): Promise<EspnEvent | null> {
  const url = `${ESPN_BASE}/summary?event=${espnGameId}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data ?? null;
}

/**
 * Map ESPN status string to our GameStatus type.
 */
export function mapEspnStatus(espnStatusName: string): Game["status"] {
  if (espnStatusName === "STATUS_FINAL") return "final";
  if (espnStatusName === "STATUS_IN_PROGRESS") return "in_progress";
  return "scheduled";
}

/**
 * Extract the winner from an ESPN event (returns ESPN team ID or null).
 */
export function extractEspnWinner(event: EspnEvent): string | null {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const winner = competitors.find((c) => c.winner);
  return winner?.team?.id ?? null;
}

/**
 * Extract scores from an ESPN event.
 * Returns [score1, score2] matching competitors order.
 */
export function extractEspnScores(event: EspnEvent): [number, number] {
  const comps = event.competitions?.[0]?.competitors ?? [];
  return [
    parseInt(comps[0]?.score ?? "0", 10),
    parseInt(comps[1]?.score ?? "0", 10),
  ];
}

HEREDOC_END

mkdir -p "lib/scoring"
cat > 'lib/scoring/engine.ts' << 'HEREDOC_END'
import type { Bracket, Game, Team, ScoringRules, Round, LeaderboardEntry } from "../types";

interface ScoreResult {
  score: number;
  maxPossibleScore: number;
  isEliminated: boolean;
  roundBreakdown: Record<Round, number>;
  correctPicks: number;
  totalCompletedGames: number;
}

/**
 * Calculate the score for a single bracket given the current game states.
 * This is pure — no DB calls. Feed it data, get back scores.
 */
export function scoreBracket(
  bracket: Bracket,
  games: Game[],
  teams: Map<string, Team>,
  rules: ScoringRules
): ScoreResult {
  const roundBreakdown: Record<Round, number> = {
    R64: 0, R32: 0, S16: 0, E8: 0, F4: 0, NCG: 0,
  };

  let score = 0;
  let maxPossibleScore = 0;
  let correctPicks = 0;
  let totalCompletedGames = 0;
  let isEliminated = false;

  const completedGames = games.filter((g) => g.status === "final");
  const pendingGames = games.filter((g) => g.status !== "final");

  // Score completed games
  for (const game of completedGames) {
    if (!game.winnerId) continue;
    totalCompletedGames++;

    const rule = rules.rounds[game.round];
    const userPick = bracket.picks[game.gameId];

    if (userPick === game.winnerId) {
      // Correct pick
      let pts = rule.basePoints;

      // Upset bonus: winner seed > loser seed (higher number = lower seed)
      if (rule.upsetMultiplier > 0) {
        const winner = teams.get(game.winnerId);
        const loserId = game.team1Id === game.winnerId ? game.team2Id : game.team1Id;
        const loser = loserId ? teams.get(loserId) : null;
        if (winner && loser && winner.seed > loser.seed) {
          pts += rule.basePoints * rule.upsetMultiplier * (winner.seed - loser.seed);
        }
      }

      score += pts;
      roundBreakdown[game.round] += pts;
      correctPicks++;
    }
  }

  // Calculate max possible score (score + all remaining games if user picks correctly)
  maxPossibleScore = score;
  for (const game of pendingGames) {
    const rule = rules.rounds[game.round];
    const userPick = bracket.picks[game.gameId];

    if (!userPick) continue;

    // Check if the team they picked is still alive (hasn't been eliminated)
    const pickedTeamEliminated = completedGames.some(
      (g) => g.status === "final" && g.winnerId !== userPick &&
             (g.team1Id === userPick || g.team2Id === userPick)
    );

    if (!pickedTeamEliminated) {
      // Best case: assume upset points if applicable
      const picked = teams.get(userPick);
      if (picked) {
        let maxPts = rule.basePoints;
        if (rule.upsetMultiplier > 0) {
          // Assume max possible upset (seed 16 beating seed 1 = 15 * multiplier)
          // In practice we just add the base; conservatively we skip upset bonus
          maxPts = rule.basePoints;
        }
        maxPossibleScore += maxPts;
      }
    } else {
      // This pick is dead — user can never get this point
      isEliminated = true; // at least one pick is eliminated
    }
  }

  // Champion bonus
  const championship = games.find((g) => g.round === "NCG");
  if (championship?.winnerId && bracket.picks[championship.gameId] === championship.winnerId) {
    score += rules.bonuses.correctChampion;
    roundBreakdown["NCG"] += rules.bonuses.correctChampion;
  } else if (!championship?.winnerId && bracket.picks[championship?.gameId ?? ""]) {
    maxPossibleScore += rules.bonuses.correctChampion;
  }

  return {
    score: Math.round(score),
    maxPossibleScore: Math.round(maxPossibleScore),
    isEliminated,
    roundBreakdown,
    correctPicks,
    totalCompletedGames,
  };
}

/**
 * Build a sorted leaderboard from a list of brackets + scoring context.
 */
export function buildLeaderboard(
  brackets: Bracket[],
  users: Map<string, { name: string; picture: string }>,
  games: Game[],
  teams: Map<string, Team>,
  rules: ScoringRules
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = brackets.map((bracket) => {
    const result = scoreBracket(bracket, games, teams, rules);
    const user = users.get(bracket.userId);
    return {
      rank: 0, // set below
      userId: bracket.userId,
      userName: user?.name ?? "Unknown",
      userPicture: user?.picture ?? "",
      bracketId: bracket.bracketId,
      bracketName: bracket.name,
      score: result.score,
      maxPossibleScore: result.maxPossibleScore,
      roundBreakdown: result.roundBreakdown,
      correctPicks: result.correctPicks,
      totalPicks: Object.keys(bracket.picks).length,
    };
  });

  // Sort: primary by score desc, secondary by maxPossible desc
  entries.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : b.maxPossibleScore - a.maxPossibleScore
  );

  // Assign ranks (ties get same rank)
  let rank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].score < entries[i - 1].score) {
      rank = i + 1;
    }
    entries[i].rank = rank;
  }

  return entries;
}

HEREDOC_END

mkdir -p "scripts"
cat > 'scripts/create-tables.ts' << 'HEREDOC_END'
/**
 * Run once to create all DynamoDB tables (local or prod).
 * Usage: npm run setup
 */
import {
  CreateTableCommand,
  ListTablesCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import { rawClient } from "../lib/dynamo/client";

const tables = [
  // ── Users ──────────────────────────────────────────────────────────────────
  {
    TableName: "mm-users",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
  },

  // ── Tournament + Games + Teams ────────────────────────────────────────────
  {
    TableName: "mm-tournament",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
  },

  // ── Brackets ──────────────────────────────────────────────────────────────
  {
    TableName: "mm-brackets",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk",            AttributeType: "S" },
      { AttributeName: "sk",            AttributeType: "S" },
      { AttributeName: "userId",        AttributeType: "S" },
      { AttributeName: "tournamentId",  AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "tournamentId-index",
        KeySchema: [{ AttributeName: "tournamentId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },

  // ── Groups + Members ──────────────────────────────────────────────────────
  {
    TableName: "mm-groups",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk",            AttributeType: "S" },
      { AttributeName: "sk",            AttributeType: "S" },
      { AttributeName: "inviteToken",   AttributeType: "S" },
      { AttributeName: "userId",        AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "inviteToken-index",
        KeySchema: [{ AttributeName: "inviteToken", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },

  // ── NextAuth sessions/accounts (required by DynamoDB adapter) ─────────────
  {
    TableName: "mm-next-auth",
    BillingMode: "PAY_PER_REQUEST" as const,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk",  AttributeType: "S" },
      { AttributeName: "sk",  AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
];

async function main() {
  console.log("🏀 Setting up DynamoDB tables...\n");

  const existing = await rawClient.send(new ListTablesCommand({}));
  const existingNames = new Set(existing.TableNames ?? []);

  for (const table of tables) {
    if (existingNames.has(table.TableName)) {
      console.log(`  ✓ ${table.TableName} (already exists)`);
      continue;
    }
    try {
      await rawClient.send(new CreateTableCommand(table as any));
      console.log(`  ✅ Created: ${table.TableName}`);
    } catch (err) {
      if (err instanceof ResourceInUseException) {
        console.log(`  ✓ ${table.TableName} (already exists)`);
      } else {
        console.error(`  ❌ Failed: ${table.TableName}`, err);
        throw err;
      }
    }
  }

  console.log("\n✅ All tables ready. Run `npm run seed` to import tournament data.");
}

main().catch(console.error);

HEREDOC_END

echo ""
echo "✅ All files written!"
echo ""
echo "Next steps:"
echo "  1. cp .env.local.example .env.local"
echo "  2. Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET"
echo "  3. npm install"
echo "  4. docker-compose up"
echo "  5. npm run setup   # create DynamoDB tables"
echo "  6. git add . && git commit -m 'feat: Phase 1 scaffold' && git push"
echo ""
echo "🏀 Ready to ball."
# Also write a .gitignore if one doesn't exist
if [ ! -f ".gitignore" ]; then
cat > '.gitignore' << 'GITIGNORE_END'
# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/
build/

# Environment
.env
.env.local
.env.*.local

# DynamoDB local data
.dynamodb/

# Scripts compiled output
.scripts-out/

# Misc
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.vercel
*.tsbuildinfo
next-env.d.ts
GITIGNORE_END
echo "  ✅ .gitignore created"
fi
