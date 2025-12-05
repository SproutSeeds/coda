import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";

import { createAuthAdapter } from "@/lib/auth/adapter";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { findOrCreateUserByEmail } from "@/lib/auth/users";
import { getDb } from "@/lib/db";
import { getThemePreference } from "@/lib/db/theme-preferences";
import { users } from "@/lib/db/schema";
import { trackEvent } from "@/lib/utils/analytics";
import { ensureRequiredDocumentAcceptances } from "@/lib/legal/acceptance";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

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
  logger: {
    error(code, metadata) {
      // Suppress JWT expiration errors - they're handled gracefully
      if (code === "JWT_SESSION_ERROR") return;
      console.error("[next-auth][error]", code, metadata);
    },
    warn(code) {
      console.warn("[next-auth][warn]", code);
    },
    debug(code, metadata) {
      // Uncomment for debugging: console.debug("[next-auth][debug]", code, metadata);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as Record<string, unknown>).id = token.sub;
        const sessionUser = session.user as typeof session.user & { theme?: "light" | "dark" };
        if (!sessionUser.theme) {
          const preference = await getThemePreference(token.sub);
          if (preference?.theme) {
            sessionUser.theme = preference.theme;
          }
        }
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
      if (user?.id) {
        await ensureRequiredDocumentAcceptances(user.id);
      }
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

async function ensureMagicLinkUser(email: string) {
  const user = await findOrCreateUserByEmail(email);
  return user.id;
}
