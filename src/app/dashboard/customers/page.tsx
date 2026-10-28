import Link from "next/link";
import { Check, Contact, Download, MessageCircle } from "lucide-react";
import prisma from "@/lib/prisma";
import { requireManagerPage } from "@/lib/dashboard-session";
import { formatDay } from "@/lib/dates";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

const PAGE_SIZE = 100;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { restaurantId, currency } = await requireManagerPage();
  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);

  const [total, optedIn, otpMode, customers] = await Promise.all([
    prisma.customers.count({ where: { restaurantId } }),
    prisma.customers.count({ where: { restaurantId, offersOptIn: true } }),
    prisma.restaurants.findUnique({ where: { id: restaurantId }, select: { customerOtp: true } }),
    prisma.customers.findMany({
      where: { restaurantId },
      orderBy: { lastSeenAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, phone: true, offersOptIn: true, createdAt: true, lastSeenAt: true },
    }),
  ]);

  // Visits = paid bills sent to that number
  const visits = await prisma.bills.groupBy({
    by: ["customerId"],
    where: { restaurantId, customerId: { in: customers.map((c) => c.id) } },
    _count: true,
    _sum: { totalAmount: true },
  });
  const statsFor = (id: string) => visits.find((v) => v.customerId === id);
  const returning = await prisma.bills.groupBy({
    by: ["customerId"],
    where: { restaurantId, customerId: { not: null } },
    having: { customerId: { _count: { gt: 1 } } },
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Customers"
        description="People who verified their WhatsApp number on your table QR. Their bill goes to WhatsApp."
        actions={
          optedIn > 0 ? (
            <a href="/api/dashboard/customers/export" className={buttonVariants({ variant: "outline" })}>
              <Download /> Offer list (CSV)
            </a>
          ) : undefined
        }
      />

      {otpMode?.customerOtp === "OFF" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#b2f2bb] bg-success-soft p-4 sm:flex-row sm:items-center">
          <MessageCircle className="size-6 shrink-0 text-success" />
          <p className="flex-1 text-[15px] text-foreground">
            Customers aren&apos;t asked for their number yet. Turn it on to send bills on WhatsApp and build a list for offers.
          </p>
          <Link href="/dashboard/settings" className={buttonVariants({ variant: "success", size: "sm" })}>
            Turn on in Settings
          </Link>
        </div>
      )}

      <section className="grid grid-cols-3 gap-3 md:max-w-2xl md:gap-4">
        <StatCard label="Customers" value={total} />
        <StatCard label="Want offers" value={optedIn} />
        <StatCard label="Came back" value={returning.length} hint="2+ bills" />
      </section>

      {customers.length === 0 ? (
        <EmptyState
          icon={Contact}
          title="No customers yet"
          description="When a customer verifies their WhatsApp number on the table QR, they show up here."
        />
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-border text-sm text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">WhatsApp</th>
                <th className="px-4 py-2.5 text-right font-semibold">Visits</th>
                <th className="px-4 py-2.5 text-right font-semibold">Spent</th>
                <th className="px-4 py-2.5 font-semibold">Last visit</th>
                <th className="px-4 py-2.5 font-semibold">Offers</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const s = statsFor(c.id);
                return (
                  <tr key={c.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-foreground">+91 {c.phone}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{s?._count ?? 0}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatPrice(Math.round(s?._sum.totalAmount ?? 0), currency)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDay(c.lastSeenAt)}</td>
                    <td className="px-4 py-2.5">
                      {c.offersOptIn ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                          <Check className="size-4" /> Yes
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pages">
          <Link
            href={`/dashboard/customers?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
          >
            Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            href={`/dashboard/customers?page=${page + 1}`}
            aria-disabled={page >= pages}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}
          >
            Next
          </Link>
        </nav>
      )}
    </div>
  );
}
