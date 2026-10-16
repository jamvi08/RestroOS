"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Check, X, LogOut, Store, MapPin, Phone, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Logo } from "@/components/brand/Logo";
import { EmptyState } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: Status;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
}

const tabs: { status: Status; label: string }[] = [
  { status: "PENDING", label: "Waiting" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
];

export function AdminRestaurants({ adminName, restaurants }: { adminName: string; restaurants: Restaurant[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Status>("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setStatus = async (r: Restaurant, status: Status) => {
    if (status === "REJECTED" && !window.confirm(`Reject ${r.name}? The owner won't be able to use the dashboard.`)) return;
    setBusyId(r.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/restaurants/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not update the restaurant.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the restaurant.");
    } finally {
      setBusyId(null);
    }
  };

  const shown = restaurants.filter((r) => r.status === tab);
  const count = (s: Status) => restaurants.filter((r) => r.status === s).length;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Logo href="/admin" />
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut />
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Restaurant requests</h1>
          <p className="text-base text-muted-foreground">
            Hi {adminName.split(" ")[0]}. Approve real restaurants so their owners can start using RestroOS.
          </p>
        </div>

        <div role="tablist" className="flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.status}
              role="tab"
              aria-selected={tab === t.status}
              onClick={() => setTab(t.status)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 text-[15px] font-semibold",
                tab === t.status ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-2 text-sm tabular-nums",
                  tab === t.status ? "bg-white/20" : "bg-muted text-muted-foreground"
                )}
              >
                {count(t.status)}
              </span>
            </button>
          ))}
        </div>

        {error && <Notice>{error}</Notice>}

        {shown.length === 0 ? (
          <EmptyState
            icon={Store}
            title={tab === "PENDING" ? "No requests waiting" : tab === "APPROVED" ? "No approved restaurants yet" : "No rejected restaurants"}
            description={tab === "PENDING" ? "New restaurant sign-ups will show up here for you to check." : "Restaurants move here when you change their status."}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((r) => (
              <article key={r.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{r.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Signed up {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {r.ownerName && <> · by {r.ownerName}</>}
                  </p>
                </div>

                <dl className="space-y-1.5 text-[15px] text-muted-foreground">
                  {r.ownerEmail && (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Email</dt>
                      <Mail className="size-4 shrink-0" />
                      <dd className="min-w-0 break-all">{r.ownerEmail}</dd>
                    </div>
                  )}
                  {r.phone && (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Phone</dt>
                      <Phone className="size-4 shrink-0" />
                      <dd className="tabular-nums">{r.phone}</dd>
                    </div>
                  )}
                  {r.address && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Address</dt>
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      <dd>{r.address}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-auto flex gap-2">
                  {r.status !== "APPROVED" && (
                    <Button variant="success" className="flex-1" disabled={busyId === r.id} onClick={() => setStatus(r, "APPROVED")}>
                      <Check />
                      Approve
                    </Button>
                  )}
                  {r.status === "PENDING" && (
                    <Button variant="destructive" className="flex-1" disabled={busyId === r.id} onClick={() => setStatus(r, "REJECTED")}>
                      <X />
                      Reject
                    </Button>
                  )}
                  {r.status === "APPROVED" && (
                    <Button variant="destructive" className="flex-1" disabled={busyId === r.id} onClick={() => setStatus(r, "REJECTED")}>
                      <X />
                      Block
                    </Button>
                  )}
                  {r.status === "REJECTED" && (
                    <Button variant="outline" className="flex-1" disabled={busyId === r.id} onClick={() => setStatus(r, "PENDING")}>
                      <RotateCcw />
                      Move to waiting
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
