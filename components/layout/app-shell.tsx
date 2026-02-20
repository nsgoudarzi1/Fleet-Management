import type { ReactNode } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopBar } from "@/components/layout/top-bar";

type AppShellProps = {
  children: ReactNode;
  userName: string;
  role: string;
  orgName: string;
};

export function AppShell({ children, userName, role, orgName }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[1760px]">
        <SidebarNav />
        <div className="min-h-dvh flex-1">
          <TopBar userName={userName} role={role} orgName={orgName} />
          <main className="px-4 py-5 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
