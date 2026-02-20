import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  const membership = session.user.memberships.find((item) => item.orgId === session.user.orgId) ?? session.user.memberships[0];

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? "User"}
      role={session.user.role}
      orgName={membership?.orgName ?? "Organization"}
    >
      {children}
    </AppShell>
  );
}
