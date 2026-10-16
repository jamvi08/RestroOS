"use client";

import Link from "next/link";
import { WifiOff, LayoutGrid } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { WaiterHeader } from "./WaiterHeader";
import { SoundBanner } from "./SoundBanner";
import { AlertCard } from "./AlertCard";
import { TABLE_STATE } from "./labels";
import { useBoard, minutesAgo } from "./use-waiter-data";

export function WaiterBoard({ restaurantName, currency }: { restaurantName: string; currency: string }) {
  const { data, error, fetchedAt, refresh } = useBoard();

  return (
    <div className="min-h-dvh bg-background">
      <WaiterHeader restaurantName={restaurantName} />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-4 pb-10">
        <SoundBanner />

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-[15px] font-medium text-warning">
            <WifiOff className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {!data ? (
          <p className="py-16 text-center text-base text-muted-foreground">Loading tables…</p>
        ) : (
          <>
            {data.alerts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-foreground">
                  Needs you now <span className="text-primary">({data.alerts.length})</span>
                </h2>
                {data.alerts.map((a) => (
                  <AlertCard key={a.key} alert={a} now={fetchedAt} onChange={refresh} />
                ))}
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">All tables</h2>
              {data.tables.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-10 text-center">
                  <LayoutGrid className="mb-3 size-8 text-muted-foreground" />
                  <p className="text-base font-semibold text-foreground">No tables yet</p>
                  <p className="text-[15px] text-muted-foreground">Ask your manager to add tables in the dashboard.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.tables.map((t) => {
                    const s = TABLE_STATE[t.state];
                    return (
                      <Link
                        key={t.id}
                        href={`/waiter/tables/${t.id}`}
                        className={cn("flex min-h-28 flex-col justify-between rounded-2xl border-2 p-3.5", s.tile)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-3xl font-bold tabular-nums text-foreground">{t.tableNumber}</span>
                          <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                            <span className={cn("size-2.5 rounded-full", s.dot, t.state === "HELP" && "animate-pulse")} />
                            {s.label}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t.state === "FREE" ? (
                            <>{t.capacity} seats{t.label ? ` · ${t.label}` : ""}</>
                          ) : (
                            <>
                              {t.itemCount > 0 && (
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatPrice(t.runningTotal, currency)} · {t.itemCount} items
                                </span>
                              )}
                              {t.since && <span className="block">since {minutesAgo(t.since, fetchedAt).replace(" ago", "")}</span>}
                            </>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
