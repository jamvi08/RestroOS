"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Minus, Plus, X, WifiOff, Banknote, Smartphone, UtensilsCrossed, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { VegMark } from "@/components/ui/veg-mark";
import { cn, formatPrice } from "@/lib/utils";
import { AlertCard } from "./AlertCard";
import { AddItemsDialog } from "./AddItemsDialog";
import { SoundBanner } from "./SoundBanner";
import { ORDER_STATUS_LABEL } from "./labels";
import { usePoll, useBoard, send, minutesAgo } from "./use-waiter-data";

type Item = { id: string; name: string; quantity: number; price: number; isVeg: boolean; specialInstructions: string | null };
type Order = {
  id: string;
  status: "RECEIVED" | "PREPARING" | "READY" | "SERVED";
  subtotal: number;
  tax: number;
  totalAmount: number;
  customerNotes: string | null;
  createdAt: string;
  order_items: Item[];
};
type Detail = {
  table: { id: string; tableNumber: string; label: string | null; capacity: number };
  orders: Order[];
  requests: { id: string; type: "CALL_WAITER" | "WATER" | "BILL"; status: "OPEN" | "ACKNOWLEDGED"; createdAt: string }[];
  bill: { subtotal: number; tax: number; total: number };
  taxRate: number;
  phoneConnected: boolean;
};

