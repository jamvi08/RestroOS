"use client";

import { signOut } from "next-auth/react";
import { Clock, LogOut, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export function PendingApproval({
  ownerName,
  restaurantName,
  rejected,
}: {
  ownerName: string;
  restaurantName: string;
  rejected: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <Logo href="/" />
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut />
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <span
          className={
            rejected
              ? "inline-flex size-16 items-center justify-center rounded-full bg-destructive-soft text-destructive"
              : "inline-flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary"
          }
        >
          {rejected ? <XCircle className="size-8" /> : <Clock className="size-8" />}
        </span>

        {rejected ? (
          <>
            <h1 className="text-2xl font-bold text-foreground">{restaurantName} was not approved</h1>
            <p className="max-w-sm text-base text-muted-foreground">
              Sorry {ownerName.split(" ")[0]}, we couldn&apos;t approve this restaurant account. Please contact RestroOS support if you think this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Waiting for approval</h1>
            <p className="max-w-sm text-base text-muted-foreground">
              Thanks {ownerName.split(" ")[0]}! We&apos;re checking <strong className="text-foreground">{restaurantName}</strong>. Once it&apos;s approved, you can add your menu, tables and staff here.
            </p>
            <p className="text-[15px] text-muted-foreground">Refresh this page to check.</p>
          </>
        )}
      </main>
    </div>
  );
}
