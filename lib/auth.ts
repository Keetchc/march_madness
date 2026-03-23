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

const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";

const authWarnOnce = globalThis as { __mmNextAuthEnvWarned?: boolean };
if (!authWarnOnce.__mmNextAuthEnvWarned && (!googleClientId || !googleClientSecret)) {
  authWarnOnce.__mmNextAuthEnvWarned = true;
  console.error(
    "[next-auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing/empty. Set both in Amplify branch env (runtime), same as NEXTAUTH_SECRET."
  );
}

export const authOptions: NextAuthOptions = {
  // Required behind proxies (Amplify, Vercel, etc.) so OAuth callbacks resolve the real host.
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,

  // Set NEXTAUTH_DEBUG=1 in the host env to log SIGNIN_OAUTH_ERROR details to CloudWatch / terminal.
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

  adapter: DynamoDBAdapter(docClient, {
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

  // Do not set pages.signIn to /login: NextAuth then redirects every GET /api/auth/signin
  // back to /login, so OAuth never starts from a link or the default sign-in document.
  // We keep a branded /login that links to /api/auth/signin (one full page load = valid CSRF cookies).
  theme: {
    colorScheme: "dark",
    brandColor: "#ea580c",
  },

  pages: {
    error: "/login",
  },
};

