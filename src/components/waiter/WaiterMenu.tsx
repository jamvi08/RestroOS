"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { VegMark } from "@/components/ui/veg-mark";
import { cn, formatPrice } from "@/lib/utils";
import { WaiterHeader, type WaiterHeaderInfo } from "./WaiterHeader";
import { send } from "./use-waiter-data";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  categories?: { name: string } | null;
};

/** "Dal khatam" — mark dishes sold out so customers can't order them from the QR menu. */
export function WaiterMenu({ header, currency }: { header: WaiterHeaderInfo; currency: string }) {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMenu)
      .catch(() => setError("Could not load the menu. Check the internet and try again."));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (menu ?? []).filter((m) => !q || m.name.toLowerCase().includes(q));
    // Sold-out dishes first, so it's easy to switch them back on
    return list.sort((a, b) => Number(a.isAvailable) - Number(b.isAvailable));
  }, [menu, query]);

  const toggle = async (item: MenuItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      await send(`/api/menu/${item.id}`, { isAvailable: !item.isAvailable }, "PUT");
      setMenu((m) => m?.map((x) => (x.id === item.id ? { ...x, isAvailable: !x.isAvailable } : x)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the dish.");
    } finally {
      setBusyId(null);
    }
  };

  const soldOutCount = (menu ?? []).filter((m) => !m.isAvailable).length;

  return (
    <div className="min-h-dvh bg-background">
      <WaiterHeader {...header} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 pb-10">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sold out dishes</h1>
          <p className="text-[15px] text-muted-foreground">
            When the kitchen runs out, switch the dish off. Customers won&apos;t be able to order it.
            {soldOutCount > 0 && <strong className="text-foreground"> {soldOutCount} sold out now.</strong>}
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input id="soldout-search" placeholder="Search dish" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-11" />
        </div>

        {error && <Notice>{error}</Notice>}
        {!menu && !error && <p className="py-10 text-center text-muted-foreground">Loading menu…</p>}

        <ul className="space-y-2">
          {shown.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="switch"
                aria-checked={m.isAvailable}
                disabled={busyId === m.id}
                onClick={() => toggle(m)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left",
                  m.isAvailable ? "border-border" : "border-destructive bg-destructive-soft"
                )}
              >
                <VegMark isVeg={m.isVeg} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-foreground">{m.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.categories?.name ?? "Other"} · {formatPrice(m.price, currency)}
                  </span>
                </span>
                <span className={cn("text-sm font-bold", m.isAvailable ? "text-success" : "text-destructive")}>
                  {m.isAvailable ? "Available" : "Sold out"}
                </span>
                <span className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors", m.isAvailable ? "bg-success" : "bg-input")}>
                  <span className={cn("absolute size-6 rounded-full bg-white shadow transition-transform", m.isAvailable ? "translate-x-[22px]" : "translate-x-0.5")} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
