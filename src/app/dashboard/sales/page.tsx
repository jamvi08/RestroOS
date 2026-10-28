import { ArrowDownRight, ArrowUpRight, PackagePlus, TrendingUp, Utensils } from "lucide-react";
import prisma from "@/lib/prisma";
import { requireManagerPage } from "@/lib/dashboard-session";
import { formatHour, istDateKey, istDayStart, istHour } from "@/lib/dates";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard/PageHeader";
import { RangeTabs, pickRange } from "@/components/dashboard/RangeTabs";
import { BarList, ColumnChart, type ColumnDatum } from "@/components/dashboard/charts";
import { cn, formatPrice } from "@/lib/utils";

const RANGES = ["today", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];
const RANGE = {
  today: { label: "Today", days: 1, versus: "vs yesterday at this time", min: 3 },
  "7d": { label: "Last 7 days", days: 7, versus: "vs the 7 days before", min: 5 },
  "30d": { label: "Last 30 days", days: 30, versus: "vs the 30 days before", min: 10 },
} satisfies Record<Range, { label: string; days: number; versus: string; min: number }>;
const DAY_MS = 24 * 60 * 60 * 1000;

type ItemRow = { menuItemId: string | null; name: string; price: number; _sum: { quantity: number | null } };
type ItemTotal = { key: string; menuItemId: string | null; name: string; qty: number; revenue: number };

/** One total per dish (a dish whose price changed mid-period has several rows). */
function totalsByDish(rows: ItemRow[], currentName: Map<string, string>) {
  const totals = new Map<string, ItemTotal>();
  for (const r of rows) {
    const key = r.menuItemId ?? `name:${r.name}`;
    const qty = r._sum.quantity ?? 0;
    const t = totals.get(key) ?? { key, menuItemId: r.menuItemId, name: (r.menuItemId && currentName.get(r.menuItemId)) || r.name, qty: 0, revenue: 0 };
    t.qty += qty;
    t.revenue += qty * r.price;
    totals.set(key, t);
  }
  return totals;
}

