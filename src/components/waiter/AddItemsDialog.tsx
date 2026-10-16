"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { VegMark } from "@/components/ui/veg-mark";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn, formatPrice } from "@/lib/utils";
import { send } from "./use-waiter-data";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  categories?: { id: string; name: string } | null;
};

/** Waiter taps dishes for a customer who orders by voice ("do thali laga do"). */
export function AddItemsDialog({
  open,
  onOpenChange,
  tableId,
  tableNumber,
  currency,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  tableNumber: string;
  currency: string;
  onAdded: () => void;
}) {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || menu) return;
    fetch("/api/menu", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((items: MenuItem[]) => setMenu(items))
      .catch(() => setError("Could not load the menu. Check the internet and try again."));
  }, [open, menu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (menu ?? []).filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [menu, query]);

  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const m of filtered) {
      const key = m.categories?.name ?? "Other";
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return [...map.entries()];
  }, [filtered]);

  const lines = Object.entries(qty).filter(([, n]) => n > 0);
  const count = lines.reduce((s, [, n]) => s + n, 0);
  const total = lines.reduce((s, [id, n]) => s + (menu?.find((m) => m.id === id)?.price ?? 0) * n, 0);

  const change = (id: string, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(50, (q[id] ?? 0) + delta)) }));

  const reset = () => {
    setQty({});
    setNote("");
    setQuery("");
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/waiter/tables/${tableId}`, {
        action: "add-items",
        items: lines.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
        note,
      });
      reset();
      onAdded();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the order.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Add items · Table {tableNumber}</DialogTitle>
          <DialogDescription>Tap dishes the customer asks for. It goes to the kitchen when you send it.</DialogDescription>
        </DialogHeader>

        <div className="relative px-5">
          <Search className="pointer-events-none absolute top-1/2 left-9 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="menu-search"
            placeholder="Search dish"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5">
          {error && <Notice>{error}</Notice>}
          {!menu && !error && <p className="py-10 text-center text-muted-foreground">Loading menu…</p>}
          {menu && filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">No dish matches “{query}”.</p>}

          {groups.map(([category, items]) => (
            <section key={category} className="space-y-2">
              <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{category}</h3>
              {items.map((m) => {
                const n = qty[m.id] ?? 0;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card p-3",
                      n > 0 ? "border-primary" : "border-border",
                      !m.isAvailable && "opacity-50"
                    )}
                  >
                    <VegMark isVeg={m.isVeg} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{m.name}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {m.isAvailable ? formatPrice(m.price, currency) : "Sold out"}
                      </p>
                    </div>
                    {m.isAvailable &&
                      (n === 0 ? (
                        <button
                          type="button"
                          onClick={() => change(m.id, 1)}
                          className="h-10 min-w-20 rounded-xl border-[1.5px] border-primary px-4 text-base font-bold text-primary"
                        >
                          ADD
                        </button>
                      ) : (
                        <div className="inline-flex items-center rounded-xl border-[1.5px] border-primary bg-primary-soft">
                          <button type="button" aria-label={`One less ${m.name}`} onClick={() => change(m.id, -1)} className="inline-flex size-10 items-center justify-center text-primary">
                            <Minus className="size-4" />
                          </button>
                          <span className="min-w-6 text-center text-base font-bold tabular-nums">{n}</span>
                          <button type="button" aria-label={`One more ${m.name}`} onClick={() => change(m.id, 1)} className="inline-flex size-10 items-center justify-center text-primary">
                            <Plus className="size-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <div className="space-y-3 border-t border-border bg-card px-5 py-4">
          {count > 0 && (
            <Input
              id="order-note"
              placeholder="Note for kitchen (less spicy, no onion…)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          <Button size="lg" className="w-full" disabled={busy || count === 0} onClick={submit}>
            <Send />
            {busy ? "Sending…" : count === 0 ? "Choose dishes" : `Send ${count} items · ${formatPrice(total, currency)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
