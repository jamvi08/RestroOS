import Link from "next/link";
import { ChevronDown, MessageCircle, Receipt } from "lucide-react";
import prisma from "@/lib/prisma";
import { requireManagerPage } from "@/lib/dashboard-session";
import { billLines } from "@/lib/bills";
import { maskPhone } from "@/lib/customer";
import { formatDay, formatTime, istDateKey, istDayStart } from "@/lib/dates";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard/PageHeader";
import { RangeTabs, pickRange } from "@/components/dashboard/RangeTabs";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

const RANGES = ["today", "yesterday", "7d", "30d"] as const;
const RANGE_LABELS = { today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days" };
const PAGE_SIZE = 50;

function rangeDates(range: (typeof RANGES)[number]) {
  if (range === "yesterday") return { from: istDayStart(1), to: istDayStart(0) };
  if (range === "7d") return { from: istDayStart(6), to: undefined };
  if (range === "30d") return { from: istDayStart(29), to: undefined };
  return { from: istDayStart(0), to: undefined };
}

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { restaurantId, currency } = await requireManagerPage();
  const params = await searchParams;
  const range = pickRange(params.range, RANGES);
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const { from, to } = rangeDates(range);
  const where = { restaurantId, createdAt: { gte: from, ...(to && { lt: to }) } };
  const price = (n: number) => formatPrice(n, currency);

  const [byMethod, bills, olderPaid] = await Promise.all([
    prisma.bills.groupBy({ by: ["paymentMethod"], where, _sum: { totalAmount: true }, _count: true }),
    prisma.bills.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        billNumber: true,
        tableNumber: true,
        subtotal: true,
        tax: true,
        totalAmount: true,
        paymentMethod: true,
        whatsappSentAt: true,
        createdAt: true,
        customers: { select: { phone: true } },
        users: { select: { name: true } },
        orders: { select: { taxRate: true, order_items: { select: { name: true, price: true, quantity: true } } } },
      },
    }),
    // Paid before bill numbers existed: counted in Sales, not listed here
    prisma.orders.count({ where: { ...where, paymentStatus: "PAID", billId: null } }),
  ]);

  const sumFor = (m: string) => byMethod.find((b) => b.paymentMethod === m)?._sum.totalAmount ?? 0;
  const count = byMethod.reduce((n, b) => n + b._count, 0);
  const total = byMethod.reduce((s, b) => s + (b._sum.totalAmount ?? 0), 0);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const multiDay = range === "7d" || range === "30d";
  const pageLink = (p: number) => `/dashboard/bills?range=${range}&page=${p}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Bills" description="Every bill your restaurant has generated. Tap a bill to see what was on it." />

      <RangeTabs basePath="/dashboard/bills" current={range} options={RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Collected" value={price(Math.round(total))} />
        <StatCard label="Bills" value={count} hint={count > 0 ? `Avg ${price(Math.round(total / count))}` : undefined} />
        <StatCard label="Cash" value={price(Math.round(sumFor("CASH")))} />
        <StatCard label="UPI" value={price(Math.round(sumFor("UPI")))} />
      </section>

      {olderPaid > 0 && (
        <p className="rounded-xl bg-muted px-4 py-3 text-[15px] text-muted-foreground">
          {olderPaid} paid {olderPaid === 1 ? "order" : "orders"} from before bill numbers started aren&apos;t listed here. They still count in Sales.
        </p>
      )}

      {bills.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          description="A bill is made when a waiter taps Paid cash or Paid UPI on a table."
          action={
            range !== "30d" ? (
              <Link href="/dashboard/bills?range=30d" className={buttonVariants({ variant: "outline" })}>
                See last 30 days
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          {bills.map((b, idx) => {
            const showDay = multiDay && (idx === 0 || istDateKey(bills[idx - 1].createdAt) !== istDateKey(b.createdAt));
            const taxRate = b.orders[0]?.taxRate;
            return (
              <div key={b.id}>
                {showDay && (
                  <h2 className="border-b border-border bg-muted/60 px-4 py-2 text-sm font-bold text-muted-foreground">{formatDay(b.createdAt)}</h2>
                )}
                <details className="group border-b border-border last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                    <span className="w-14 shrink-0 text-base font-bold tabular-nums text-foreground">#{b.billNumber}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-foreground">Table {b.tableNumber}</span>
                      <span className="block text-sm text-muted-foreground">
                        {formatTime(b.createdAt)} · {b.paymentMethod === "UPI" ? "UPI" : "Cash"}
                        {b.users && ` · ${b.users.name}`}
                      </span>
                    </span>
                    {b.whatsappSentAt && (
                      <MessageCircle className="size-4 shrink-0 text-success" aria-label="Sent on WhatsApp" />
                    )}
                    <span className="shrink-0 text-base font-bold tabular-nums text-foreground">{price(b.totalAmount)}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-3 bg-muted/30 px-4 py-3 md:pl-[4.75rem]">
                    <ul className="space-y-1">
                      {billLines(b.orders).map((l) => (
                        <li key={`${l.name}|${l.price}`} className="flex justify-between gap-3 text-[15px]">
                          <span className="min-w-0 truncate text-foreground">
                            <span className="font-semibold tabular-nums">{l.quantity} ×</span> {l.name}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{price(l.price * l.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="space-y-0.5 border-t border-border pt-2 text-[15px] tabular-nums">
                      <div className="flex justify-between text-muted-foreground">
                        <dt>Items</dt>
                        <dd>{price(b.subtotal)}</dd>
                      </div>
                      {b.tax > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <dt>Tax{taxRate ? ` (${taxRate}%)` : ""}</dt>
                          <dd>{price(b.tax)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-foreground">
                        <dt>Total</dt>
                        <dd>{price(b.totalAmount)}</dd>
                      </div>
                    </dl>
                    {b.customers && (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageCircle className="size-4 text-success" />
                        Customer {maskPhone(b.customers.phone)} · {b.whatsappSentAt ? "bill sent on WhatsApp" : "WhatsApp bill not sent"}
                      </p>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </section>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pages">
          <Link
            href={pageLink(page - 1)}
            aria-disabled={page <= 1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
          >
            Newer
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            href={pageLink(page + 1)}
            aria-disabled={page >= pages}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}
          >
            Older
          </Link>
        </nav>
      )}
    </div>
  );
}
