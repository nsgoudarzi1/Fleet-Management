import { PrismaAdapter } from "@auth/prisma-adapter";
import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
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

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
}

function getRateLimitConfig() {
  const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60);
  const authMax = Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10);
  return {
    windowSeconds: Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : 60,
    authMax: Number.isFinite(authMax) && authMax > 0 ? authMax : 10,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: getAuthSecret(),
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
        const rateLimitConfig = getRateLimitConfig();
        try {
          const rate = await consumeRateLimit({
            scope: "auth:sign-in",
            key: `${ip}:${email.toLowerCase()}`,
            limit: rateLimitConfig.authMax,
            windowSeconds: rateLimitConfig.windowSeconds,
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

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: {
              memberships: {
                include: { org: true },
              },
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
            logger.error("Auth failed because database schema is not initialized.", {
              prismaCode: error.code,
              prismaMeta: error.meta,
              hint: "Run `prisma migrate deploy` against the same DATABASE_URL used at runtime.",
            });
          }
          throw error;
        }
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
