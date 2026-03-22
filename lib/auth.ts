import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DynamoDBAdapter } from "@next-auth/dynamodb-adapter";
import { docClient } from "./dynamo/client";
import { upsertUser } from "./dynamo/queries/users";

const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