export function WaiterTable({ tableId, currency }: { tableId: string; currency: string }) {
  const router = useRouter();
  const { data, error, fetchedAt, refresh } = usePoll<Detail>(`/api/waiter/tables/${tableId}`);
  // Keep watching the rest of the floor while this table is open
  const board = useBoard();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const price = (n: number) => formatPrice(n, currency);
  const otherAlerts = board.data?.alerts.filter((a) => a.tableId !== tableId && a.status === "OPEN").length ?? 0;

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      await refresh();
      void board.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const changeQty = (item: Item, quantity: number) => {
    if (quantity === 0 && !window.confirm(`Remove ${item.name} from the order?`)) return;
    void act(`item:${item.id}`, () => send(`/api/waiter/order-items/${item.id}`, { quantity }, "PATCH"));
  };

  const pay = (method: "CASH" | "UPI") => {
    if (!data) return;
    if (!window.confirm(`Table ${data.table.tableNumber} paid ${price(data.bill.total)} by ${method === "CASH" ? "cash" : "UPI"}?\n\nThe table will become free.`)) return;
    void act("pay", async () => {
      await send(`/api/waiter/tables/${tableId}`, { action: "pay", method });
      router.push("/waiter");
    });
  };

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-base text-muted-foreground">{error ?? "Loading table…"}</p>
        <Link href="/waiter" className="font-semibold text-primary">Back to tables</Link>
      </div>
    );
  }

  const newOrders = data.orders.filter((o) => o.status === "RECEIVED");
  const running = data.orders.filter((o) => o.status !== "RECEIVED");
  const hasBill = running.length > 0;

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-2">
          <Link href="/waiter" aria-label="Back to tables" className="inline-flex size-12 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground">Table {data.table.tableNumber}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {data.table.capacity} seats{data.table.label ? ` · ${data.table.label}` : ""}
            </p>
          </div>
        </div>
        {otherAlerts > 0 && (
          <Link href="/waiter" className="block bg-destructive px-4 py-2 text-center text-[15px] font-semibold text-white">
            {otherAlerts} other {otherAlerts === 1 ? "table needs" : "tables need"} you → see board
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-4">
        <SoundBanner />

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-[15px] font-medium text-warning">
            <WifiOff className="size-4 shrink-0" /> {error}
          </div>
        )}
        {actionError && <Notice>{actionError}</Notice>}

        {data.phoneConnected && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <MonitorSmartphone className="size-5 shrink-0 text-success" />
            <p className="min-w-0 flex-1 text-[15px] text-foreground">
              Customer phone connected
              <span className="block text-sm text-muted-foreground">Only that phone can order for this table.</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm("Free this table for a different phone? Use this if the customer changed phones, or if nobody is sitting here.")) {
                  void act("reset-phone", () => send(`/api/waiter/tables/${tableId}`, { action: "reset-phone" }));
                }
              }}
            >
              Change phone
            </Button>
          </div>
        )}

        {data.requests.map((r) => (
          <AlertCard
            key={r.id}
            alert={{ ...r, kind: "REQUEST", tableId, tableNumber: data.table.tableNumber }}
            now={fetchedAt}
            onChange={() => {
              void refresh();
              void board.refresh();
            }}
            showTable={false}
          />
        ))}

        {/* Customer QR orders waiting for the waiter to check and accept */}
        {newOrders.map((o) => (
          <section key={o.id} className="space-y-3 rounded-2xl border-2 border-primary bg-primary-soft p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground">🛎️ New order from customer</h2>
              <span className="shrink-0 text-sm text-muted-foreground">{minutesAgo(o.createdAt, fetchedAt)}</span>
            </div>
            <ul className="space-y-2 rounded-xl bg-card p-3">
              {o.order_items.map((i) => (
                <li key={i.id} className="text-base">
                  <div className="flex items-center gap-2">
                    <VegMark isVeg={i.isVeg} />
                    <span className="font-bold tabular-nums">{i.quantity} ×</span>
                    <span className="min-w-0 flex-1 truncate">{i.name}</span>
                    <span className="tabular-nums text-muted-foreground">{price(i.price * i.quantity)}</span>
                  </div>
                  {i.specialInstructions && (
                    <p className="mt-0.5 pl-6 text-[15px] font-semibold text-warning">📝 {i.specialInstructions}</p>
                  )}
                </li>
              ))}
            </ul>
            {o.customerNotes && <p className="text-[15px] text-foreground">📝 {o.customerNotes}</p>}
            <p className="text-[15px] text-muted-foreground">Confirm with the customer, then accept to send it to the kitchen.</p>
            <div className="flex gap-2">
              <Button
                variant="success"
                size="lg"
                className="flex-[2]"
                disabled={busy !== null}
                onClick={() => act(`accept:${o.id}`, () => send(`/api/waiter/orders/${o.id}`, { action: "accept" }))}
              >
                <Check />
                Accept · {price(o.totalAmount)}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => {
                  if (window.confirm("Reject this order? Use this for wrong or duplicate orders.")) {
                    void act(`reject:${o.id}`, () => send(`/api/waiter/orders/${o.id}`, { action: "reject" }));
                  }
                }}
              >
                <X />
                Reject
              </Button>
            </div>
          </section>
        ))}

        {/* Accepted orders: what's on the table and in the kitchen */}
        {running.length === 0 && newOrders.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-10 text-center">
            <UtensilsCrossed className="mb-3 size-8 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">Nothing ordered yet</p>
            <p className="text-[15px] text-muted-foreground">Tap “Add items” to take the order.</p>
          </div>
        ) : (
          running.map((o, idx) => (
            <section key={o.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-foreground">Order {idx + 1}</h2>
                  <p className={cn("text-sm font-semibold", o.status === "SERVED" ? "text-success" : "text-primary")}>
                    {ORDER_STATUS_LABEL[o.status]} · {minutesAgo(o.createdAt, fetchedAt)}
                  </p>
                </div>
                {o.status !== "SERVED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => act(`served:${o.id}`, () => send(`/api/waiter/orders/${o.id}`, { action: "served" }))}
                  >
                    <Check />
                    Served
                  </Button>
                )}
              </div>
              {o.customerNotes && <p className="text-[15px] text-foreground">📝 {o.customerNotes}</p>}
              <ul className="divide-y divide-border">
                {o.order_items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2">
                    <VegMark isVeg={i.isVeg} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base text-foreground">{i.name}</span>
                      {i.specialInstructions && (
                        <span className="block text-sm font-semibold text-warning">📝 {i.specialInstructions}</span>
                      )}
                      <span className="text-sm tabular-nums text-muted-foreground">{price(i.price)} each</span>
                    </span>
                    <div className="inline-flex items-center rounded-xl border border-border">
                      <button
                        type="button"
                        aria-label={i.quantity === 1 ? `Remove ${i.name}` : `One less ${i.name}`}
                        disabled={busy !== null}
                        onClick={() => changeQty(i, i.quantity - 1)}
                        className="inline-flex size-10 items-center justify-center text-muted-foreground"
                      >
                        {i.quantity === 1 ? <X className="size-4 text-destructive" /> : <Minus className="size-4" />}
                      </button>
                      <span className="min-w-6 text-center text-base font-bold tabular-nums">{i.quantity}</span>
                      <button
                        type="button"
                        aria-label={`One more ${i.name}`}
                        disabled={busy !== null}
                        onClick={() => changeQty(i, i.quantity + 1)}
                        className="inline-flex size-10 items-center justify-center text-muted-foreground"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <span className="w-16 text-right text-base font-semibold tabular-nums">{price(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {hasBill && (
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-base font-bold text-foreground">Bill</h2>
            <dl className="space-y-1 text-base tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <dt>Items</dt>
                <dd>{price(data.bill.subtotal)}</dd>
              </div>
              {data.bill.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Tax ({data.taxRate}%)</dt>
                  <dd>{price(data.bill.tax)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-xl font-bold text-foreground">
                <dt>Total</dt>
                <dd>{price(data.bill.total)}</dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="success" size="lg" disabled={busy !== null || newOrders.length > 0} onClick={() => pay("CASH")}>
                <Banknote />
                Paid cash
              </Button>
              <Button variant="success" size="lg" disabled={busy !== null || newOrders.length > 0} onClick={() => pay("UPI")}>
                <Smartphone />
                Paid UPI
              </Button>
            </div>
            {newOrders.length > 0 && (
              <p className="text-sm text-muted-foreground">Accept or reject the new order before taking payment.</p>
            )}
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl">
          <Button size="lg" className="w-full" onClick={() => setAdding(true)}>
            <Plus />
            Add items
          </Button>
        </div>
      </div>

      <AddItemsDialog
        open={adding}
        onOpenChange={setAdding}
        tableId={tableId}
        tableNumber={data.table.tableNumber}
        currency={currency}
        onAdded={() => {
          void refresh();
          void board.refresh();
        }}
      />
    </div>
  );
}
