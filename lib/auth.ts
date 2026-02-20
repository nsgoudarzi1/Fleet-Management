import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { getAppConfig } from "@/lib/config";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { consumeRateLimit, requestIp } from "@/lib/services/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type MembershipToken = {
  orgId: string;
  orgName: string;
  role: Role;
};

const normalizeMemberships = (
  memberships: Array<{ orgId: string; role: Role; org: { name: string } }>,
): MembershipToken[] =>
  memberships.map((membership) => ({
    orgId: membership.orgId,
    orgName: membership.org.name,
    role: membership.role,
  }));

function pickCurrentMembership(jwt: JWT) {
  const memberships = (jwt.memberships as MembershipToken[] | undefined) ?? [];
  if (!memberships.length) return null;
  if (jwt.orgId) {
    return memberships.find((membership) => membership.orgId === jwt.orgId) ?? memberships[0];
  }
  return memberships[0];
}

const appConfig = getAppConfig();

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: appConfig.authSecret,
  session: { strategy: "jwt" },
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = request instanceof Request ? requestIp(request) : "unknown";
        try {
          const rate = await consumeRateLimit({
            scope: "auth:sign-in",
            key: `${ip}:${email.toLowerCase()}`,
            limit: appConfig.RATE_LIMIT_AUTH_MAX,
            windowSeconds: appConfig.RATE_LIMIT_WINDOW_SECONDS,
          });
          if (!rate.allowed) {
            logger.warn("Auth rate limit exceeded", { email, ip });
            return null;
          }
        } catch (error) {
          // Fail open on rate-limit infrastructure errors to avoid auth outages.
          logger.error("Auth rate limiter unavailable", {
            email,
            ip,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            memberships: {
              include: { org: true },
            },
          },
        });
        if (!user || !user.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.userId = user.id;
      }

      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId },
          include: {
            memberships: {
              include: {
                org: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        const memberships = normalizeMemberships(dbUser?.memberships ?? []);
        token.memberships = memberships;

        const preferredOrgId = trigger === "update" ? (session as { orgId?: string } | undefined)?.orgId : token.orgId;
        const current = memberships.find((membership) => membership.orgId === preferredOrgId) ?? memberships[0];
        if (current) {
          token.orgId = current.orgId;
          token.role = current.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      const currentMembership = pickCurrentMembership(token);
      session.user.id = token.userId ?? "";
      session.user.orgId = currentMembership?.orgId ?? "";
      session.user.role = currentMembership?.role ?? Role.VIEWER;
      session.user.memberships = (token.memberships as MembershipToken[] | undefined) ?? [];
      return session;
    },
  },
});
