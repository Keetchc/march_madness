#!/usr/bin/env bash
# ================================================================
# BracketBash — Full Bootstrap Script (with 2026 bracket data)
# git clone https://github.com/keetchc/march_madness.git
# cd march_madness && bash bootstrap.sh
# ================================================================
set -e
echo "🏀 Bootstrapping BracketBash..."
echo ""
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

cat > 'README.md' << 'HEREDOC_END'
# 🏀 BracketBash

March Madness bracket challenge app for you and your friends.

**Stack:** Next.js 14 · DynamoDB · Google OAuth · Tailwind CSS · Docker  
**Deploy:** AWS Amplify + DynamoDB (serverless, ~$5–15/month for a friend group)

---

## Local Development

### Prerequisites
- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A Google Cloud project with OAuth 2.0 credentials

### 1. Clone & install

```bash
git clone https://github.com/keetchc/march_madness.git
cd march_madness
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

| Variable | Where to get it |
|---|---|
| `GOOGLE_CLIENT_ID` | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` (local) |
| `ADMIN_EMAILS` | Your Google email address |

**Google OAuth setup:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID → Web Application
4. Add `http://localhost:3000/api/auth/callback/google` as an Authorized Redirect URI

### 3. Start local services

```bash
docker-compose up
```

This starts:
- **Next.js app** on http://localhost:3000
- **DynamoDB Local** on http://localhost:8000
- **DynamoDB Admin UI** on http://localhost:8001 ← great for inspecting data

### 4. Create DynamoDB tables

In a new terminal:

```bash
npm run setup
```

### 5. Seed tournament data

Upload your bracket JSON file, then:

```bash
BRACKET_FILE=./scripts/my-bracket-2026.json npm run seed
```

See `scripts/bracket-template.json` for the required format.

### 6. Start the ESPN poller (during tournament)

```bash
npm run poll
```

This polls ESPN every 60 seconds during tournament hours and auto-updates game results.

---

## Project Structure

```
app/
  (app)/              # Authenticated pages
    dashboard/        # Home — my brackets & groups
    bracket/[id]/     # View/edit a bracket
    groups/           # Group list
    groups/[id]/      # Group leaderboard + invite
    leaderboard/      # Global leaderboard
    admin/            # Admin: enter game results
  api/                # API routes
  login/              # Google sign-in page
components/
  bracket/            # BracketView, GameSlot, GamePickModal
  layout/             # Navbar
lib/
  dynamo/             # DynamoDB client + all queries
  espn/               # ESPN API client
  scoring/            # Scoring engine
  types.ts            # All TypeScript types
scripts/
  create-tables.ts    # Bootstrap DynamoDB tables
  seed-tournament.ts  # Import bracket data
  poll-espn.ts        # ESPN polling cron
```

---

## Features

- ✅ Google OAuth login
- ✅ Create & submit brackets (picks lock at tournament start)
- ✅ Groups with shareable invite links
- ✅ Custom scoring rules per group (upset bonuses, champion bonus)
- ✅ **"Who picked what"** — click any game to see everyone's pick
- ✅ Live leaderboard with score breakdown
- ✅ Auto-updating game results via ESPN API
- ✅ Admin panel for manual result entry
- ✅ Responsive: region tabs on mobile, full bracket on desktop

---

## AWS Deployment

See `ARCHITECTURE.md` for the full deployment plan.

**Short version:**
1. Push code to GitHub
2. Connect repo to [AWS Amplify](https://aws.amazon.com/amplify/)
3. Set environment variables in Amplify console
4. Create DynamoDB tables in AWS (`npm run setup` with prod credentials)
5. Set up EventBridge Scheduler to call `/api/espn/sync` every 60s during tournament

Estimated cost for a ~20 person group: **$5–15/month**

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

mkdir -p "app/(app)/admin"
cat > 'app/(app)/admin/AdminPageClient.tsx' << 'HEREDOC_END'
"use client";
import { useState } from "react";
import type { Game, Team, Tournament, Round } from "@/lib/types";
import { clsx } from "clsx";
import { RefreshCwIcon, CheckCircleIcon } from "lucide-react";

interface AdminPageClientProps {
  games: Game[];
  teams: Map<string, Team> | Team[];
  tournament: Tournament;
}

const ROUND_ORDER: Round[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
const ROUND_LABELS: Record<Round, string> = {
  R64: "First Round", R32: "Round of 32", S16: "Sweet 16",
  E8: "Elite Eight", F4: "Final Four", NCG: "Championship",
};

export function AdminPageClient({ games, teams: teamsInput, tournament }: AdminPageClientProps) {
  const teamsMap: Map<string, Team> = teamsInput instanceof Map
    ? teamsInput
    : new Map((teamsInput as Team[]).map((t) => [t.id, t]));

  const [localGames, setLocalGames] = useState<Game[]>(games);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState<Round>("R64");

  // Result entry state per game
  const [resultInputs, setResultInputs] = useState<
    Record<string, { winnerId: string; score1: string; score2: string }>
  >({});

  async function triggerEspnSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/espn/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ESPN_SYNC_SECRET ?? "dev-sync-secret"}` },
      });
      const data = await res.json();
      setSyncResult(`✅ Checked ${data.checked} games · Updated ${data.updated}`);
    } catch {
      setSyncResult("❌ Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function saveResult(gameId: string) {
    const input = resultInputs[gameId];
    if (!input?.winnerId) return;

    setSavingId(gameId);
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId: input.winnerId,
          score1: parseInt(input.score1) || 0,
          score2: parseInt(input.score2) || 0,
        }),
      });
      if (res.ok) {
        setLocalGames((prev) =>
          prev.map((g) =>
            g.gameId === gameId
              ? { ...g, winnerId: input.winnerId, status: "final",
                  score1: parseInt(input.score1) || 0,
                  score2: parseInt(input.score2) || 0 }
              : g
          )
        );
        setResultInputs((prev) => { const n = { ...prev }; delete n[gameId]; return n; });
      }
    } finally {
      setSavingId(null);
    }
  }

  const roundGames = localGames
    .filter((g) => g.round === activeRound)
    .sort((a, b) => a.bracketSlot - b.bracketSlot);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-xs text-yellow-500 uppercase tracking-widest mb-1">⚡ Admin</p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            Game Results
          </h1>
          <p className="text-gray-500 font-mono text-sm mt-1">
            {tournament.name} · Status:{" "}
            <span className={clsx(
              tournament.status === "active" ? "text-green-400" :
              tournament.status === "complete" ? "text-gray-400" : "text-yellow-400"
            )}>
              {tournament.status}
            </span>
          </p>
        </div>

        {/* ESPN sync */}
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={triggerEspnSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <RefreshCwIcon className={clsx("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? "Syncing ESPN..." : "Sync from ESPN"}
          </button>
          {syncResult && (
            <p className="text-xs font-mono text-gray-500">{syncResult}</p>
          )}
        </div>
      </div>

      {/* Round tabs */}
      <div className="flex gap-1 border-b border-hardwood-600 overflow-x-auto">
        {ROUND_ORDER.map((round) => {
          const count = localGames.filter((g) => g.round === round).length;
          const done = localGames.filter((g) => g.round === round && g.status === "final").length;
          return (
            <button
              key={round}
              onClick={() => setActiveRound(round)}
              className={clsx(
                "flex-shrink-0 px-4 py-2.5 text-sm font-display font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px whitespace-nowrap",
                activeRound === round
                  ? "text-court-400 border-court-500"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              )}
            >
              {ROUND_LABELS[round]}
              {count > 0 && (
                <span className={clsx(
                  "ml-2 text-[10px] font-mono",
                  done === count ? "text-green-500" : "text-gray-600"
                )}>
                  {done}/{count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Games list */}
      <div className="space-y-3">
        {roundGames.length === 0 && (
          <p className="text-gray-600 font-mono text-sm py-8 text-center">
            No games in this round yet.
          </p>
        )}
        {roundGames.map((game) => {
          const team1 = game.team1Id ? teamsMap.get(game.team1Id) : null;
          const team2 = game.team2Id ? teamsMap.get(game.team2Id) : null;
          const input = resultInputs[game.gameId];
          const isFinal = game.status === "final";

          return (
            <div
              key={game.gameId}
              className={clsx(
                "bg-hardwood-800 border rounded-xl p-4",
                isFinal ? "border-green-900/50" : "border-hardwood-600"
              )}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Teams */}
                <div className="flex items-center gap-3">
                  <div className="text-sm font-body">
                    <span className={clsx(
                      "font-display font-bold uppercase",
                      isFinal && game.winnerId === game.team1Id ? "text-green-400" : "text-white"
                    )}>
                      {team1 ? `#${team1.seed} ${team1.name}` : "TBD"}
                    </span>
                    <span className="text-gray-600 mx-2 font-mono">vs</span>
                    <span className={clsx(
                      "font-display font-bold uppercase",
                      isFinal && game.winnerId === game.team2Id ? "text-green-400" : "text-white"
                    )}>
                      {team2 ? `#${team2.seed} ${team2.name}` : "TBD"}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-gray-600">
                    {game.region} · Slot {game.bracketSlot}
                  </span>
                </div>

                {/* Result entry or final score */}
                {isFinal ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
                    <CheckCircleIcon className="w-4 h-4" />
                    Final: {game.score1} – {game.score2}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Winner select */}
                    <select
                      value={input?.winnerId ?? ""}
                      onChange={(e) =>
                        setResultInputs((prev) => ({
                          ...prev,
                          [game.gameId]: { ...prev[game.gameId], winnerId: e.target.value, score1: prev[game.gameId]?.score1 ?? "", score2: prev[game.gameId]?.score2 ?? "" },
                        }))
                      }
                      disabled={!team1 || !team2}
                      className="bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-3 py-1.5 text-white text-sm font-body outline-none"
                    >
                      <option value="">-- Winner --</option>
                      {team1 && <option value={team1.id}>{team1.name}</option>}
                      {team2 && <option value={team2.id}>{team2.name}</option>}
                    </select>

                    {/* Scores */}
                    <input
                      type="number"
                      placeholder={team1?.shortName ?? "T1"}
                      value={input?.score1 ?? ""}
                      onChange={(e) =>
                        setResultInputs((prev) => ({
                          ...prev,
                          [game.gameId]: { ...prev[game.gameId] ?? { winnerId: "", score2: "" }, score1: e.target.value },
                        }))
                      }
                      className="w-20 bg-hardwood-700 border border-hardwood-500 rounded-lg px-2 py-1.5 text-white text-sm font-mono text-center outline-none focus:border-court-500"
                    />
                    <span className="text-gray-600 font-mono">–</span>
                    <input
                      type="number"
                      placeholder={team2?.shortName ?? "T2"}
                      value={input?.score2 ?? ""}
                      onChange={(e) =>
                        setResultInputs((prev) => ({
                          ...prev,
                          [game.gameId]: { ...prev[game.gameId] ?? { winnerId: "", score1: "" }, score2: e.target.value },
                        }))
                      }
                      className="w-20 bg-hardwood-700 border border-hardwood-500 rounded-lg px-2 py-1.5 text-white text-sm font-mono text-center outline-none focus:border-court-500"
                    />

                    <button
                      onClick={() => saveResult(game.gameId)}
                      disabled={!input?.winnerId || savingId === game.gameId}
                      className="bg-court-500 hover:bg-court-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                    >
                      {savingId === game.gameId ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

HEREDOC_END

mkdir -p "app/(app)/admin"
cat > 'app/(app)/admin/page.tsx' << 'HEREDOC_END'
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { AdminPageClient } from "./AdminPageClient";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!(session.user as any).isAdmin) redirect("/dashboard");

  const [games, teams, tournament] = await Promise.all([
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
    getTournament(TOURNAMENT_ID),
  ]);

  return (
    <AdminPageClient
      games={games}
      teams={teams}
      tournament={tournament!}
    />
  );
}

HEREDOC_END

mkdir -p "app/(app)/bracket/[id]"
cat > 'app/(app)/bracket/[id]/BracketPageClient.tsx' << 'HEREDOC_END'
"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import type { Game, Team, Picks, Tournament } from "@/lib/types";
import { SaveIcon, LockIcon, RefreshCwIcon } from "lucide-react";
import { clsx } from "clsx";

interface BracketPageClientProps {
  bracketId: string;
  userId: string;
  bracketUserId: string;
  bracketName: string;
  initialPicks: Picks;
}

type SaveState = "saved" | "saving" | "unsaved" | "error";

export function BracketPageClient({
  bracketId,
  userId,
  bracketUserId,
  bracketName,
  initialPicks,
}: BracketPageClientProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const isOwner = userId === bracketUserId;
  const isLocked = tournament
    ? new Date() > new Date(tournament.lockDate) && tournament.status !== "pending"
    : false;
  const canEdit = isOwner && !isLocked;

  // Load tournament data
  useEffect(() => {
    fetch("/api/tournament")
      .then((r) => r.json())
      .then(({ tournament, games, teams: teamsArr }) => {
        setTournament(tournament);
        setGames(games ?? []);
        setTeams(new Map((teamsArr ?? []).map((t: Team) => [t.id, t])));
      })
      .finally(() => setLoading(false));
  }, []);

  // Poll for game updates every 60s when tournament is active
  useEffect(() => {
    if (tournament?.status !== "active") return;
    const interval = setInterval(() => {
      fetch("/api/tournament")
        .then((r) => r.json())
        .then(({ games }) => setGames(games ?? []));
    }, 60_000);
    return () => clearInterval(interval);
  }, [tournament?.status]);

  // Auto-save picks with 800ms debounce
  const savePicks = useCallback(async (newPicks: Picks) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/bracket/${bracketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: newPicks }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, [bracketId]);

  const handlePick = useCallback((gameId: string, teamId: string) => {
    setPicks((prev) => {
      const next = { ...prev, [gameId]: teamId };

      // Debounced save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState("unsaved");
      saveTimer.current = setTimeout(() => savePicks(next), 800);

      return next;
    });
  }, [savePicks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 font-mono text-sm animate-pulse">
        Loading bracket...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-court-500 text-xs uppercase tracking-widest mb-0.5">
            {isOwner ? "Your Bracket" : "Viewing Bracket"}
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
            {bracketName}
          </h1>
        </div>

        {/* Save status badge */}
        {canEdit && (
          <div className={clsx(
            "flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border transition-all",
            saveState === "saved"   && "text-green-400 border-green-900 bg-green-950/30",
            saveState === "saving"  && "text-yellow-400 border-yellow-900 bg-yellow-950/30",
            saveState === "unsaved" && "text-gray-400 border-hardwood-600 bg-hardwood-800",
            saveState === "error"   && "text-red-400 border-red-900 bg-red-950/30",
          )}>
            {saveState === "saving"  && <RefreshCwIcon className="w-3 h-3 animate-spin" />}
            {saveState === "saved"   && <SaveIcon className="w-3 h-3" />}
            {saveState === "unsaved" && <SaveIcon className="w-3 h-3" />}
            {saveState === "saving"  ? "Saving..." :
             saveState === "saved"   ? "Saved" :
             saveState === "error"   ? "Save failed" : "Unsaved changes"}
          </div>
        )}

        {isLocked && (
          <div className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border text-red-400 border-red-900 bg-red-950/30">
            <LockIcon className="w-3 h-3" />
            Picks locked
          </div>
        )}
      </div>

      {/* Bracket */}
      <BracketView
        games={games}
        teams={teams}
        picks={picks}
        onPick={canEdit ? handlePick : undefined}
        isReadOnly={!canEdit}
      />
    </div>
  );
}

HEREDOC_END

mkdir -p "app/(app)/bracket/[id]"
cat > 'app/(app)/bracket/[id]/page.tsx' << 'HEREDOC_END'
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { notFound, redirect } from "next/navigation";
import { BracketPageClient } from "./BracketPageClient";

export default async function BracketPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
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
    />
  );
}

