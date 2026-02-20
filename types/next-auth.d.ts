import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";
import type { MembershipToken } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      orgId: string;
      role: Role;
      memberships: MembershipToken[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    orgId?: string;
    role?: Role;
    memberships?: MembershipToken[];
  }
}
