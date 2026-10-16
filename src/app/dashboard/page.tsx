import { BookOpen, QrCode, Users, Settings, ClipboardList, TrendingUp, Utensils, ChevronRight, PlusCircle } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/PageHeader";
import { cn, formatPrice } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/signup");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: { restaurants: true }
  });

  if (!user || !user.restaurants) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-base text-muted-foreground">
        We couldn&apos;t find your restaurant profile. Please contact support.
      </div>
    );
  }

  const restaurant = user.restaurants;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalMenuItems, activeMenuItems, tableCount, staffCount, todaysOrders, todaysSales] = await Promise.all([
    prisma.menu_items.count({ where: { restaurantId: restaurant.id } }),
    prisma.menu_items.count({ where: { restaurantId: restaurant.id, isAvailable: true, isActive: true } }),
    prisma.tables.count({ where: { restaurantId: restaurant.id } }),
    prisma.users.count({ where: { restaurantId: restaurant.id, role: "WAITER" } }),
    // Confirmed orders only: unaccepted customer orders and rejected ones don't count
    prisma.orders.count({
      where: { restaurantId: restaurant.id, createdAt: { gte: startOfToday }, status: { notIn: ["RECEIVED", "CANCELLED"] } },
    }),
    prisma.orders.aggregate({
      where: { restaurantId: restaurant.id, createdAt: { gte: startOfToday }, paymentStatus: "PAID" },
      _sum: { totalAmount: true },
    }),
  ]);

  // Customer ratings from the last 30 days (1 = bad, 2 = okay, 3 = good)
  const since30 = new Date(startOfToday);
  since30.setDate(since30.getDate() - 30);
  const [ratingCounts, recentComments] = await Promise.all([
    prisma.feedback.groupBy({
      by: ["rating"],
      where: { restaurantId: restaurant.id, createdAt: { gte: since30 } },
      _count: true,
    }),
    prisma.feedback.findMany({
      where: { restaurantId: restaurant.id, comment: { not: "" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, rating: true, comment: true, tableNumber: true, createdAt: true },
    }),
  ]);
  const countFor = (r: number) => ratingCounts.find((c) => c.rating === r)?._count ?? 0;
  const totalRatings = countFor(1) + countFor(2) + countFor(3);
  const faces = ["😞", "😐", "😊"];

  const firstName = user.name.split(" ")[0];
  const manage = [
    { href: "/dashboard/menu", icon: BookOpen, title: "Menu", detail: `${totalMenuItems} dishes` },
    { href: "/dashboard/tables", icon: QrCode, title: "Tables & QR", detail: `${tableCount} tables` },
    { href: "/dashboard/staff", icon: Users, title: "Staff", detail: `${staffCount} waiters` },
    { href: "/dashboard/settings", icon: Settings, title: "Settings", detail: "Shop details" },
  ];

  // First-run checklist: shown until the owner has a menu and at least one table
  const needsSetup = totalMenuItems === 0 || tableCount === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card text-primary">
          {restaurant.logo ? (
            <img src={restaurant.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Utensils className="size-7" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground md:text-3xl">Namaste, {firstName}</h1>
          <p className="truncate text-base text-muted-foreground">{restaurant.name}</p>
        </div>
      </div>

      {needsSetup && (
        <section className="space-y-4 rounded-2xl border border-[#ffd8a8] bg-primary-soft p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Get ready for your first order</h2>
            <p className="text-[15px] text-muted-foreground">Two steps and customers can start ordering.</p>
          </div>
          <ol className="space-y-3">
            {[
              { done: totalMenuItems > 0, text: "Add your dishes and prices", href: "/dashboard/menu", cta: "Add menu" },
              { done: tableCount > 0, text: "Add tables and print QR codes", href: "/dashboard/tables", cta: "Add tables" },
            ].map((step, i) => (
              <li key={step.href} className="flex items-center gap-3 rounded-xl bg-card p-3">
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    step.done ? "bg-success text-white" : "bg-primary-soft text-primary"
                  )}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <span className={cn("flex-1 text-base font-semibold", step.done && "text-muted-foreground line-through")}>{step.text}</span>
                {!step.done && (
                  <Link href={step.href} className={buttonVariants({ size: "sm" })}>
                    {step.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:gap-4">
        <StatCard
          icon={ClipboardList}
          label="Orders today"
          value={todaysOrders}
          hint={todaysOrders === 0 ? "No orders yet today" : undefined}
        />
        <StatCard
          icon={TrendingUp}
          label="Paid today"
          value={formatPrice(todaysSales._sum.totalAmount ?? 0, restaurant.currency)}
          hint={`${activeMenuItems} of ${totalMenuItems} dishes available`}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Manage</h2>
          <Link href="/dashboard/menu" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-primary")}>
            <PlusCircle /> Add dish
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {manage.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <m.icon className="size-5" />
              </span>
              <span>
                <span className="flex items-center justify-between text-base font-semibold text-foreground">
                  {m.title}
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="block text-sm text-muted-foreground">{m.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-foreground">What customers said</h2>
        {totalRatings === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-[15px] text-muted-foreground">
            No ratings yet. Customers can rate their meal on their phone after the bill is paid.
          </p>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-muted-foreground">Last 30 days · {totalRatings} ratings</p>
            <div className="grid grid-cols-3 gap-2">
              {[3, 2, 1].map((r) => (
                <div key={r} className="flex flex-col items-center rounded-xl bg-muted/60 py-3">
                  <span className="text-2xl" aria-hidden>{faces[r - 1]}</span>
                  <span className="text-xl font-bold tabular-nums text-foreground">{countFor(r)}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{["Not good", "Okay", "Loved it"][r - 1]}</span>
                </div>
              ))}
            </div>
            {recentComments.length > 0 && (
              <ul className="divide-y divide-border">
                {recentComments.map((c) => (
                  <li key={c.id} className="flex gap-3 py-2.5">
                    <span className="text-xl" aria-hidden>{faces[c.rating - 1]}</span>
                    <div className="min-w-0">
                      <p className="text-[15px] text-foreground">{c.comment}</p>
                      <p className="text-sm text-muted-foreground">
                        Table {c.tableNumber} · {c.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