HEREDOC_END

mkdir -p "app/(app)/bracket/new"
cat > 'app/(app)/bracket/new/page.tsx' << 'HEREDOC_END'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

export default function NewBracketPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("Give your bracket a name."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      router.push(`/bracket/${data.bracketId}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto pt-16 animate-fade-in">
      <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white mb-2">
        New Bracket
      </h1>
      <p className="text-gray-500 font-body mb-8">
        Give it a name — you can always update it later.
      </p>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">
            Bracket Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. My Cinderella Bracket"
            maxLength={60}
            className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-3 text-white font-body placeholder-gray-600 outline-none transition-colors"
          />
          {error && <p className="text-red-400 text-xs font-mono mt-2">{error}</p>}
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="w-full flex items-center justify-center gap-2 bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-wide py-3 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          {loading ? "Creating..." : "Create Bracket"}
        </button>
      </div>
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

mkdir -p "app/(app)/groups"
cat > 'app/(app)/groups/page.tsx' << 'HEREDOC_END'
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getGroupsByUser } from "@/lib/dynamo/queries/groups";
import Link from "next/link";
import { PlusIcon, UsersIcon, LinkIcon } from "lucide-react";

export default async function GroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).userId as string;
  const groups = await getGroupsByUser(userId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
            March Madness
          </p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            Groups
          </h1>
        </div>
        <Link
          href="/groups/new"
          className="flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white font-display font-bold uppercase tracking-wide text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-16 text-center">
          <UsersIcon className="w-12 h-12 text-hardwood-600 mx-auto mb-4" />
          <p className="text-gray-500 font-body mb-2">No groups yet.</p>
          <p className="text-gray-600 text-sm font-body mb-6">
            Create a group and share the invite link with your friends.
          </p>
          <Link
            href="/groups/new"
            className="inline-flex items-center gap-2 bg-court-500 hover:bg-court-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <PlusIcon className="w-4 h-4" /> Create your first group
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link key={group.groupId} href={`/groups/${group.groupId}`}>
              <div className="bg-hardwood-800 border border-hardwood-600 hover:border-court-500 rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl group">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white group-hover:text-court-400 transition-colors">
                    {group.name}
                  </h2>
                  {group.adminUserId === userId && (
                    <span className="text-xs font-mono text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-gray-600">
                  <LinkIcon className="w-3 h-3" />
                  <span>Invite link available</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

HEREDOC_END

mkdir -p "app/(app)/groups/[id]"
cat > 'app/(app)/groups/[id]/GroupPageClient.tsx' << 'HEREDOC_END'
"use client";
import { useState } from "react";
import type { Group, LeaderboardEntry } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import { CopyIcon, CheckIcon, RefreshCwIcon, TrophyIcon, LinkIcon, SettingsIcon } from "lucide-react";

interface GroupPageClientProps {
  group: Group;
  leaderboard: LeaderboardEntry[];
  currentUserId: string;
  isGroupAdmin: boolean;
}

export function GroupPageClient({ group, leaderboard, currentUserId, isGroupAdmin }: GroupPageClientProps) {
  const [inviteToken, setInviteToken] = useState(group.inviteToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/groups/join/${inviteToken}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateInvite() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateInvite: true }),
      });
      const data = await res.json();
      if (data.inviteToken) setInviteToken(data.inviteToken);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">Group</p>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
            {group.name}
          </h1>
        </div>
        {isGroupAdmin && (
          <Link
            href={`/groups/${group.groupId}/settings`}
            className="flex items-center gap-2 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-gray-300 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </Link>
        )}
      </div>

      {/* Invite link card */}
      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-4 h-4 text-court-500" />
          <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white">
            Invite Link
          </h2>
        </div>
        <p className="text-xs text-gray-500 font-body mb-3">
          Share this link with friends. Anyone with it can join this group.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 bg-hardwood-700 border border-hardwood-500 rounded-lg px-3 py-2 font-mono text-xs text-gray-400 truncate">
            {inviteUrl}
          </div>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 bg-court-500 hover:bg-court-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          {isGroupAdmin && (
            <button
              onClick={regenerateInvite}
              disabled={regenerating}
              className="flex items-center gap-1.5 bg-hardwood-700 hover:bg-hardwood-600 border border-hardwood-500 text-gray-400 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
              title="Regenerate invite link (invalidates old one)"
            >
              <RefreshCwIcon className={clsx("w-3.5 h-3.5", regenerating && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrophyIcon className="w-5 h-5 text-court-500" />
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
            Standings
          </h2>
        </div>

        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-4 px-6 py-3 border-b border-hardwood-600 bg-hardwood-700">
            <span className="font-mono text-xs text-gray-600 uppercase">#</span>
            <span className="font-mono text-xs text-gray-600 uppercase">Player</span>
            <span className="font-mono text-xs text-gray-600 uppercase text-right">Score</span>
            <span className="font-mono text-xs text-gray-600 uppercase text-right">Max</span>
            <span className="font-mono text-xs text-gray-600 uppercase text-right">Correct</span>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-12 text-center text-gray-600 font-body">
              No brackets submitted yet.
            </div>
          ) : (
            <div className="divide-y divide-hardwood-700">
              {leaderboard.map((entry) => (
                <LeaderboardRow
                  key={entry.bracketId}
                  entry={entry}
                  isCurrentUser={entry.userId === currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scoring rules summary */}
      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-5">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-white mb-3">
          Scoring Rules
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {(Object.entries(group.scoringRules.rounds) as [string, any][]).map(([round, rule]) => (
            <div key={round} className="text-center">
              <p className="font-mono text-xs text-gray-600 mb-1">{round}</p>
              <p className="font-display font-bold text-white text-lg">{rule.basePoints}</p>
              {rule.upsetMultiplier > 0 && (
                <p className="font-mono text-[10px] text-court-500">+upset×{rule.upsetMultiplier}</p>
              )}
            </div>
          ))}
        </div>
        {group.scoringRules.bonuses.correctChampion > 0 && (
          <p className="text-xs font-mono text-gray-500 mt-3 pt-3 border-t border-hardwood-600">
            🏆 Champion bonus: +{group.scoringRules.bonuses.correctChampion} pts
          </p>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <Link href={`/bracket/${entry.bracketId}`}>
      <div className={clsx(
        "grid grid-cols-[3rem_1fr] md:grid-cols-[3rem_1fr_5rem_5rem_5rem]",
        "gap-4 px-6 py-4 items-center hover:bg-hardwood-700 transition-colors cursor-pointer",
        isCurrentUser && "bg-court-500/5 hover:bg-court-500/10"
      )}>
        {/* Rank */}
        <span className="font-display text-xl font-black text-gray-400">
          {medals[entry.rank] ?? entry.rank}
        </span>

        {/* Player */}
        <div className="flex items-center gap-3 min-w-0">
          {entry.userPicture ? (
            <Image src={entry.userPicture} alt={entry.userName} width={32} height={32} className="rounded-full flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-hardwood-600 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className={clsx(
              "font-display font-bold uppercase tracking-wide text-sm truncate",
              isCurrentUser ? "text-court-400" : "text-white"
            )}>
              {entry.userName}
              {isCurrentUser && <span className="ml-2 text-[10px] text-court-600 normal-case font-mono">you</span>}
            </p>
            <p className="text-xs text-gray-600 font-body truncate">{entry.bracketName}</p>
          </div>
        </div>

        {/* Score */}
        <div className="hidden md:flex flex-col items-end">
          <span className="font-mono text-xl font-bold text-white">{entry.score}</span>
        </div>

        {/* Max */}
        <div className="hidden md:flex flex-col items-end">
          <span className="font-mono text-sm text-gray-500">{entry.maxPossibleScore}</span>
        </div>

        {/* Correct */}
        <div className="hidden md:flex flex-col items-end">
          <span className="font-mono text-sm text-gray-400">{entry.correctPicks}/{entry.totalPicks}</span>
        </div>
      </div>
    </Link>
  );
}

HEREDOC_END

mkdir -p "app/(app)/groups/[id]"
cat > 'app/(app)/groups/[id]/page.tsx' << 'HEREDOC_END'
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroup, getGroupMembers, getGroupMembership } from "@/lib/dynamo/queries/groups";
import { getBracket } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { GroupPageClient } from "./GroupPageClient";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).userId as string;
  const isAdmin = (session.user as any).isAdmin as boolean;

  const group = await getGroup(params.id);
  if (!group) notFound();

  const membership = await getGroupMembership(params.id, userId);
  if (!membership && group.adminUserId !== userId && !isAdmin) {
    redirect("/dashboard");
  }

  const members = await getGroupMembers(params.id);

  const bracketIds = members.map((m) => m.bracketId).filter(Boolean);
  const brackets = (await Promise.all(bracketIds.map((id) => getBracket(id)))).filter(Boolean);

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
    brackets as any[],
    usersMap,
    games,
    teamsMap,
    group.scoringRules
  );

  return (
    <GroupPageClient
      group={group}
      leaderboard={leaderboard}
      currentUserId={userId}
      isGroupAdmin={group.adminUserId === userId}
    />
  );
}

HEREDOC_END

mkdir -p "app/(app)/groups/join/[token]"
cat > 'app/(app)/groups/join/[token]/page.tsx' << 'HEREDOC_END'
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Bracket } from "@/lib/types";

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selectedBracket, setSelectedBracket] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");

  // Fetch user's brackets so they can pick which one to enter
  useEffect(() => {
    fetch("/api/bracket").then((r) => r.json()).then(setBrackets);
  }, []);

  async function handleJoin() {
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, bracketId: selectedBracket }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to join."); return; }
      router.push(`/groups/${data.group.groupId}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="max-w-md mx-auto pt-16 animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🏀</div>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-white mb-2">
          You're Invited!
        </h1>
        <p className="text-gray-500 font-body">
          Join a March Madness bracket group.
        </p>
      </div>

      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-5">
        {brackets.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 font-body text-sm mb-4">
              You need a bracket first before joining a group.
            </p>
            <a
              href="/bracket/new"
              className="inline-block bg-court-500 hover:bg-court-600 text-white font-display font-bold uppercase px-5 py-2.5 rounded-lg transition-colors"
            >
              Create a Bracket First
            </a>
          </div>
        ) : (
          <>
            <div>
              <label className="block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">
                Select Your Bracket
              </label>
              <select
                value={selectedBracket}
                onChange={(e) => setSelectedBracket(e.target.value)}
                className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-3 text-white font-body outline-none transition-colors"
              >
                <option value="">-- Choose a bracket --</option>
                {brackets.map((b) => (
                  <option key={b.bracketId} value={b.bracketId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

            <button
              onClick={handleJoin}
              disabled={joining || !selectedBracket}
              className="w-full bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors"
            >
              {joining ? "Joining..." : "Join Group"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

HEREDOC_END

mkdir -p "app/(app)/groups/new"
cat > 'app/(app)/groups/new/page.tsx' << 'HEREDOC_END'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoringRules, Round } from "@/lib/types";
import { DEFAULT_SCORING_RULES, UPSET_SCORING_RULES } from "@/lib/types";
import { clsx } from "clsx";

const ROUND_LABELS: Record<Round, string> = {
  R64: "Rd of 64", R32: "Rd of 32", S16: "Sweet 16",
  E8: "Elite 8", F4: "Final Four", NCG: "Championship",
};

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scoringPreset, setScoringPreset] = useState<"standard" | "upset" | "custom">("standard");
  const [scoringRules, setScoringRules] = useState<ScoringRules>(DEFAULT_SCORING_RULES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function applyPreset(preset: "standard" | "upset" | "custom") {
    setScoringPreset(preset);
    if (preset === "standard") setScoringRules(DEFAULT_SCORING_RULES);
    if (preset === "upset") setScoringRules(UPSET_SCORING_RULES);
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Group name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scoringRules }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create group."); return; }
      router.push(`/groups/${data.groupId}`);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto pt-8 animate-fade-in">
      <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white mb-8">
        New Group
      </h1>

      <div className="space-y-6">
        {/* Group name */}
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6">
          <label className="block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2">
            Group Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office Bracket Challenge"
            maxLength={60}
            className="w-full bg-hardwood-700 border border-hardwood-500 focus:border-court-500 rounded-lg px-4 py-3 text-white font-body placeholder-gray-600 outline-none transition-colors"
          />
        </div>

        {/* Scoring rules */}
        <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">
            Scoring Rules
          </h2>

          {/* Presets */}
          <div className="flex gap-2 flex-wrap">
            {(["standard", "upset", "custom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={clsx(
                  "px-4 py-1.5 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all",
                  scoringPreset === p
                    ? "bg-court-500 text-white"
                    : "bg-hardwood-700 text-gray-400 border border-hardwood-500 hover:text-white"
                )}
              >
                {p === "standard" && "Standard"}
                {p === "upset" && "🔥 Upset Bonus"}
                {p === "custom" && "Custom"}
              </button>
            ))}
          </div>

          <p className="text-xs font-body text-gray-600">
            {scoringPreset === "standard" && "Simple points per correct pick, doubling each round."}
            {scoringPreset === "upset" && "Bonus points when lower seeds win — rewards risky picks."}
            {scoringPreset === "custom" && "Edit points per round below."}
          </p>

          {/* Round points table */}
          <div className="space-y-2">
            {(Object.keys(ROUND_LABELS) as Round[]).map((round) => (
              <div key={round} className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-gray-500 w-28">{ROUND_LABELS[round]}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600 font-mono">pts</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={scoringRules.rounds[round].basePoints}
                      disabled={scoringPreset !== "custom"}
                      onChange={(e) =>
                        setScoringRules((prev) => ({
                          ...prev,
                          rounds: {
                            ...prev.rounds,
                            [round]: {
                              ...prev.rounds[round],
                              basePoints: parseInt(e.target.value) || 0,
                            },
                          },
                        }))
                      }
                      className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600 font-mono">upset×</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={scoringRules.rounds[round].upsetMultiplier}
                      disabled={scoringPreset !== "custom"}
                      onChange={(e) =>
                        setScoringRules((prev) => ({
                          ...prev,
                          rounds: {
                            ...prev.rounds,
                            [round]: {
                              ...prev.rounds[round],
                              upsetMultiplier: parseFloat(e.target.value) || 0,
                            },
                          },
                        }))
                      }
                      className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Champion bonus */}
          <div className="pt-3 border-t border-hardwood-600 flex items-center justify-between gap-4">
            <span className="font-mono text-xs text-gray-500">🏆 Champion Bonus</span>
            <input
              type="number"
              min={0}
              max={999}
              value={scoringRules.bonuses.correctChampion}
              disabled={scoringPreset !== "custom"}
              onChange={(e) =>
                setScoringRules((prev) => ({
                  ...prev,
                  bonuses: {
                    ...prev.bonuses,
                    correctChampion: parseInt(e.target.value) || 0,
                  },
                }))
              }
              className="w-16 bg-hardwood-700 border border-hardwood-500 rounded px-2 py-1 text-white text-sm font-mono text-center disabled:opacity-40 outline-none focus:border-court-500"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="w-full bg-court-500 hover:bg-court-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-wide py-3.5 rounded-xl transition-colors text-lg"
        >
          {loading ? "Creating..." : "Create Group"}
        </button>
      </div>
    </div>
  );
}

HEREDOC_END

mkdir -p "app/(app)/leaderboard"
cat > 'app/(app)/leaderboard/page.tsx' << 'HEREDOC_END'
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBracketsByTournament } from "@/lib/dynamo/queries/brackets";
import { getAllGames, getAllTeams, getTournament } from "@/lib/dynamo/queries/games";
import { getUser } from "@/lib/dynamo/queries/users";
import { buildLeaderboard } from "@/lib/scoring/engine";
import { DEFAULT_SCORING_RULES } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import type { LeaderboardEntry } from "@/lib/types";

const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const currentUserId = (session.user as any).userId as string;

  const [brackets, games, teams, tournament] = await Promise.all([
    getBracketsByTournament(TOURNAMENT_ID),
    getAllGames(TOURNAMENT_ID),
    getAllTeams(TOURNAMENT_ID),
    getTournament(TOURNAMENT_ID),
  ]);

  const userRecords = await Promise.all(
    brackets.map(async (b) => {
      const u = await getUser(b.userId);
      return [b.userId, { name: u?.name ?? "Unknown", picture: u?.picture ?? "" }] as const;
    })
  );
  const usersMap = new Map(userRecords);
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const leaderboard = buildLeaderboard(
    brackets,
    usersMap,
    games,
    teamsMap,
    DEFAULT_SCORING_RULES
  );

  const completedGames = games.filter((g) => g.status === "final").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-1">
          {tournament?.name ?? "Tournament"}
        </p>
        <h1 className="font-display text-5xl font-black uppercase tracking-tight text-white">
          Leaderboard
        </h1>
        <p className="text-gray-500 text-sm font-mono mt-1">
          {completedGames} games complete · {brackets.length} brackets
        </p>
      </div>

      {/* Table */}
      <div className="bg-hardwood-800 border border-hardwood-600 rounded-2xl overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem] gap-4 px-6 py-3 border-b border-hardwood-600 bg-hardwood-700">
          <span className="font-mono text-xs text-gray-600 uppercase">#</span>
          <span className="font-mono text-xs text-gray-600 uppercase">Player</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Score</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Max</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Correct</span>
          <span className="font-mono text-xs text-gray-600 uppercase text-right">Status</span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-gray-600 font-body">
            No brackets submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-hardwood-700">
            {leaderboard.map((entry) => (
              <LeaderboardRow
                key={entry.bracketId}
                entry={entry}
                isCurrentUser={entry.userId === currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  const rankColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-300",
    3: "text-amber-600",
  };

  return (
    <Link href={`/bracket/${entry.bracketId}`}>
      <div
        className={clsx(
          "grid grid-cols-[3rem_1fr] md:grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem]",
          "gap-4 px-6 py-4 items-center hover:bg-hardwood-700 transition-colors",
          isCurrentUser && "bg-court-500/5 hover:bg-court-500/10"
        )}
      >
        {/* Rank */}
        <span
          className={clsx(
            "font-display text-2xl font-black",
            rankColors[entry.rank] ?? "text-gray-600"
          )}
        >
          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
        </span>

        {/* Player */}
        <div className="flex items-center gap-3 min-w-0">
          {entry.userPicture ? (
            <Image
              src={entry.userPicture}
              alt={entry.userName}
              width={36}
              height={36}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-hardwood-600 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className={clsx(
              "font-display font-bold uppercase tracking-wide truncate",
              isCurrentUser ? "text-court-400" : "text-white"
            )}>
              {entry.userName}
              {isCurrentUser && (
                <span className="ml-2 text-xs text-court-600 normal-case font-mono">you</span>
              )}
            </p>
            <p className="text-xs text-gray-600 font-body truncate">{entry.bracketName}</p>
          </div>
        </div>

        {/* Score */}
        <div className="hidden md:block text-right">
          <span className="font-mono text-xl font-bold text-white">{entry.score}</span>
        </div>

        {/* Max possible */}
        <div className="hidden md:block text-right">
          <span className="font-mono text-sm text-gray-500">{entry.maxPossibleScore}</span>
        </div>

        {/* Correct picks */}
        <div className="hidden md:block text-right">
          <span className="font-mono text-sm text-gray-400">
            {entry.correctPicks}/{entry.totalPicks}
          </span>
        </div>

        {/* Status */}
        <div className="hidden md:block text-right">
          {entry.maxPossibleScore === entry.score && entry.score > 0 ? (
            <span className="text-xs font-mono text-red-400">Eliminated</span>
          ) : (
            <span className="text-xs font-mono text-green-400">Alive</span>
          )}
        </div>
      </div>
    </Link>
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
cat > 'components/bracket/BracketPageClient.tsx' << 'HEREDOC_END'
"use client";

import { useState, useCallback, useRef } from "react";
import { BracketView } from "@/components/bracket/BracketView";
import type { Game, Team, Picks, Tournament } from "@/lib/types";
import { clsx } from "clsx";
import { SaveIcon, LockIcon } from "lucide-react";

interface BracketPageClientProps {
  bracketId: string;
  bracketName: string;
  initialPicks: Picks;
  games: Game[];
  teams: Team[];
  tournament: Tournament;
  isOwner: boolean;
  userId: string;
}

export function BracketPageClient({
  bracketId,
  bracketName,
  initialPicks,
  games,
  teams,
  tournament,
  isOwner,
  userId,
}: BracketPageClientProps) {
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLocked =
    tournament.status === "active" &&
    new Date() > new Date(tournament.lockDate);

  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  const handlePick = useCallback(
    (gameId: string, teamId: string) => {
      if (!isOwner || isLocked) return;

      setPicks((prev) => {
        const updated = { ...prev, [gameId]: teamId };

        // Cascade: if this pick contradicts a downstream pick, clear it
        const cascaded = cascadePicks(updated, games, teamId, gameId);

        // Debounced save
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSaveState("saving");
        saveTimer.current = setTimeout(async () => {
          try {
            const res = await fetch(`/api/bracket/${bracketId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ picks: cascaded }),
            });
            if (!res.ok) throw new Error();
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2000);
          } catch {
            setSaveState("error");
          }
        }, 600);

        return cascaded;
      });
    },
    [isOwner, isLocked, bracketId, games]
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs text-court-500 uppercase tracking-widest mb-0.5">
            {tournament.name}
          </p>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-white">
            {bracketName}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {isLocked && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-1.5 rounded-lg">
              <LockIcon className="w-3 h-3" />
              Picks locked
            </div>
          )}

          {isOwner && !isLocked && (
            <div
              className={clsx(
                "flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-all",
                saveState === "idle"    && "text-gray-600",
                saveState === "saving"  && "text-yellow-400 bg-yellow-400/10",
                saveState === "saved"   && "text-green-400 bg-green-400/10",
                saveState === "error"   && "text-red-400 bg-red-400/10"
              )}
            >
              <SaveIcon className="w-3 h-3" />
              {saveState === "idle"    && "Auto-saves"}
              {saveState === "saving"  && "Saving..."}
              {saveState === "saved"   && "Saved ✓"}
              {saveState === "error"   && "Save failed"}
            </div>
          )}

          {/* Pick counter */}
          <div className="font-mono text-xs text-gray-500 bg-hardwood-800 border border-hardwood-600 px-3 py-1.5 rounded-lg">
            {Object.keys(picks).length} / {games.length} picks
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {isOwner && !isLocked && (
        <div className="h-1 bg-hardwood-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-court-500 rounded-full transition-all duration-300"
            style={{
              width: `${(Object.keys(picks).length / Math.max(games.length, 1)) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Bracket */}
      <BracketView
        games={games}
        teams={teamsMap}
        picks={picks}
        isOwner={isOwner}
        isLocked={isLocked}
        onPick={handlePick}
        viewOnly={!isOwner}
      />
    </div>
  );
}

/**
 * When a user makes a pick, cascade forward to clear any picks that
 * are now impossible (the team they didn't pick can't advance).
 */
function cascadePicks(picks: Picks, games: Game[], pickedTeamId: string, gameId: string): Picks {
  const updated = { ...picks };
  const game = games.find((g) => g.gameId === gameId);
  if (!game || !game.nextGameId) return updated;

  // The other team in this game
  const eliminatedTeamId =
    game.team1Id === pickedTeamId ? game.team2Id : game.team1Id;

  // Find all future games where the eliminated team was picked
  function clearDownstream(eliminatedId: string | null) {
    if (!eliminatedId) return;
    for (const g of games) {
      if (updated[g.gameId] === eliminatedId) {
        delete updated[g.gameId];
        // Recursively clear games that depended on this pick
        clearDownstream(eliminatedId);
      }
    }
  }

  clearDownstream(eliminatedTeamId);
  return updated;
}

HEREDOC_END

mkdir -p "components/bracket"
cat > 'components/bracket/BracketRegion.tsx' << 'HEREDOC_END'
"use client";
import type { Game, Team, Picks, Region, Round } from "@/lib/types";
import { GameSlot } from "./GameSlot";

interface BracketRegionProps {
  region: Region;
  games: Game[];
  teams: Map<string, Team>;
  picks: Picks;
  onPick?: (gameId: string, teamId: string) => void;
  onGameClick: (gameId: string) => void;
  isReadOnly: boolean;
  layout: "horizontal" | "vertical";
  mirrored?: boolean; // flip round order for right-side regions on desktop
}

// Rounds within a region (excludes FinalFour/NCG)
const REGION_ROUNDS: Round[] = ["R64", "R32", "S16", "E8"];
const ROUND_LABELS: Record<Round, string> = {
  R64: "First Round",
  R32: "Round of 32",
  S16: "Sweet 16",
  E8:  "Elite Eight",
  F4:  "Final Four",
  NCG: "Championship",
};

export function BracketRegion({
  region,
  games,
  teams,
  picks,
  onPick,
  onGameClick,
  isReadOnly,
  layout,
  mirrored = false,
}: BracketRegionProps) {
  const rounds = mirrored ? [...REGION_ROUNDS].reverse() : REGION_ROUNDS;

  const gamesByRound = (round: Round) =>
    games
      .filter((g) => g.round === round)
      .sort((a, b) => a.bracketSlot - b.bracketSlot);

  // ── Vertical layout (mobile) ──────────────────────────────────────────────
  if (layout === "vertical") {
    return (
      <div className="space-y-6">
        {REGION_ROUNDS.map((round) => {
          const roundGames = gamesByRound(round);
          if (roundGames.length === 0) return null;
          return (
            <div key={round}>
              <p className="font-display text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">
                {ROUND_LABELS[round]}
              </p>
              <div className="space-y-2">
                {roundGames.map((game) => (
                  <GameSlot
                    key={game.gameId}
                    game={game}
                    teams={teams}
                    picks={picks}
                    onPick={onPick}
                    onInfoClick={() => onGameClick(game.gameId)}
                    isReadOnly={isReadOnly}
                    size="md"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Horizontal layout (desktop) ───────────────────────────────────────────
  // Each round has half as many games as the previous.
  // We space them out vertically so the bracket "tree" connects properly.
  return (
    <div className="flex gap-1">
      {rounds.map((round) => {
        const roundGames = gamesByRound(round);
        const totalSlots = Math.pow(2, REGION_ROUNDS.indexOf(round) === -1
          ? 0
          : REGION_ROUNDS.length - 1 - REGION_ROUNDS.indexOf(round));

        // Number of "spacer units" above and between each game
        const gapUnits = totalSlots / roundGames.length;

        return (
          <div key={round} className="flex flex-col flex-1 min-w-[120px]">
            <p className="font-display text-[9px] font-bold uppercase tracking-widest text-gray-700 mb-1 text-center truncate px-1">
              {ROUND_LABELS[round]}
            </p>
            <div className="flex flex-col flex-1 justify-around gap-1">
              {roundGames.map((game, i) => (
                <div
                  key={game.gameId}
                  className="flex flex-col justify-center"
                  style={{
                    // Even distribution with spacing proportional to round depth
                    marginTop: i === 0 ? `${(gapUnits - 1) * 18}px` : undefined,
                    marginBottom:
                      i === roundGames.length - 1 ? `${(gapUnits - 1) * 18}px` : undefined,
                  }}
                >
                  <GameSlot
                    game={game}
                    teams={teams}
                    picks={picks}
                    onPick={onPick}
                    onInfoClick={() => onGameClick(game.gameId)}
                    isReadOnly={isReadOnly}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

HEREDOC_END

mkdir -p "components/bracket"
cat > 'components/bracket/BracketView.tsx' << 'HEREDOC_END'
"use client";
import { useState } from "react";
import type { Game, Team, Picks, Region } from "@/lib/types";
import { BracketRegion } from "./BracketRegion";
import { FinalFourView } from "./FinalFourView";
import { GamePickModal } from "./GamePickModal";
import { clsx } from "clsx";

interface BracketViewProps {
  games: Game[];
  teams: Map<string, Team>;
  picks: Picks;
  onPick?: (gameId: string, teamId: string) => void;
  isReadOnly?: boolean;
}

const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

export function BracketView({ games, teams, picks, onPick, isReadOnly = false }: BracketViewProps) {
  const [activeTab, setActiveTab] = useState<Region | "FinalFour">("East");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const byRegion = (r: Region) => games.filter((g) => g.region === r);
  const finalFourGames = games.filter((g) => g.region === "FinalFour");

  return (
    <>
      {/* ─── Mobile: tabs ──────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="flex border-b border-hardwood-600 mb-4 overflow-x-auto">
          {([...REGIONS, "FinalFour"] as const).map((region) => (
            <button
              key={region}
              onClick={() => setActiveTab(region)}
              className={clsx(
                "flex-shrink-0 px-4 py-3 font-display font-bold uppercase text-sm tracking-wide transition-colors border-b-2 -mb-px whitespace-nowrap",
                activeTab === region
                  ? "text-court-400 border-court-500"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              )}
            >
              {region === "FinalFour" ? "F4 / Champ" : region}
            </button>
          ))}
        </div>

        <div className="animate-fade-in">
          {activeTab === "FinalFour" ? (
            <FinalFourView
              games={finalFourGames}
              teams={teams}
              picks={picks}
              onPick={onPick}
              onGameClick={setSelectedGameId}
              isReadOnly={isReadOnly}
            />
          ) : (
            <BracketRegion
              region={activeTab}
              games={byRegion(activeTab)}
              teams={teams}
              picks={picks}
              onPick={onPick}
              onGameClick={setSelectedGameId}
              isReadOnly={isReadOnly}
              layout="vertical"
            />
          )}
        </div>
      </div>

      {/* ─── Desktop: full bracket ─────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto pb-6">
        <div className="min-w-[1200px] space-y-4">
          <div className="flex gap-4">
            <RegionColumn label="East">
              <BracketRegion region="East" games={byRegion("East")} teams={teams} picks={picks}
                onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" />
            </RegionColumn>
            <RegionColumn label="West">
              <BracketRegion region="West" games={byRegion("West")} teams={teams} picks={picks}
                onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" mirrored />
            </RegionColumn>
          </div>

          <div className="flex justify-center py-2">
            <FinalFourView games={finalFourGames} teams={teams} picks={picks}
              onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} />
          </div>

          <div className="flex gap-4">
            <RegionColumn label="South">
              <BracketRegion region="South" games={byRegion("South")} teams={teams} picks={picks}
                onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" />
            </RegionColumn>
            <RegionColumn label="Midwest">
              <BracketRegion region="Midwest" games={byRegion("Midwest")} teams={teams} picks={picks}
                onPick={onPick} onGameClick={setSelectedGameId} isReadOnly={isReadOnly} layout="horizontal" mirrored />
            </RegionColumn>
          </div>
        </div>
      </div>

      <GamePickModal gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
    </>
  );
}

function RegionColumn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-gray-600 mb-2 text-center">
        {label}
      </p>
      {children}
    </div>
  );
}

HEREDOC_END

mkdir -p "components/bracket"
cat > 'components/bracket/FinalFourView.tsx' << 'HEREDOC_END'
"use client";
import type { Game, Team, Picks } from "@/lib/types";
import { GameSlot } from "./GameSlot";

interface FinalFourViewProps {
  games: Game[];
  teams: Map<string, Team>;
  picks: Picks;
  onPick?: (gameId: string, teamId: string) => void;
  onGameClick: (gameId: string) => void;
  isReadOnly: boolean;
}

export function FinalFourView({ games, teams, picks, onPick, onGameClick, isReadOnly }: FinalFourViewProps) {
  const f4Games = games.filter((g) => g.round === "F4").sort((a, b) => a.bracketSlot - b.bracketSlot);
  const ncgGame = games.find((g) => g.round === "NCG");

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Section label */}
      <div className="text-center mb-3">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-court-600">
          Final Four &amp; Championship
        </p>
      </div>

      {/* Layout: F4 game — Champion slot — F4 game */}
      <div className="flex items-center gap-3">
        {/* Left F4 game */}
        <div className="flex-1">
          {f4Games[0] ? (
            <>
              <p className="font-display text-[9px] uppercase tracking-widest text-gray-700 text-center mb-1">
                Semifinal 1
              </p>
              <GameSlot
                game={f4Games[0]}
                teams={teams}
                picks={picks}
                onPick={onPick}
                onInfoClick={() => onGameClick(f4Games[0].gameId)}
                isReadOnly={isReadOnly}
                size="md"
              />
            </>
          ) : (
            <EmptySlot label="Semifinal 1" />
          )}
        </div>

        {/* Championship + champion display */}
        <div className="flex-1 flex flex-col items-center gap-2">
          {ncgGame ? (
            <>
              <p className="font-display text-[9px] uppercase tracking-widest text-court-500 text-center">
                Championship
              </p>
              <GameSlot
                game={ncgGame}
                teams={teams}
                picks={picks}
                onPick={onPick}
                onInfoClick={() => onGameClick(ncgGame.gameId)}
                isReadOnly={isReadOnly}
                size="md"
              />
              {/* Champion crown */}
              {ncgGame.winnerId && (
                <div className="text-center mt-1">
                  <div className="text-2xl">🏆</div>
                  <p className="font-display font-black uppercase text-court-400 text-sm tracking-wide">
                    {teams.get(ncgGame.winnerId)?.name ?? "Champion"}
                  </p>
                </div>
              )}
            </>
          ) : (
            <EmptySlot label="Championship" />
          )}
        </div>

        {/* Right F4 game */}
        <div className="flex-1">
          {f4Games[1] ? (
            <>
              <p className="font-display text-[9px] uppercase tracking-widest text-gray-700 text-center mb-1">
                Semifinal 2
              </p>
              <GameSlot
                game={f4Games[1]}
                teams={teams}
                picks={picks}
                onPick={onPick}
                onInfoClick={() => onGameClick(f4Games[1].gameId)}
                isReadOnly={isReadOnly}
                size="md"
              />
            </>
          ) : (
            <EmptySlot label="Semifinal 2" />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-hardwood-600 rounded-lg p-4 text-center">
      <p className="font-display text-[9px] uppercase tracking-widest text-gray-700 mb-1">{label}</p>
      <p className="font-mono text-xs text-gray-700">TBD</p>
    </div>
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

mkdir -p "components/bracket"
cat > 'components/bracket/GameSlot.tsx' << 'HEREDOC_END'
"use client";
import type { Game, Team, Picks } from "@/lib/types";
import { InfoIcon } from "lucide-react";
import { clsx } from "clsx";

interface GameSlotProps {
  game: Game;
  teams: Map<string, Team>;
  picks: Picks;
  onPick?: (gameId: string, teamId: string) => void;
  onInfoClick: () => void;
  isReadOnly: boolean;
  size: "sm" | "md";
}

export function GameSlot({ game, teams, picks, onPick, onInfoClick, isReadOnly, size }: GameSlotProps) {
  const team1 = game.team1Id ? teams.get(game.team1Id) : null;
  const team2 = game.team2Id ? teams.get(game.team2Id) : null;
  const userPick = picks[game.gameId];
  const isComplete = game.status === "final";

  return (
    <div className="relative group">
      <div
        className={clsx(
          "bg-hardwood-800 border border-hardwood-600 rounded-lg overflow-hidden",
          "transition-all duration-150",
          !isReadOnly && "hover:border-court-600",
        )}
      >
        <TeamRow
          team={team1}
          isWinner={isComplete && game.winnerId === game.team1Id}
          isLoser={isComplete && game.winnerId !== game.team1Id && !!game.winnerId}
          isPicked={userPick === game.team1Id}
          isCorrect={isComplete && userPick === game.team1Id && game.winnerId === game.team1Id}
          isWrong={isComplete && userPick === game.team1Id && game.winnerId !== game.team1Id}
          onClick={() => !isReadOnly && game.team1Id && onPick?.(game.gameId, game.team1Id)}
          canPick={!isReadOnly && !isComplete && !!game.team1Id}
          size={size}
          score={game.score1}
        />
        <div className="border-t border-hardwood-700" />
        <TeamRow
          team={team2}
          isWinner={isComplete && game.winnerId === game.team2Id}
          isLoser={isComplete && game.winnerId !== game.team2Id && !!game.winnerId}
          isPicked={userPick === game.team2Id}
          isCorrect={isComplete && userPick === game.team2Id && game.winnerId === game.team2Id}
          isWrong={isComplete && userPick === game.team2Id && game.winnerId !== game.team2Id}
          onClick={() => !isReadOnly && game.team2Id && onPick?.(game.gameId, game.team2Id)}
          canPick={!isReadOnly && !isComplete && !!game.team2Id}
          size={size}
          score={game.score2}
        />
      </div>

      {/* Info button — triggers "who picked what" modal */}
      <button
        onClick={(e) => { e.stopPropagation(); onInfoClick(); }}
        className={clsx(
          "absolute -top-1.5 -right-1.5 bg-hardwood-700 border border-hardwood-500 rounded-full p-0.5",
          "opacity-0 group-hover:opacity-100 transition-opacity hover:bg-court-600 z-10"
        )}
        title="See who picked this game"
      >
        <InfoIcon className="w-3 h-3 text-gray-400" />
      </button>
    </div>
  );
}

function TeamRow({
  team, isWinner, isLoser, isPicked, isCorrect, isWrong,
  onClick, canPick, size, score,
}: {
  team: Team | null | undefined;
  isWinner: boolean; isLoser: boolean;
  isPicked: boolean; isCorrect: boolean; isWrong: boolean;
  onClick: () => void; canPick: boolean;
  size: "sm" | "md"; score: number | null;
}) {
  return (
    <div
      onClick={canPick ? onClick : undefined}
      className={clsx(
        "flex items-center gap-1.5 transition-colors select-none",
        size === "sm" ? "px-1.5 py-1" : "px-3 py-2.5",
        canPick && "cursor-pointer",
        isCorrect && "bg-green-950/60",
        isWrong && "bg-red-950/40 opacity-60",
        isPicked && !isCorrect && !isWrong && "bg-court-900/40",
        canPick && !isPicked && "hover:bg-hardwood-700",
        isLoser && !isPicked && "opacity-40",
      )}
    >
      {team && (
        <span className={clsx(
          "font-mono flex-shrink-0 w-4 text-right",
          size === "sm" ? "text-[9px]" : "text-xs",
          isWinner ? "text-court-400" : "text-gray-600"
        )}>
          {team.seed}
        </span>
      )}

      <span className={clsx(
        "font-display font-bold uppercase tracking-wide flex-1 truncate",
        size === "sm" ? "text-[10px]" : "text-sm",
        team ? (isWinner ? "text-white" : "text-gray-300") : "text-gray-600",
      )}>
        {team ? (size === "sm" ? team.shortName : team.name) : "TBD"}
      </span>

      {score !== null && (
        <span className={clsx(
          "font-mono flex-shrink-0",
          size === "sm" ? "text-[9px]" : "text-xs",
          isWinner ? "text-white font-bold" : "text-gray-500"
        )}>
          {score}
        </span>
      )}

      {isPicked && (
        <span className="flex-shrink-0 ml-0.5 text-[10px]">
          {isCorrect ? "✓" : isWrong ? "✗" : <span className="w-1.5 h-1.5 rounded-full bg-court-500 inline-block" />}
        </span>
      )}
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
cat > 'scripts/bracket-2026.json' << 'HEREDOC_END'
{
  "tournamentId": "2026",
  "name": "NCAA Tournament 2026",
  "year": 2026,
  "lockDate": "2026-03-19T12:00:00Z",
  "teams": [
    { "id": "duke",        "name": "Duke",           "shortName": "DUKE",   "seed": 1,  "region": "East" },
    { "id": "siena",       "name": "Siena",          "shortName": "SIEN",   "seed": 16, "region": "East" },
    { "id": "ohiost",      "name": "Ohio St.",        "shortName": "OHST",   "seed": 8,  "region": "East" },
    { "id": "tcu",         "name": "TCU",             "shortName": "TCU",    "seed": 9,  "region": "East" },
    { "id": "stjohns",     "name": "St. John's",      "shortName": "STJ",    "seed": 5,  "region": "East" },
    { "id": "niowa",       "name": "N. Iowa",         "shortName": "NIOW",   "seed": 12, "region": "East" },
    { "id": "kansas",      "name": "Kansas",          "shortName": "KU",     "seed": 4,  "region": "East" },
    { "id": "calbaptist",  "name": "Cal Baptist",     "shortName": "CBAP",   "seed": 13, "region": "East" },
    { "id": "louisville",  "name": "Louisville",      "shortName": "LOU",    "seed": 6,  "region": "East" },
    { "id": "sfla",        "name": "S. Florida",      "shortName": "SFLA",   "seed": 11, "region": "East" },
    { "id": "michst",      "name": "Michigan St.",    "shortName": "MIST",   "seed": 3,  "region": "East" },
    { "id": "ndakst",      "name": "N. Dakota St.",   "shortName": "NDST",   "seed": 14, "region": "East" },
    { "id": "ucla",        "name": "UCLA",            "shortName": "UCLA",   "seed": 7,  "region": "East" },
    { "id": "ucf",         "name": "UCF",             "shortName": "UCF",    "seed": 10, "region": "East" },
    { "id": "uconn",       "name": "UConn",           "shortName": "UCON",   "seed": 2,  "region": "East" },
    { "id": "furman",      "name": "Furman",          "shortName": "FUR",    "seed": 15, "region": "East" },

    { "id": "florida",     "name": "Florida",         "shortName": "FLA",    "seed": 1,  "region": "South" },
    { "id": "pvam",        "name": "Prairie View",    "shortName": "PVAM",   "seed": 16, "region": "South" },
    { "id": "clemson",     "name": "Clemson",         "shortName": "CLEM",   "seed": 8,  "region": "South" },
    { "id": "iowa",        "name": "Iowa",            "shortName": "IOWA",   "seed": 9,  "region": "South" },
    { "id": "vanderbilt",  "name": "Vanderbilt",      "shortName": "VAN",    "seed": 5,  "region": "South" },
    { "id": "mcneese",     "name": "McNeese",         "shortName": "MCNS",   "seed": 12, "region": "South" },
    { "id": "nebraska",    "name": "Nebraska",        "shortName": "NEB",    "seed": 4,  "region": "South" },
    { "id": "troy",        "name": "Troy",            "shortName": "TROY",   "seed": 13, "region": "South" },
    { "id": "ncarolina",   "name": "N. Carolina",     "shortName": "UNC",    "seed": 6,  "region": "South" },
    { "id": "vcu",         "name": "VCU",             "shortName": "VCU",    "seed": 11, "region": "South" },
    { "id": "illinois",    "name": "Illinois",        "shortName": "ILL",    "seed": 3,  "region": "South" },
    { "id": "penn",        "name": "Penn",            "shortName": "PENN",   "seed": 14, "region": "South" },
    { "id": "maryca",      "name": "Maryland",        "shortName": "MRCA",   "seed": 7,  "region": "South" },
    { "id": "texasam",     "name": "Texas A&M",       "shortName": "TXAM",   "seed": 10, "region": "South" },
    { "id": "houston",     "name": "Houston",         "shortName": "HOU",    "seed": 2,  "region": "South" },
    { "id": "idaho",       "name": "Idaho",           "shortName": "IDHO",   "seed": 15, "region": "South" },

    { "id": "arizona",     "name": "Arizona",         "shortName": "ARIZ",   "seed": 1,  "region": "West" },
    { "id": "liu",         "name": "LIU",             "shortName": "LIU",    "seed": 16, "region": "West" },
    { "id": "villanova",   "name": "Villanova",       "shortName": "VILA",   "seed": 8,  "region": "West" },
    { "id": "utahst",      "name": "Utah St.",        "shortName": "UTST",   "seed": 9,  "region": "West" },
    { "id": "wisconsin",   "name": "Wisconsin",       "shortName": "WISC",   "seed": 5,  "region": "West" },
    { "id": "highpoint",   "name": "High Point",      "shortName": "HPT",    "seed": 12, "region": "West" },
    { "id": "arkansas",    "name": "Arkansas",        "shortName": "ARK",    "seed": 4,  "region": "West" },
    { "id": "hawaii",      "name": "Hawaii",          "shortName": "HAW",    "seed": 13, "region": "West" },
    { "id": "byu",         "name": "BYU",             "shortName": "BYU",    "seed": 6,  "region": "West" },
    { "id": "texas",       "name": "Texas",           "shortName": "TEX",    "seed": 11, "region": "West" },
    { "id": "gonzaga",     "name": "Gonzaga",         "shortName": "GONZ",   "seed": 3,  "region": "West" },
    { "id": "kensaw",      "name": "Kennesaw St.",    "shortName": "KENS",   "seed": 14, "region": "West" },
    { "id": "miami",       "name": "Miami",           "shortName": "MIA",    "seed": 7,  "region": "West" },
    { "id": "missouri",    "name": "Missouri",        "shortName": "MIZZ",   "seed": 10, "region": "West" },
    { "id": "purdue",      "name": "Purdue",          "shortName": "PUR",    "seed": 2,  "region": "West" },
    { "id": "queens",      "name": "Queens",          "shortName": "QUNS",   "seed": 15, "region": "West" },

    { "id": "michigan",    "name": "Michigan",        "shortName": "MICH",   "seed": 1,  "region": "Midwest" },
    { "id": "howard",      "name": "Howard",          "shortName": "HOW",    "seed": 16, "region": "Midwest" },
    { "id": "georgia",     "name": "Georgia",         "shortName": "UGA",    "seed": 8,  "region": "Midwest" },
    { "id": "saintlouis",  "name": "Saint Louis",     "shortName": "SLU",    "seed": 9,  "region": "Midwest" },
    { "id": "texastech",   "name": "Texas Tech",      "shortName": "TTU",    "seed": 5,  "region": "Midwest" },
    { "id": "akron",       "name": "Akron",           "shortName": "AKR",    "seed": 12, "region": "Midwest" },
    { "id": "alabama",     "name": "Alabama",         "shortName": "ALA",    "seed": 4,  "region": "Midwest" },
    { "id": "hofstra",     "name": "Hofstra",         "shortName": "HOF",    "seed": 13, "region": "Midwest" },
    { "id": "tennessee",   "name": "Tennessee",       "shortName": "TENN",   "seed": 6,  "region": "Midwest" },
    { "id": "miaoh",       "name": "Miami (OH)",      "shortName": "MIOH",   "seed": 11, "region": "Midwest" },
    { "id": "virginia",    "name": "Virginia",        "shortName": "UVA",    "seed": 3,  "region": "Midwest" },
    { "id": "wrightst",    "name": "Wright St.",      "shortName": "WRST",   "seed": 14, "region": "Midwest" },
    { "id": "kentucky",    "name": "Kentucky",        "shortName": "KNTK",   "seed": 7,  "region": "Midwest" },
    { "id": "santaclara",  "name": "Santa Clara",     "shortName": "SCU",    "seed": 10, "region": "Midwest" },
    { "id": "iowast",      "name": "Iowa St.",        "shortName": "IAST",   "seed": 2,  "region": "Midwest" },
    { "id": "tennstate",   "name": "Tenn. State",     "shortName": "TNST",   "seed": 15, "region": "Midwest" }
  ],
  "games": [

    { "gameId": "east-r64-1",  "round": "R64", "region": "East", "bracketSlot": 1,  "team1Id": "duke",       "team2Id": "siena",      "nextGameId": "east-r32-1", "nextGameSlot": 1 },
    { "gameId": "east-r64-2",  "round": "R64", "region": "East", "bracketSlot": 2,  "team1Id": "ohiost",     "team2Id": "tcu",        "nextGameId": "east-r32-1", "nextGameSlot": 2 },
    { "gameId": "east-r64-3",  "round": "R64", "region": "East", "bracketSlot": 3,  "team1Id": "stjohns",    "team2Id": "niowa",      "nextGameId": "east-r32-2", "nextGameSlot": 1 },
    { "gameId": "east-r64-4",  "round": "R64", "region": "East", "bracketSlot": 4,  "team1Id": "kansas",     "team2Id": "calbaptist", "nextGameId": "east-r32-2", "nextGameSlot": 2 },
    { "gameId": "east-r64-5",  "round": "R64", "region": "East", "bracketSlot": 5,  "team1Id": "louisville", "team2Id": "sfla",       "nextGameId": "east-r32-3", "nextGameSlot": 1 },
    { "gameId": "east-r64-6",  "round": "R64", "region": "East", "bracketSlot": 6,  "team1Id": "michst",     "team2Id": "ndakst",     "nextGameId": "east-r32-3", "nextGameSlot": 2 },
    { "gameId": "east-r64-7",  "round": "R64", "region": "East", "bracketSlot": 7,  "team1Id": "ucla",       "team2Id": "ucf",        "nextGameId": "east-r32-4", "nextGameSlot": 1 },
    { "gameId": "east-r64-8",  "round": "R64", "region": "East", "bracketSlot": 8,  "team1Id": "uconn",      "team2Id": "furman",     "nextGameId": "east-r32-4", "nextGameSlot": 2 },

    { "gameId": "east-r32-1",  "round": "R32", "region": "East", "bracketSlot": 1,  "team1Id": null, "team2Id": null, "nextGameId": "east-s16-1", "nextGameSlot": 1 },
    { "gameId": "east-r32-2",  "round": "R32", "region": "East", "bracketSlot": 2,  "team1Id": null, "team2Id": null, "nextGameId": "east-s16-1", "nextGameSlot": 2 },
    { "gameId": "east-r32-3",  "round": "R32", "region": "East", "bracketSlot": 3,  "team1Id": null, "team2Id": null, "nextGameId": "east-s16-2", "nextGameSlot": 1 },
    { "gameId": "east-r32-4",  "round": "R32", "region": "East", "bracketSlot": 4,  "team1Id": null, "team2Id": null, "nextGameId": "east-s16-2", "nextGameSlot": 2 },

    { "gameId": "east-s16-1",  "round": "S16", "region": "East", "bracketSlot": 1,  "team1Id": null, "team2Id": null, "nextGameId": "east-e8-1",  "nextGameSlot": 1 },
    { "gameId": "east-s16-2",  "round": "S16", "region": "East", "bracketSlot": 2,  "team1Id": null, "team2Id": null, "nextGameId": "east-e8-1",  "nextGameSlot": 2 },

    { "gameId": "east-e8-1",   "round": "E8",  "region": "East", "bracketSlot": 1,  "team1Id": null, "team2Id": null, "nextGameId": "f4-1",       "nextGameSlot": 1 },

    { "gameId": "south-r64-1", "round": "R64", "region": "South", "bracketSlot": 1, "team1Id": "florida",    "team2Id": "pvam",       "nextGameId": "south-r32-1", "nextGameSlot": 1 },
    { "gameId": "south-r64-2", "round": "R64", "region": "South", "bracketSlot": 2, "team1Id": "clemson",    "team2Id": "iowa",       "nextGameId": "south-r32-1", "nextGameSlot": 2 },
    { "gameId": "south-r64-3", "round": "R64", "region": "South", "bracketSlot": 3, "team1Id": "vanderbilt", "team2Id": "mcneese",    "nextGameId": "south-r32-2", "nextGameSlot": 1 },
    { "gameId": "south-r64-4", "round": "R64", "region": "South", "bracketSlot": 4, "team1Id": "nebraska",   "team2Id": "troy",       "nextGameId": "south-r32-2", "nextGameSlot": 2 },
    { "gameId": "south-r64-5", "round": "R64", "region": "South", "bracketSlot": 5, "team1Id": "ncarolina",  "team2Id": "vcu",        "nextGameId": "south-r32-3", "nextGameSlot": 1 },
    { "gameId": "south-r64-6", "round": "R64", "region": "South", "bracketSlot": 6, "team1Id": "illinois",   "team2Id": "penn",       "nextGameId": "south-r32-3", "nextGameSlot": 2 },
    { "gameId": "south-r64-7", "round": "R64", "region": "South", "bracketSlot": 7, "team1Id": "maryca",     "team2Id": "texasam",    "nextGameId": "south-r32-4", "nextGameSlot": 1 },
    { "gameId": "south-r64-8", "round": "R64", "region": "South", "bracketSlot": 8, "team1Id": "houston",    "team2Id": "idaho",      "nextGameId": "south-r32-4", "nextGameSlot": 2 },

    { "gameId": "south-r32-1", "round": "R32", "region": "South", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": "south-s16-1", "nextGameSlot": 1 },
    { "gameId": "south-r32-2", "round": "R32", "region": "South", "bracketSlot": 2, "team1Id": null, "team2Id": null, "nextGameId": "south-s16-1", "nextGameSlot": 2 },
    { "gameId": "south-r32-3", "round": "R32", "region": "South", "bracketSlot": 3, "team1Id": null, "team2Id": null, "nextGameId": "south-s16-2", "nextGameSlot": 1 },
    { "gameId": "south-r32-4", "round": "R32", "region": "South", "bracketSlot": 4, "team1Id": null, "team2Id": null, "nextGameId": "south-s16-2", "nextGameSlot": 2 },

    { "gameId": "south-s16-1", "round": "S16", "region": "South", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": "south-e8-1",  "nextGameSlot": 1 },
    { "gameId": "south-s16-2", "round": "S16", "region": "South", "bracketSlot": 2, "team1Id": null, "team2Id": null, "nextGameId": "south-e8-1",  "nextGameSlot": 2 },

    { "gameId": "south-e8-1",  "round": "E8",  "region": "South", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": "f4-2",        "nextGameSlot": 2 },

    { "gameId": "west-r64-1",  "round": "R64", "region": "West", "bracketSlot": 1,  "team1Id": "arizona",    "team2Id": "liu",        "nextGameId": "west-r32-1", "nextGameSlot": 1 },
    { "gameId": "west-r64-2",  "round": "R64", "region": "West", "bracketSlot": 2,  "team1Id": "villanova",  "team2Id": "utahst",     "nextGameId": "west-r32-1", "nextGameSlot": 2 },
    { "gameId": "west-r64-3",  "round": "R64", "region": "West", "bracketSlot": 3,  "team1Id": "wisconsin",  "team2Id": "highpoint",  "nextGameId": "west-r32-2", "nextGameSlot": 1 },
    { "gameId": "west-r64-4",  "round": "R64", "region": "West", "bracketSlot": 4,  "team1Id": "arkansas",   "team2Id": "hawaii",     "nextGameId": "west-r32-2", "nextGameSlot": 2 },
    { "gameId": "west-r64-5",  "round": "R64", "region": "West", "bracketSlot": 5,  "team1Id": "byu",        "team2Id": "texas",      "nextGameId": "west-r32-3", "nextGameSlot": 1 },
    { "gameId": "west-r64-6",  "round": "R64", "region": "West", "bracketSlot": 6,  "team1Id": "gonzaga",    "team2Id": "kensaw",     "nextGameId": "west-r32-3", "nextGameSlot": 2 },
    { "gameId": "west-r64-7",  "round": "R64", "region": "West", "bracketSlot": 7,  "team1Id": "miami",      "team2Id": "missouri",   "nextGameId": "west-r32-4", "nextGameSlot": 1 },
    { "gameId": "west-r64-8",  "round": "R64", "region": "West", "bracketSlot": 8,  "team1Id": "purdue",     "team2Id": "queens",     "nextGameId": "west-r32-4", "nextGameSlot": 2 },

    { "gameId": "west-r32-1",  "round": "R32", "region": "West", "bracketSlot": 1,  "team1Id": null, "team2Id": null, "nextGameId": "west-s16-1", "nextGameSlot": 1 },
    { "gameId": "west-r32-2",  "round": "R32", "region": "West", "bracketSlot": 2,  "team1Id": null, "team2Id": null, "nextGameId": "west-s16-1", "nextGameSlot": 2 },
    { "gameId": "west-r32-3",  "round": "R32", "region": "West", "bracketSlot": 3,  "team1Id": null, "team2Id": null, "nextGameId": "west-s16-2", "nextGameSlot": 1 },
    { "gameId": "west-r32-4",  "round": "R32", "region": "West", "bracketSlot": 4,  "team1Id": null, "team2Id": null, "nextGameId": "west-s16-2", "nextGameSlot": 2 },

    { "gameId": "west-s16-1",  "round": "S16", "region": "West", "bracketSlot": 1,  "team1Id": null, "team2Id": null, "nextGameId": "west-e8-1",  "nextGameSlot": 1 },
    { "gameId": "west-s16-2",  "round": "S16", "region": "West", "bracketSlot": 2,  "team1Id": null, "team2Id": null, "nextGameId": "west-e8-1",  "nextGameSlot": 2 },

    { "gameId": "west-e8-1",   "round": "E8",  "region": "West", "bracketSlot": 1,  "team1Id": null, "team2Id": null, "nextGameId": "f4-1",       "nextGameSlot": 2 },

    { "gameId": "mid-r64-1",   "round": "R64", "region": "Midwest", "bracketSlot": 1, "team1Id": "michigan",   "team2Id": "howard",     "nextGameId": "mid-r32-1", "nextGameSlot": 1 },
    { "gameId": "mid-r64-2",   "round": "R64", "region": "Midwest", "bracketSlot": 2, "team1Id": "georgia",    "team2Id": "saintlouis", "nextGameId": "mid-r32-1", "nextGameSlot": 2 },
    { "gameId": "mid-r64-3",   "round": "R64", "region": "Midwest", "bracketSlot": 3, "team1Id": "texastech",  "team2Id": "akron",      "nextGameId": "mid-r32-2", "nextGameSlot": 1 },
    { "gameId": "mid-r64-4",   "round": "R64", "region": "Midwest", "bracketSlot": 4, "team1Id": "alabama",    "team2Id": "hofstra",    "nextGameId": "mid-r32-2", "nextGameSlot": 2 },
    { "gameId": "mid-r64-5",   "round": "R64", "region": "Midwest", "bracketSlot": 5, "team1Id": "tennessee",  "team2Id": "miaoh",      "nextGameId": "mid-r32-3", "nextGameSlot": 1 },
    { "gameId": "mid-r64-6",   "round": "R64", "region": "Midwest", "bracketSlot": 6, "team1Id": "virginia",   "team2Id": "wrightst",   "nextGameId": "mid-r32-3", "nextGameSlot": 2 },
    { "gameId": "mid-r64-7",   "round": "R64", "region": "Midwest", "bracketSlot": 7, "team1Id": "kentucky",   "team2Id": "santaclara", "nextGameId": "mid-r32-4", "nextGameSlot": 1 },
    { "gameId": "mid-r64-8",   "round": "R64", "region": "Midwest", "bracketSlot": 8, "team1Id": "iowast",     "team2Id": "tennstate",  "nextGameId": "mid-r32-4", "nextGameSlot": 2 },

    { "gameId": "mid-r32-1",   "round": "R32", "region": "Midwest", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": "mid-s16-1", "nextGameSlot": 1 },
    { "gameId": "mid-r32-2",   "round": "R32", "region": "Midwest", "bracketSlot": 2, "team1Id": null, "team2Id": null, "nextGameId": "mid-s16-1", "nextGameSlot": 2 },
    { "gameId": "mid-r32-3",   "round": "R32", "region": "Midwest", "bracketSlot": 3, "team1Id": null, "team2Id": null, "nextGameId": "mid-s16-2", "nextGameSlot": 1 },
    { "gameId": "mid-r32-4",   "round": "R32", "region": "Midwest", "bracketSlot": 4, "team1Id": null, "team2Id": null, "nextGameId": "mid-s16-2", "nextGameSlot": 2 },

    { "gameId": "mid-s16-1",   "round": "S16", "region": "Midwest", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": "mid-e8-1",  "nextGameSlot": 1 },
    { "gameId": "mid-s16-2",   "round": "S16", "region": "Midwest", "bracketSlot": 2, "team1Id": null, "team2Id": null, "nextGameId": "mid-e8-1",  "nextGameSlot": 2 },

    { "gameId": "mid-e8-1",    "round": "E8",  "region": "Midwest", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": "f4-2",      "nextGameSlot": 1 },

    { "gameId": "f4-1",        "round": "F4",  "region": "FinalFour", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": "ncg-1", "nextGameSlot": 1 },
    { "gameId": "f4-2",        "round": "F4",  "region": "FinalFour", "bracketSlot": 2, "team1Id": null, "team2Id": null, "nextGameId": "ncg-1", "nextGameSlot": 2 },

    { "gameId": "ncg-1",       "round": "NCG", "region": "FinalFour", "bracketSlot": 1, "team1Id": null, "team2Id": null, "nextGameId": null, "nextGameSlot": null }
  ],

  "_cameron_keetch_picks": {
    "description": "Cameron Keetch's picks extracted from submitted bracket PDF",
    "picks": {
      "east-r64-1":  "duke",       "east-r64-2":  "tcu",        "east-r64-3":  "stjohns",
      "east-r64-4":  "kansas",     "east-r64-5":  "sfla",       "east-r64-6":  "michst",
      "east-r64-7":  "ucla",       "east-r64-8":  "uconn",
      "east-r32-1":  "duke",       "east-r32-2":  "kansas",     "east-r32-3":  "michst",    "east-r32-4":  "uconn",
      "east-s16-1":  "duke",       "east-s16-2":  "uconn",
      "east-e8-1":   "duke",

      "south-r64-1": "florida",    "south-r64-2": "iowa",       "south-r64-3": "vanderbilt",
      "south-r64-4": "nebraska",   "south-r64-5": "vcu",        "south-r64-6": "illinois",
      "south-r64-7": "texasam",    "south-r64-8": "houston",
      "south-r32-1": "florida",    "south-r32-2": "vanderbilt", "south-r32-3": "illinois",  "south-r32-4": "houston",
      "south-s16-1": "vanderbilt", "south-s16-2": "houston",
      "south-e8-1":  "houston",

      "west-r64-1":  "arizona",    "west-r64-2":  "utahst",     "west-r64-3":  "highpoint",
      "west-r64-4":  "arkansas",   "west-r64-5":  "texas",      "west-r64-6":  "gonzaga",
      "west-r64-7":  "miami",      "west-r64-8":  "purdue",
      "west-r32-1":  "arizona",    "west-r32-2":  "wisconsin",  "west-r32-3":  "gonzaga",   "west-r32-4":  "purdue",
      "west-s16-1":  "arizona",    "west-s16-2":  "gonzaga",
      "west-e8-1":   "arizona",

      "mid-r64-1":   "michigan",   "mid-r64-2":   "saintlouis", "mid-r64-3":   "texastech",
      "mid-r64-4":   "hofstra",    "mid-r64-5":   "tennessee",  "mid-r64-6":   "virginia",
      "mid-r64-7":   "santaclara", "mid-r64-8":   "iowast",
      "mid-r32-1":   "michigan",   "mid-r32-2":   "texastech",  "mid-r32-3":   "virginia",  "mid-r32-4":   "iowast",
      "mid-s16-1":   "michigan",   "mid-s16-2":   "iowast",
      "mid-e8-1":    "iowast",

      "f4-1":  "duke",
      "f4-2":  "iowast",
      "ncg-1": "arizona"
    },
    "champion": "Arizona",
    "finalFour": ["Duke", "UConn", "Houston", "Arizona"],
    "notes": "Cameron picked Wisconsin over High Point in R32 (High Point won R64 as a 12-seed upset), and Hofstra over Alabama in R64 (upset pick)"
  }
}

HEREDOC_END

mkdir -p "scripts"
cat > 'scripts/bracket-template.json' << 'HEREDOC_END'
{
  "tournamentId": "2026",
  "name": "NCAA Tournament 2026",
  "year": 2026,
  "lockDate": "2026-03-19T12:00:00Z",
  "teams": [
    { "id": "team-east-1",  "name": "Team A",    "shortName": "TMA",  "seed": 1,  "region": "East",    "espnId": "100" },
    { "id": "team-east-16", "name": "Team B",    "shortName": "TMB",  "seed": 16, "region": "East",    "espnId": "101" },
    { "id": "team-east-8",  "name": "Team C",    "shortName": "TMC",  "seed": 8,  "region": "East",    "espnId": "102" },
    { "id": "team-east-9",  "name": "Team D",    "shortName": "TMD",  "seed": 9,  "region": "East",    "espnId": "103" },
    { "id": "team-east-5",  "name": "Team E",    "shortName": "TME",  "seed": 5,  "region": "East",    "espnId": "104" },
    { "id": "team-east-12", "name": "Team F",    "shortName": "TMF",  "seed": 12, "region": "East",    "espnId": "105" },
    { "id": "team-east-4",  "name": "Team G",    "shortName": "TMG",  "seed": 4,  "region": "East",    "espnId": "106" },
    { "id": "team-east-13", "name": "Team H",    "shortName": "TMH",  "seed": 13, "region": "East",    "espnId": "107" },
    { "id": "team-east-6",  "name": "Team I",    "shortName": "TMI",  "seed": 6,  "region": "East",    "espnId": "108" },
    { "id": "team-east-11", "name": "Team J",    "shortName": "TMJ",  "seed": 11, "region": "East",    "espnId": "109" },
    { "id": "team-east-3",  "name": "Team K",    "shortName": "TMK",  "seed": 3,  "region": "East",    "espnId": "110" },
    { "id": "team-east-14", "name": "Team L",    "shortName": "TML",  "seed": 14, "region": "East",    "espnId": "111" },
    { "id": "team-east-7",  "name": "Team M",    "shortName": "TMM",  "seed": 7,  "region": "East",    "espnId": "112" },
    { "id": "team-east-10", "name": "Team N",    "shortName": "TMN",  "seed": 10, "region": "East",    "espnId": "113" },
    { "id": "team-east-2",  "name": "Team O",    "shortName": "TMO",  "seed": 2,  "region": "East",    "espnId": "114" },
    { "id": "team-east-15", "name": "Team P",    "shortName": "TMP",  "seed": 15, "region": "East",    "espnId": "115" }
  ],
  "games": [
    {
      "gameId": "east-r64-1", "round": "R64", "region": "East", "bracketSlot": 1,
      "team1Id": "team-east-1",  "team2Id": "team-east-16",
      "nextGameId": "east-r32-1", "nextGameSlot": 1,
      "espnGameId": "401638001"
    },
    {
      "gameId": "east-r64-2", "round": "R64", "region": "East", "bracketSlot": 2,
      "team1Id": "team-east-8",  "team2Id": "team-east-9",
      "nextGameId": "east-r32-1", "nextGameSlot": 2,
      "espnGameId": "401638002"
    },
    {
      "gameId": "east-r32-1", "round": "R32", "region": "East", "bracketSlot": 1,
      "team1Id": null, "team2Id": null,
      "nextGameId": "east-s16-1", "nextGameSlot": 1,
      "espnGameId": null
    },
    {
      "gameId": "east-s16-1", "round": "S16", "region": "East", "bracketSlot": 1,
      "team1Id": null, "team2Id": null,
      "nextGameId": "east-e8-1", "nextGameSlot": 1,
      "espnGameId": null
    },
    {
      "gameId": "east-e8-1", "round": "E8", "region": "East", "bracketSlot": 1,
      "team1Id": null, "team2Id": null,
      "nextGameId": "f4-1", "nextGameSlot": 1,
      "espnGameId": null
    },
    {
      "gameId": "f4-1", "round": "F4", "region": "FinalFour", "bracketSlot": 1,
      "team1Id": null, "team2Id": null,
      "nextGameId": "ncg-1", "nextGameSlot": 1,
      "espnGameId": null
    },
    {
      "gameId": "ncg-1", "round": "NCG", "region": "FinalFour", "bracketSlot": 1,
      "team1Id": null, "team2Id": null,
      "nextGameId": null, "nextGameSlot": null,
      "espnGameId": null
    }
  ],
  "_note": "This is a truncated template. A full bracket has 63 games and 64 teams across 4 regions. When you upload your bracket files, the seed script will use that data instead."
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

mkdir -p "scripts"
cat > 'scripts/poll-espn.ts' << 'HEREDOC_END'
/**
 * ESPN Polling Script
 *
 * Calls our /api/espn/sync endpoint on a schedule.
 * Run this during the tournament to auto-update game results.
 *
 * Usage (local):
 *   npm run poll
 *
 * On AWS: use EventBridge Scheduler to call the sync endpoint directly
 * every 60 seconds during tournament hours (no need to run this script in prod).
 */

import * as https from "https";
import * as http from "http";

const APP_URL    = process.env.APP_URL ?? "http://localhost:3000";
const SYNC_SECRET = process.env.ESPN_SYNC_SECRET ?? "dev-sync-secret";
const INTERVAL_MS = parseInt(process.env.ESPN_POLL_INTERVAL_MS ?? "60000", 10);

// Only poll during tournament hours (saves API calls at 3am)
function isTournamentHours(): boolean {
  const now = new Date();
  const hour = now.getUTCHours(); // 11am–midnight ET = 15:00–04:00 UTC
  return hour >= 15 || hour <= 4;
}

function postSync(): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${APP_URL}/api/espn/sync`);
    const lib = url.protocol === "https:" ? https : http;

    const req = lib.request(
      { hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SYNC_SECRET}` },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            const ts = new Date().toLocaleTimeString();
            if (data.updated > 0) {
              console.log(`[${ts}] ✅ Updated ${data.updated} game(s): ${data.updatedIds.join(", ")}`);
            } else {
              console.log(`[${ts}] — Checked ${data.checked} games, no updates`);
            }
            if (data.errors?.length) {
              console.warn(`[${ts}] ⚠️  Errors: ${data.errors.join("; ")}`);
            }
          } catch {
            console.error("Failed to parse sync response:", body.slice(0, 200));
          }
          resolve();
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error("Request timeout")); });
    req.end();
  });
}

async function poll() {
  if (!isTournamentHours()) {
    console.log(`[${new Date().toLocaleTimeString()}] Outside tournament hours, skipping poll.`);
    return;
  }
  try {
    await postSync();
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Poll error:`, err);
  }
}

console.log(`🏀 ESPN Poller started`);
console.log(`   App: ${APP_URL}`);
console.log(`   Interval: ${INTERVAL_MS / 1000}s`);
console.log(`   (Polls between 11am–midnight ET)\n`);

// Run immediately then on schedule
poll();
setInterval(poll, INTERVAL_MS);

HEREDOC_END

mkdir -p "scripts"
cat > 'scripts/seed-demo-picks.ts' << 'HEREDOC_END'
/**
 * Seeds the bracket-2026.json picks as a demo bracket for testing.
 * In production, users submit their own picks via the UI.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/seed-demo-picks.ts
 */

import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { createBracket } from "../lib/dynamo/queries/brackets";
import type { Bracket } from "../lib/types";

const BRACKET_FILE = path.join(__dirname, "bracket-2026.json");
const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "2026";

// Demo user ID — replace with a real Google userId after first login
const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "demo-user-replace-me";

async function main() {
  const raw = fs.readFileSync(BRACKET_FILE, "utf-8");
  const data = JSON.parse(raw);
  const picks = data._cameron_keetch_picks?.picks ?? {};

  const bracket: Bracket = {
    bracketId: uuidv4(),
    userId: DEMO_USER_ID,
    tournamentId: TOURNAMENT_ID,
    name: "Cameron Keetch's Bracket",
    picks,
    score: 0,
    maxPossibleScore: 0,
    isEliminated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createBracket(bracket);
  console.log(`\n✅ Seeded bracket: "${bracket.name}"`);
  console.log(`   Bracket ID: ${bracket.bracketId}`);
  console.log(`   Picks: ${Object.keys(picks).length} games picked`);
  console.log(`   Champion pick: ${data._cameron_keetch_picks?.champion}`);
  console.log(`\nTo use with a real user, set DEMO_USER_ID=<your-google-id> and re-run.\n`);
}

main().catch(console.error);

HEREDOC_END

mkdir -p "scripts"
cat > 'scripts/seed-tournament.ts' << 'HEREDOC_END'
/**
 * Seed the tournament structure into DynamoDB.
 *
 * Usage:
 *   npm run seed                          # uses default 2026 bracket
 *   BRACKET_FILE=./my-bracket.json npm run seed
 *
 * Bracket JSON format (see scripts/bracket-template.json for example):
 * {
 *   "tournamentId": "2026",
 *   "name": "NCAA Tournament 2026",
 *   "year": 2026,
 *   "lockDate": "2026-03-19T12:00:00Z",
 *   "teams": [
 *     { "id": "duke", "name": "Duke", "shortName": "DUKE", "seed": 1, "region": "East", "espnId": "150" }
 *   ],
 *   "games": [
 *     {
 *       "gameId": "east-r64-1", "round": "R64", "region": "East", "bracketSlot": 1,
 *       "team1Id": "duke", "team2Id": "unc-asheville",
 *       "nextGameId": "east-r32-1", "nextGameSlot": 1,
 *       "espnGameId": "401638576"
 *     }
 *   ]
 * }
 */

import * as path from "path";
import * as fs from "fs";
import { upsertTournament, upsertTeam, upsertGame } from "../lib/dynamo/queries/games";
import type { Tournament, Team, Game } from "../lib/types";

const BRACKET_FILE = process.env.BRACKET_FILE
  ?? path.join(__dirname, "bracket-2026.json");

interface BracketFile {
  tournamentId: string;
  name: string;
  year: number;
  lockDate: string;
  teams: Team[];
  games: Omit<Game, "winnerId" | "score1" | "score2" | "status" | "scheduledAt" | "completedAt" | "tournamentId">[];
}

async function main() {
  if (!fs.existsSync(BRACKET_FILE)) {
    console.error(`\n❌ Bracket file not found: ${BRACKET_FILE}`);
    console.log("\nCreate a bracket JSON file or set BRACKET_FILE env var.");
    console.log("See scripts/bracket-template.json for the format.\n");
    process.exit(1);
  }

  const raw = fs.readFileSync(BRACKET_FILE, "utf-8");
  const data: BracketFile = JSON.parse(raw);

  console.log(`\n🏀 Seeding tournament: ${data.name} (${data.tournamentId})\n`);

  // 1. Upsert tournament record
  const tournament: Tournament = {
    tournamentId: data.tournamentId,
    name: data.name,
    year: data.year,
    status: "pending",
    lockDate: data.lockDate,
    createdAt: new Date().toISOString(),
  };
  await upsertTournament(tournament);
  console.log(`  ✅ Tournament: ${data.name}`);

  // 2. Upsert all teams
  console.log(`\n  Seeding ${data.teams.length} teams...`);
  for (const team of data.teams) {
    await upsertTeam(data.tournamentId, team);
    process.stdout.write(".");
  }
  console.log(` done`);

  // 3. Upsert all games (with defaults for unplayed fields)
  console.log(`\n  Seeding ${data.games.length} games...`);
  for (const gameInput of data.games) {
    const game: Game = {
      ...gameInput,
      tournamentId: data.tournamentId,
      winnerId: null,
      score1: null,
      score2: null,
      status: "scheduled",
      scheduledAt: null,
      completedAt: null,
    };
    await upsertGame(data.tournamentId, game);
    process.stdout.write(".");
  }
  console.log(` done`);

  console.log(`\n✅ Seed complete!`);
  console.log(`   Teams: ${data.teams.length}`);
  console.log(`   Games: ${data.games.length}`);
  console.log(`\nNow open http://localhost:3001 (DynamoDB Admin) to verify the data.`);
  console.log(`Or visit http://localhost:3000/dashboard to start picking.\n`);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});

HEREDOC_END

if [ ! -f ".gitignore" ]; then
cat > '.gitignore' << 'GITIGNORE_END'
node_modules/
.next/
out/
build/
.env
.env.local
.env.*.local
.dynamodb/
.scripts-out/
.DS_Store
*.pem
npm-debug.log*
next-env.d.ts
*.tsbuildinfo
GITIGNORE_END
fi

COUNT=$(find . -type f | grep -v node_modules | grep -v .next | grep -v .git | wc -l | tr -d " ")
echo "✅ $COUNT files written"
echo ""
echo "Next steps:"
echo "  1. cp .env.local.example .env.local"
echo "  2. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET"
echo "  3. npm install"
echo "  4. docker-compose up"
echo "  5. (new terminal) npm run setup"
echo "  6. npm run seed   # seeds the 2026 bracket (64 teams, 63 games)"
echo "  7. git add . && git commit -m 'feat: full scaffold + 2026 bracket' && git push"
echo ""
echo "🏀 Ready. See README.md for full instructions."