"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import {
  Building2,
  CarFront,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  UserSquare2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Dashboard: LayoutDashboard,
  Inventory: CarFront,
  "Fixed Ops": Wrench,
  Customers: Users,
  Leads: UserSquare2,
  Deals: ClipboardList,
  Funding: HandCoins,
  Accounting: HandCoins,
  Settings,
};

export function SidebarNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("fleetflow:sidebar-collapsed") === "true";
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("fleetflow:sidebar-collapsed", String(next));
      return next;
    });
  };

  const groups = useMemo(
    () => ({
      Workspace: NAV_ITEMS.filter((item) => ["Dashboard", "Inventory", "Fixed Ops", "Customers", "Leads", "Deals", "Funding", "Accounting"].includes(item.label)),
      Admin: NAV_ITEMS.filter((item) => item.label === "Settings"),
    }),
    [],
  );

  return (
    <aside className={cn("sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-card lg:flex lg:flex-col", collapsed ? "w-[76px]" : "w-64")}>
      <div className={cn("flex items-center border-b border-border px-4 py-4", collapsed ? "justify-center" : "justify-between gap-2")}>
        <div className="inline-flex items-center gap-2 overflow-hidden">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">FleetFlow</p>
              <p className="text-sm font-semibold text-foreground">Dealer OS</p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <Button type="button" size="icon" variant="ghost" onClick={toggleCollapsed} aria-label="Collapse sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <nav className="flex flex-1 flex-col gap-4 px-2 py-4">
        {Object.entries(groups).map(([label, items]) => (
          <div key={label} className="space-y-1">
            {!collapsed ? <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p> : null}
            {items.map((item) => {
              const Icon = ICONS[item.label] ?? LayoutDashboard;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    collapsed ? "justify-center" : "gap-2.5",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-2">
        <Button
          type="button"
          variant="ghost"
          className={cn("w-full", collapsed ? "justify-center" : "justify-start")}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed ? <span className="ml-2">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