function Delta({ now, before, versus }: { now: number; before: number; versus: string }) {
  if (before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={cn("inline-flex items-center font-semibold", up ? "text-success" : "text-destructive")}>
        <Icon className="size-4" />
        {Math.abs(pct)}%
      </span>
      <span>{versus}</span>
    </span>
  );
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { restaurantId, currency } = await requireManagerPage();
  const range = pickRange((await searchParams).range, RANGES);
  const { days, versus, min } = RANGE[range];
  const price = (n: number) => formatPrice(Math.round(n), currency);

  // This period, and the same length of time just before it
  const now = new Date();
  const from = istDayStart(days - 1);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);
  const prevTo = new Date(now.getTime() - days * DAY_MS);
  const live = { restaurantId, status: { not: "CANCELLED" as const } };
  const thisPeriod = { ...live, createdAt: { gte: from } };
  const lastPeriod = { ...live, createdAt: { gte: prevFrom, lt: prevTo } };
  const itemsBy = ["menuItemId", "name", "price"] as const;

  const [orders, prevOrders, items, prevItems, bills, prevBills, menu, categories] = await Promise.all([
    prisma.orders.findMany({ where: thisPeriod, select: { createdAt: true, totalAmount: true } }),
    prisma.orders.aggregate({ where: lastPeriod, _sum: { totalAmount: true }, _count: true }),
    prisma.order_items.groupBy({ by: [...itemsBy], where: { orders: thisPeriod }, _sum: { quantity: true } }),
    prisma.order_items.groupBy({ by: [...itemsBy], where: { orders: lastPeriod }, _sum: { quantity: true } }),
    prisma.bills.aggregate({ where: { restaurantId, createdAt: { gte: from } }, _sum: { totalAmount: true }, _count: true }),
    prisma.bills.aggregate({ where: { restaurantId, createdAt: { gte: prevFrom, lt: prevTo } }, _sum: { totalAmount: true }, _count: true }),
    prisma.menu_items.findMany({ where: { restaurantId }, select: { id: true, name: true, categoryId: true, isActive: true, createdAt: true } }),
    prisma.categories.findMany({ where: { restaurantId }, select: { id: true, name: true } }),
  ]);

  const currentName = new Map(menu.map((m) => [m.id, m.name]));
  const dishes = totalsByDish(items, currentName);
  const prevDishes = totalsByDish(prevItems, currentName);

  const sales = orders.reduce((s, o) => s + o.totalAmount, 0);
  const prevSales = prevOrders._sum.totalAmount ?? 0;
  const itemsSold = [...dishes.values()].reduce((n, d) => n + d.qty, 0);
  const avgBill = bills._count > 0 ? (bills._sum.totalAmount ?? 0) / bills._count : 0;
  const prevAvgBill = prevBills._count > 0 ? (prevBills._sum.totalAmount ?? 0) / prevBills._count : 0;

  // Sales over time: by hour today, by day otherwise
  let overTime: ColumnDatum[] = [];
  let busyHours: ColumnDatum[] = [];
  const hourRange = (hours: number[], last: number) => {
    if (hours.length === 0) return [];
    const start = Math.min(...hours);
    return Array.from({ length: Math.max(last, Math.max(...hours)) - start + 1 }, (_, i) => start + i);
  };
  if (range === "today") {
    const byHour = new Map<number, number>();
    for (const o of orders) byHour.set(istHour(o.createdAt), (byHour.get(istHour(o.createdAt)) ?? 0) + o.totalAmount);
    overTime = hourRange([...byHour.keys()], istHour(now)).map((h) => ({
      key: String(h),
      axisLabel: formatHour(h),
      label: formatHour(h),
      value: byHour.get(h) ?? 0,
      display: price(byHour.get(h) ?? 0),
    }));
  } else {
    const byDay = new Map<string, number>();
    const ordersByHour = new Map<number, number>();
    for (const o of orders) {
      byDay.set(istDateKey(o.createdAt), (byDay.get(istDateKey(o.createdAt)) ?? 0) + o.totalAmount);
      ordersByHour.set(istHour(o.createdAt), (ordersByHour.get(istHour(o.createdAt)) ?? 0) + 1);
    }
    overTime = Array.from({ length: days }, (_, i) => {
      const day = new Date(from.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000); // midday IST, safely inside the day
      const key = istDateKey(day);
      const value = byDay.get(key) ?? 0;
      return {
        key,
        axisLabel: days <= 7 ? day.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" }) : key.slice(8).replace(/^0/, ""),
        label: day.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }),
        value,
        display: price(value),
      };
    });
    busyHours = hourRange([...ordersByHour.keys()], 0).map((h) => {
      const n = ordersByHour.get(h) ?? 0;
      return { key: String(h), axisLabel: formatHour(h), label: formatHour(h), value: n, display: `${n} ${n === 1 ? "order" : "orders"}` };
    });
  }

  // Top sellers, with how they did last period
  const ranked = [...dishes.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const top = ranked.slice(0, 10);

  // Selling noticeably more than last period: make sure there's stock for these
  const rising = ranked
    .map((d) => ({ ...d, before: prevDishes.get(d.key)?.qty ?? 0 }))
    .filter((d) => d.qty >= min && d.qty >= d.before * 1.25 && d.qty > d.before)
    .sort((a, b) => b.qty - b.before - (a.qty - a.before))
    .slice(0, 5);

  // On the menu the whole period and nobody ordered it
  const notSelling =
    range === "today"
      ? []
      : menu.filter((m) => m.isActive && m.createdAt < from && !dishes.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));

  // Share of sales by menu category
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const categoryOf = new Map(menu.map((m) => [m.id, categoryName.get(m.categoryId) ?? "Other"]));
  const byCategory = new Map<string, number>();
  for (const d of dishes.values()) {
    const name = (d.menuItemId && categoryOf.get(d.menuItemId)) || "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + d.revenue);
  }
  const categoryTotal = [...byCategory.values()].reduce((s, v) => s + v, 0);
  const categoryRows = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      key: name,
      name,
      value,
      display: price(value),
      sub: categoryTotal > 0 ? `${Math.round((value / categoryTotal) * 100)}%` : undefined,
    }));

  const change = (d: ItemTotal) => {
    const before = prevDishes.get(d.key)?.qty ?? 0;
    if (before === 0) return <span className="text-muted-foreground">new</span>;
    const pct = Math.round(((d.qty - before) / before) * 100);
    if (pct === 0) return <span className="text-muted-foreground">same</span>;
    return (
      <span className={cn("inline-flex items-center font-semibold", pct > 0 ? "text-success" : "text-destructive")}>
        {pct > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
        {Math.abs(pct)}%
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Sales" description="What's selling, when you're busy, and what to stock up on. Cancelled orders don't count." />

      <RangeTabs basePath="/dashboard/sales" current={range} options={RANGES.map((r) => ({ value: r, label: RANGE[r].label }))} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Sales" value={price(sales)} hint={<Delta now={sales} before={prevSales} versus={versus} />} />
        <StatCard label="Orders" value={orders.length} hint={<Delta now={orders.length} before={prevOrders._count} versus={versus} />} />
        <StatCard
          label="Average bill"
          value={bills._count > 0 ? price(avgBill) : "–"}
          hint={bills._count > 0 ? <Delta now={avgBill} before={prevAvgBill} versus={versus} /> : "No paid bills yet"}
        />
        <StatCard label="Dishes sold" value={itemsSold} />
      </section>

      {orders.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No orders in this period" description="Once orders come in, you'll see what sells and when you're busiest." />
      ) : (
        <>
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
            <h2 className="text-lg font-bold text-foreground">{range === "today" ? "Sales by hour" : "Sales by day"}</h2>
            <ColumnChart
              data={overTime}
              labelEvery={range === "30d" ? 5 : range === "today" && overTime.length > 8 ? 2 : 1}
              labelHeading={range === "today" ? "Hour" : "Day"}
              valueHeading="Sales"
            />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <PackagePlus className="size-5 text-primary" /> Stock up on these
                </h2>
                <p className="text-[15px] text-muted-foreground">Selling a lot more than before ({versus.replace("vs ", "")}).</p>
              </div>
              {rising.length === 0 ? (
                <p className="text-[15px] text-muted-foreground">Nothing is selling much faster than usual. Your top sellers below are the safe bet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {rising.map((d) => (
                    <li key={d.key} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-base font-semibold text-foreground">{d.name}</span>
                      <span className="shrink-0 text-[15px] tabular-nums text-muted-foreground">
                        <strong className="text-foreground">{d.qty}</strong> sold{d.before > 0 ? `, was ${d.before}` : ", new"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
              <h2 className="text-lg font-bold text-foreground">Sales by category</h2>
              <BarList rows={categoryRows} />
            </section>
          </div>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
            <h2 className="text-lg font-bold text-foreground">Top sellers</h2>
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <table className="w-full min-w-[440px] text-left text-[15px]">
                <thead>
                  <tr className="border-b border-border text-sm text-muted-foreground">
                    <th className="w-8 py-2 font-semibold">#</th>
                    <th className="py-2 font-semibold">Dish</th>
                    <th className="w-[30%] py-2 font-semibold">Sold</th>
                    <th className="py-2 text-right font-semibold">Sales</th>
                    <th className="py-2 text-right font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((d, i) => (
                    <tr key={d.key} className="border-b border-border last:border-b-0">
                      <td className="py-2.5 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="max-w-0 truncate py-2.5 pr-3 font-semibold text-foreground">{d.name}</td>
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.max(4, (d.qty / top[0].qty) * 70)}%` }} />
                          <span className="tabular-nums text-foreground">{d.qty}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-foreground">{price(d.revenue)}</td>
                      <td className="py-2.5 text-right text-sm">{change(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {range !== "today" && (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Busy hours</h2>
                  <p className="text-[15px] text-muted-foreground">Orders by time of day. Plan staff and prep around the tall ones.</p>
                </div>
                <ColumnChart data={busyHours} labelEvery={busyHours.length > 8 ? 3 : 1} labelHeading="Hour" valueHeading="Orders" />
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <Utensils className="size-5 text-muted-foreground" /> Not ordered at all
                  </h2>
                  <p className="text-[15px] text-muted-foreground">
                    On the menu the whole {RANGE[range].label.toLowerCase().replace("last ", "")} and nobody ordered them. Promote them,
                    or take them off and buy less of what goes in.
                  </p>
                </div>
                {notSelling.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">Every dish sold at least once. 👍</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {notSelling.map((m) => (
                      <li key={m.id} className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
                        {m.name}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
