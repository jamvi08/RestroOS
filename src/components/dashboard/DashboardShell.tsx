"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, QrCode, Settings, LogOut, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Menu", href: "/dashboard/menu", icon: BookOpen },
  { name: "Tables & QR", short: "Tables", href: "/dashboard/tables", icon: QrCode },
  { name: "Staff", href: "/dashboard/staff", icon: Users },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar (tablet & desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Logo href="/dashboard" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold transition-colors",
                  active ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-5" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <Logo href="/dashboard" />
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-muted-foreground hover:bg-muted"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </header>

        <main className="flex-1 pb-24 md:pb-0">{children}</main>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className={cn("inline-flex h-7 w-12 items-center justify-center rounded-full", active && "bg-primary-soft")}>
                  <item.icon className="size-5" />
                </span>
                {item.short ?? item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
