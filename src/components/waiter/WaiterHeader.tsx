"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutGrid, LogOut, BookOpen, ArrowLeftRight, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/waiter", label: "Tables", icon: LayoutGrid },
  { href: "/waiter/menu", label: "Sold out", icon: BookOpen },
];

export type WaiterHeaderInfo = {
  restaurantName: string;
  /** This number is also on another restaurant's staff list */
  canSwitch: boolean;
  /** Managers and owners also get a link to the dashboard */
  isManager: boolean;
};

const headerLink = "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted";

export function WaiterHeader({ restaurantName, canSwitch, isManager }: WaiterHeaderInfo) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-foreground">{restaurantName}</p>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <span className="size-2 rounded-full bg-success" />
            On duty
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {isManager && (
            <Link href="/dashboard" className={headerLink}>
              <LayoutDashboard className="size-4" />
              <span className="max-sm:sr-only">Dashboard</span>
            </Link>
          )}
          {canSwitch && (
            <Link href="/waiter/login?switch=1" className={headerLink}>
              <ArrowLeftRight className="size-4" />
              Switch
            </Link>
          )}
          <button onClick={() => signOut({ callbackUrl: "/waiter/login" })} className={headerLink}>
            <LogOut className="size-4" />
            <span className={cn((canSwitch || isManager) && "max-sm:sr-only")}>Log out</span>
          </button>
        </div>
      </div>
      <nav className="mx-auto grid max-w-3xl grid-cols-2 px-4">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center justify-center gap-2 border-b-[3px] text-[15px] font-semibold",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
