import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import type { Adapter } from "next-auth/adapters";
import { sendWelcomeEmail } from "./mail";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as any) as Adapter,
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email, deletedAt: null },
          select: { id: true, name: true, email: true, image: true, password: true },
        });

        if (!user || !user.password) return null;

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      // This block forces Google to show the account selection screen
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Block soft-deleted users from signing in via any provider (Google, Email, etc.)
      if (user?.id) {
        const dbUser = await prisma.user.findFirst({
          where: { id: user.id, deletedAt: null },
          select: { id: true },
        });
        if (!dbUser) return false;
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Enforce immediate session revocation if the user is soft-deleted
        const dbUser = await prisma.user.findFirst({
          where: { id: token.sub, deletedAt: null },
          select: { id: true }
        });
        if (!dbUser) {
          // Return an empty session instead of throwing — throwing causes error=Callback redirect loop
          session.user = undefined as any;
          return session;
        }
        
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email) {
        try {
          await sendWelcomeEmail(user.email, user.name || "there");
        } catch (err) {
          console.error("Non-blocking error: Failed to send welcome email for OAuth signup", err);
        }
      }
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verifyRequest=1",
  },
};

// ─── Shared auth helper for server actions that take organizationId ──────────
// Verifies: (1) valid session, (2) org exists, (3) user has membership OR is super admin.
// Mirrors the exact pattern from getDropPerformance / getAnalyticsVelocity.
// Import: import { verifyOrgAccess } from "@/lib/auth";

import { getServerSession } from "next-auth";

export async function verifyOrgAccess(organizationId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized: No session");

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin =
    !!process.env.SUPER_ADMIN_EMAIL &&
    session.user.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find(
    (m: any) => m.user.email === session.user?.email
  );
  if (!membership && !isSuperAdmin)
    throw new Error("Forbidden: User does not belong to this organization");
}