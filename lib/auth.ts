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

const dynamoAdapter = DynamoDBAdapter(docClient, {
  tableName: "mm-next-auth",
});

const authWarnOnce = globalThis as { __mmNextAuthEnvWarned?: boolean };

/**
 * Build NextAuth options on each use so `process.env.*` is read when the handler runs.
 * Next.js can inline env at build time for module-scope reads; Amplify often has auth secrets
 * only (or correctly) at Lambda runtime — empty values get baked in and NO_SECRET / OAuthSignin persist.
 */
export function getAuthOptions(): NextAuthOptions {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";

  if (!authWarnOnce.__mmNextAuthEnvWarned && (!googleClientId || !googleClientSecret)) {
    authWarnOnce.__mmNextAuthEnvWarned = true;
    console.error(
      "[next-auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing/empty at request time. If they are set in Amplify, redeploy; if this is local, use .env.local."
    );
  }

  return {
    trustHost: true,
    secret: process.env.NEXTAUTH_SECRET,

    debug: process.env.NEXTAUTH_DEBUG === "1",
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

