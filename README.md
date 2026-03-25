# March Madness

Next.js app for tournament brackets, groups, and leaderboards. Data lives in **DynamoDB**. Sign-in uses **NextAuth** with **Google**.

---

## How local development works

| Piece | Local | Hosted (e.g. Amplify) |
|--------|--------|------------------------|
| **App** | `npm run dev` → [http://localhost:3000](http://localhost:3000) | Built Next.js |
| **Database** | [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) in Docker (`docker compose`) | AWS DynamoDB |
| **Table names** | Whatever **`DYNAMO_TABLE_PREFIX`** you set (commonly **`mm`**) → `mm-users`, `mm-tournament`, etc. | Same pattern; dev branches often use **`mm-dev-*`** in AWS |
| **AWS keys in `.env.local`** | Dummy values like `local` / `local` are fine for DynamoDB Local | Real IAM or **`MM_*`** vars (Amplify reserves **`AWS_*`**) |

You do **not** need `mm-dev-*` tables inside DynamoDB Local for day-to-day work. The app reads **`{DYNAMO_TABLE_PREFIX}-*`** only. To mirror cloud dev data locally, run **`npm run pull-dev-to-local`**, which copies **AWS `mm-dev-*`** into your **local** prefix (usually **`mm-*`**).

---

## Requirements

- **Node.js 20+**
- **Docker Desktop** (or compatible Docker engine) — for DynamoDB Local
- **Google Cloud** OAuth client (web application) with redirect URI  
  `http://localhost:3000/api/auth/callback/google`
- **AWS CLI** configured (`aws configure`) — **only if** you use **`pull-dev-to-local`** to copy tables from AWS

---

## First-time setup

1. **Clone and install**

   ```bash
   cd march_madness
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.local.example .env.local
   ```

   Edit **`.env.local`**. You **must** set:

   - **`NEXTAUTH_SECRET`** — e.g. `openssl rand -base64 32`
   - **`NEXTAUTH_URL`** — `http://localhost:3000` (no trailing slash)
   - **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`**
   - **`ADMIN_EMAILS`** — comma-separated Google emails allowed to use **`/admin`** (must match the signed-in email exactly)

   For DynamoDB Local, keep (or restore) the example’s:

   - **`DYNAMODB_ENDPOINT=http://localhost:8000`**  
     If the app or scripts fail to connect, try **`http://127.0.0.1:8000`** instead of `localhost`.
   - **`AWS_REGION`** (or **`MM_REGION`**) — region for the SDK (and for AWS when pulling data)
   - **`AWS_ACCESS_KEY_ID`** / **`AWS_SECRET_ACCESS_KEY`** — `local` is fine for DynamoDB Local

   See **`.env.local.example`** for comments on optional variables (tournament lock, ESPN sync, pull-from-dev, etc.).

3. **Start DynamoDB Local**

   ```bash
   docker compose up -d dynamodb-local dynamodb-admin
   ```

   - API: port **8000**
   - Optional admin UI: **8001**

4. **Create tables** (uses **`DYNAMO_TABLE_PREFIX`**, default **`mm`**)

   ```bash
   npm run setup
   ```

5. **Data** — pick one or both:

   - **Seed tournament structure** (good for a blank local DB):

     ```bash
     npm run seed
     ```

   - **Multiple seasons** (official bracket + lists switcher): add `TOURNAMENT_SEASONS=2024,2025,2026` to `.env.local`, then seed each bracket file:

     ```bash
     npm run seed:all
     ```

     Use the **Season** control in the navbar to change the active year (cookie `mm_view_tid`). Past seasons in the repo use the same tree as `bracket-2026.json` for structure only; replace with real historical data if you have it.

   - **Copy AWS dev data into local `mm-*`** (needs AWS credentials that can read **`mm-dev-*`** in your region):

     ```bash
     npm run pull-dev-to-local
     ```

     Re-run with **`--force`** if local tables already have rows. See **`.env.local.example`** for **`DYNAMO_PULL_SOURCE_PREFIX`**, **`DYNAMO_PULL_LOCAL_PREFIX`**, and optional **`SYNC_DYNAMO_ON_DEV=1`**.

6. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

---

## Daily workflow

1. Ensure Docker is running and DynamoDB Local is up:

   ```bash
   docker compose up -d dynamodb-local
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Optional: refresh local data from AWS dev before coding:

   ```bash
   npm run pull-dev-to-local
   ```

   Or one shot:

   ```bash
   npm run dev:sync
   ```

If **`SYNC_DYNAMO_ON_DEV=1`** is in **`.env.local`**, **`npm run dev`** runs **`pull-dev-to-local`** first (via **`predev`**). That is slower but keeps local data aligned with cloud dev.

---

## Useful npm scripts

| Script | Purpose |
|--------|--------|
| **`npm run dev`** | Next.js dev server |
| **`npm run dev:sync`** | Pull from AWS dev → Local, then **`next dev`** |
| **`npm run setup`** | Create DynamoDB tables for **`DYNAMO_TABLE_PREFIX`** |
| **`npm run setup:dev-tables`** | Same with prefix **`mm-dev`** (unusual for pure local) |
| **`npm run seed`** | Seed tournament data (same prefix as **`setup`**) |
| **`npm run pull-dev-to-local`** | Copy **`mm-dev-*`** (AWS) → local **`mm-*`** (or prefixes from env) |
| **`npm run clone-dynamo-to-dev`** | AWS-only: copy prod-style prefix to dev prefix (see script header; **unset** **`DYNAMODB_ENDPOINT`**) |
| **`npm run poll`** | ESPN polling script (separate process; see **`.env.local.example`**) |
| **`npm run build`** / **`npm start`** | Production build and run |

---

## Troubleshooting

- **`aws: command not found`** (Git Bash) — Restart the terminal after installing AWS CLI, or add the CLI install directory to **`PATH`** (see AWS install docs).
- **DynamoDB connection errors** — Confirm **`docker compose ps`**, then try **`127.0.0.1`** instead of **`localhost`** for **`DYNAMODB_ENDPOINT`**.
- **NextAuth / Google `OAuthSignin`** — Check **`NEXTAUTH_URL`**, Google redirect URI, and **`GOOGLE_CLIENT_*`** at runtime.
- **`/admin` forbidden** — Your Google email must appear in **`ADMIN_EMAILS`**.
- **`npm run setup` / ts-node errors** — Use Node 20+; run from the repo root.

For production and Amplify-specific env behavior, see comments in **`.env.local.example`**.
