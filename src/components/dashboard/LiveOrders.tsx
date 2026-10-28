"use client";

import Link from "next/link";
import { ChevronRight, ClipboardList, WifiOff } from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard/PageHeader";
import { VegMark } from "@/components/ui/veg-mark";
import { REQUEST_LABEL, ORDER_STATUS_LABEL } from "@/components/waiter/labels";
import { minutesAgo } from "@/components/waiter/use-waiter-data";
import { usePoll } from "@/lib/use-poll";
import { formatTime } from "@/lib/dates";
import { cn, formatPrice } from "@/lib/utils";
import type { LiveTable } from "@/lib/board";

type Live = { tables: LiveTable[]; paidToday: { total: number; bills: number } };

export function LiveOrders({ currency }: { currency: string }) {
  const { data, error, fetchedAt } = usePoll<Live>("/api/dashboard/live");
  const price = (n: number) => formatPrice(n, currency);

  const tables = data?.tables ?? [];
  const newOrders = tables.reduce((n, t) => n + t.orders.filter((o) => o.isNew).length, 0);
  const running = tables.reduce((s, t) => s + t.total, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Live orders" description="Every table that's eating right now and what they ordered. Updates by itself." />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-[15px] font-medium text-warning">
          <WifiOff className="size-4 shrink-0" /> {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Tables eating" value={data ? tables.length : "–"} />
        <StatCard
          label="New, not seen yet"
          value={data ? newOrders : "–"}
          hint={newOrders > 0 ? "No waiter has tapped “Got it”" : undefined}
        />
        <StatCard label="Running bills" value={data ? price(Math.round(running)) : "–"} hint="Not paid yet" />
        <Link href="/dashboard/bills" className="rounded-2xl transition-colors hover:[&>div]:border-primary">
          <StatCard
            label="Paid today"
            value={data ? price(Math.round(data.paidToday.total)) : "–"}
            hint={data ? `${data.paidToday.bills} ${data.paidToday.bills === 1 ? "bill" : "bills"} →` : undefined}
          />
        </Link>
      </section>

      {!data ? (
        <p className="py-16 text-center text-base text-muted-foreground">Loading orders…</p>
      ) : tables.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tables are eating right now"
          description="Orders show up here the moment a customer orders from the QR or a waiter adds items."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {tables.map((t) => (
            <article key={t.tableId} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Table {t.tableNumber}</h2>
                  <p className="text-sm text-muted-foreground">since {minutesAgo(t.since, fetchedAt).replace(" ago", "")}</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-foreground">{price(t.total)}</p>
              </div>

              {t.requests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {t.requests.map((r) => (
                    <span
                      key={r.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                        r.status === "OPEN" ? "bg-destructive-soft text-destructive" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span aria-hidden>{REQUEST_LABEL[r.type].icon}</span>
                      {REQUEST_LABEL[r.type].text}
                      {r.status === "ACKNOWLEDGED" && " · waiter coming"}
                    </span>
                  ))}
                </div>
              )}

              {t.orders.map((o) => (
                <div key={o.id} className={cn("space-y-1.5 rounded-xl p-3", o.isNew ? "bg-primary-soft" : "bg-muted/60")}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    {o.isNew && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">New</span>}
                    <span>{formatTime(new Date(o.createdAt))}</span>
                    <span aria-hidden>·</span>
                    <span className={o.status === "SERVED" ? "text-success" : "text-primary"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                    <span className="ml-auto tabular-nums text-foreground">{price(o.total)}</span>
                  </p>
                  <ul className="space-y-1">
                    {o.items.map((i, idx) => (
                      <li key={idx} className="text-[15px] text-foreground">
                        <span className="flex items-center gap-2">
                          <VegMark isVeg={i.isVeg} />
                          <span className="font-semibold tabular-nums">{i.quantity} ×</span>
                          <span className="min-w-0 truncate">{i.name}</span>
                        </span>
                        {i.note && <span className="block pl-6 text-sm font-semibold text-warning">📝 {i.note}</span>}
                      </li>
                    ))}
                  </ul>
                  {o.notes && <p className="text-sm text-foreground">📝 {o.notes}</p>}
                </div>
              ))}

              <Link
                href={`/waiter/tables/${t.tableId}`}
                className="mt-auto inline-flex items-center gap-1 self-end text-[15px] font-semibold text-primary hover:underline"
              >
                Open table <ChevronRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
