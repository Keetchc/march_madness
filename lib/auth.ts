import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

declare module "next-auth" {
  interface AuthOptions {
    /** Supported in next-auth 4.24+; typings omit it in some releases. */
    trustHost?: boolean;
  }
}
import { DynamoDBAdapter } from "@next-auth/dynamodb-adapter";
import { docClient } from "./dynamo/client";
import { TABLES } from "./dynamo/tables";
import { getUser, upsertUser } from "./dynamo/queries/users";
import { serverEnv } from "./server-env";

/**
 * Lazily create the adapter on first `getAuthOptions()` so `TABLES.NEXTAUTH` resolves after
 * `hydrateAuthEnvFromDisk()` (and so `DYNAMO_TABLE_PREFIX` is not fixed at module load).
 */
let dynamoAdapter: ReturnType<typeof DynamoDBAdapter> | undefined;

function getDynamoAdapter() {
  if (!dynamoAdapter) {
    dynamoAdapter = DynamoDBAdapter(docClient, {
      tableName: TABLES.NEXTAUTH,
    });
  }
  return dynamoAdapter;
}

const authWarnOnce = globalThis as { __mmNextAuthEnvWarned?: boolean };

/**
 * Build NextAuth options on each use. Auth secrets must be read via `serverEnv()` so they are not
 * webpack-inlined from the CodeBuild environment (often empty) while Lambda has the real values.
 */
export function getAuthOptions(): NextAuthOptions {
  const adminEmails = (serverEnv("ADMIN_EMAILS") ?? "").split(",").map((e) => e.trim());
  const googleClientId = serverEnv("GOOGLE_CLIENT_ID")?.trim() ?? "";
  const googleClientSecret = serverEnv("GOOGLE_CLIENT_SECRET")?.trim() ?? "";

  if (!authWarnOnce.__mmNextAuthEnvWarned && (!googleClientId || !googleClientSecret)) {
    authWarnOnce.__mmNextAuthEnvWarned = true;
    console.error(
      "[next-auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing/empty at request time. If they are set in Amplify, redeploy; if this is local, use .env.local."
    );
  }

  return {
    trustHost: true,
    secret: serverEnv("NEXTAUTH_SECRET"),

    debug: serverEnv("NEXTAUTH_DEBUG") === "1",
    logger: {
      error(code, metadata) {
        console.error("[next-auth]", code, metadata);
      },
    },

    providers: [
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      }),
    ],

    adapter: getDynamoAdapter(),

    session: { strategy: "jwt" },

    callbacks: {
      async redirect({ url, baseUrl }) {
        let target: string;
        if (url.startsWith("/") && !url.startsWith("//")) {
          target = `${baseUrl}${url}`;
        } else {
          try {
            const parsed = new URL(url);
            target = parsed.origin === baseUrl ? url : baseUrl;
          } catch {
            target = baseUrl;
          }
        }
        const path = new URL(target).pathname;
        if (path === "/" || path === "") {
          return `${baseUrl}/dashboard`;
        }
        return target;
      },

      async signIn({ user }) {
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
          if (user.email) {
            (token as { email?: string }).email = user.email;
          }
        }
        if (!token.userId && typeof token.sub === "string") {
          token.userId = token.sub;
        }
        let email =
          (typeof user?.email === "string" && user.email) ||
          (typeof (token as { email?: string }).email === "string" && (token as { email?: string }).email) ||
          "";
        let profile: Awaited<ReturnType<typeof getUser>> = null;
        if (!email && typeof token.userId === "string") {
          profile = await getUser(token.userId);
          if (profile?.email) {
            email = profile.email;
            (token as { email?: string }).email = email;
          }
        }
        // Recompute every request so ADMIN_EMAILS applies without re-login; JWT refresh has no `user`.
        if (email) {
          (token as { email?: string }).email = email;
          token.isAdmin = adminEmails.includes(email.trim());
        } else {
          token.isAdmin = profile?.isAdmin === true;
        }
        if (typeof token.isAdmin !== "boolean") {
          token.isAdmin = false;
        }
        return token;
      },

      async session({ session, token }) {
        if (session.user) {
          // Prefer explicit userId from sign-in; fall back to JWT `sub` (stable for Google) for older sessions.
          (session.user as any).userId = (token.userId as string | undefined) ?? token.sub;
          (session.user as any).isAdmin = Boolean(token.isAdmin);
          const te = (token as { email?: string }).email;
          if (typeof te === "string" && te) {
            session.user.email = te;
          }
        }
        return session;
      },
    },

    theme: {
      colorScheme: "dark",
      brandColor: "#ea580c",
    },

    pages: {
      error: "/login",
    },
  };
}

