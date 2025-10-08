import { randomUUID } from "node:crypto";

import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";

import { createAuthAdapter } from "@/lib/auth/adapter";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { trackEvent } from "@/lib/utils/analytics";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

const enableDevLogin = process.env.ENABLE_DEV_LOGIN === "true";

const providers: NextAuthOptions["providers"] = [];

providers.push(
  Credentials({
    id: "password",
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase();
      const password = credentials?.password;
      if (!email || !password) {
        throw new Error("CredentialsSignin");
      }

      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user?.passwordHash) {
        throw new Error("CredentialsSignin");
      }

      const isValid = await compare(password, user.passwordHash);
      if (!isValid) {
        throw new Error("CredentialsSignin");
      }

      return {
        id: user.id,
        name: user.name ?? undefined,
        email: user.email,
      };
    },
  }),
);

const emailFrom = process.env.EMAIL_FROM;
const emailServer = process.env.EMAIL_SERVER;

if (emailFrom && emailServer) {
  providers.push(
    Email({
      from: emailFrom,
      maxAge: 10 * 60, // 10 minutes
      async sendVerificationRequest({ identifier, url }) {
        const email = identifier.toLowerCase();
        const rate = await consumeRateLimit(`auth:magic-link:${email}`);
        if (!rate.success) {
          throw new Error("EmailSignin");
        }

        await ensureMagicLinkUser(email);
        await sendMagicLinkEmail({ email, url });
        await trackEvent({ name: "auth_magic_link_requested", properties: { email } });
      },
    }),
  );
}

if (enableDevLogin) {
  providers.push(
    Credentials({
      name: "Owner Token",
      credentials: {
        token: { label: "Owner token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token?.trim();
        if (!token || token !== "owner-token") {
          return null;
        }

        await ensureDevUser(token);

        return {
          id: token,
          name: "Owner",
          email: "owner-token@coda.dev",
        };
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter: createAuthAdapter(),
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 365 * 24 * 60 * 60, // keep users signed in for up to a year
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (account?.provider === "email" && user?.id) {
        await trackEvent({
          name: "auth_magic_link_verified",
          properties: { userId: user.id },
        });
      }
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

async function ensureDevUser(userId: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({
      id: userId,
      email: "owner-token@coda.dev",
      name: "Owner",
      emailVerified: new Date(),
    }).onConflictDoNothing();
  }
}

async function ensureMagicLinkUser(email: string) {
  const db = getDb();
  const lower = email.toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, lower)).limit(1);
  if (existing.length > 0) {
    return existing[0].id;
  }
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: lower,
  });
  return id;
}
