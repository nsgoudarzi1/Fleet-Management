import Link from "next/link";
import { Bell, ChevronDown, LogOut, Plus, Search } from "lucide-react";
import { signOut } from "@/lib/auth";
import { DensityToggle } from "@/components/layout/density-toggle";
import { CommandPalette } from "@/components/search/command-palette";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

type TopBarProps = {
  userName: string;
  role: string;
  orgName: string;
};

export function TopBar({ userName, role, orgName }: TopBarProps) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1760px] items-center gap-3 px-4 py-3 lg:px-8">
        <CommandPalette />
        <div className="ml-auto flex items-center gap-2">
          <OrgSwitcher orgName={orgName} />
          <DensityToggle />
          <QuickCreateMenu />
          <Button size="icon" variant="ghost" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <UserMenu userName={userName} role={role} logout={logout} />
        </div>
      </div>
    </header>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function OrgSwitcher({ orgName }: { orgName: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[220px] justify-between gap-2">
          <span className="truncate text-left">{orgName}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-between">
          <span className="truncate">{orgName}</span>
          <Badge variant="outline">Current</Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickCreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/deals/new">Create Deal</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/crm/leads?create=1">Add Lead</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory?create=1">Receive Vehicle</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/fixedops/appointments">Service Appointment</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/accounting?payment=1">Record Payment</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({
  userName,
  role,
  logout,
}: {
  userName: string;
  role: string;
  logout: () => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-[var(--density-control-height)] gap-2 px-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
            {initials(userName) || "U"}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium text-foreground">{userName}</span>
            <span className="block text-[11px] text-muted-foreground">{role}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/audit">Audit Log</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-muted"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
