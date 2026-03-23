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
import { upsertUser } from "./dynamo/queries/users";
import { serverEnv } from "./server-env";

const dynamoAdapter = DynamoDBAdapter(docClient, {
  tableName: "mm-next-auth",
});

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

    adapter: dynamoAdapter,

    session: { strategy: "jwt" },

    callbacks: {
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

    theme: {
      colorScheme: "dark",
      brandColor: "#ea580c",
    },

    pages: {
      error: "/login",
    },
  };
}

