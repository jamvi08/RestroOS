import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { MANAGER_ROLES, requireStaff } from "@/lib/staff-auth";
import { istDateKey } from "@/lib/dates";

// GET /api/dashboard/customers/export - CSV of customers who said yes to offers on WhatsApp.
// Only those: numbers collected for e-bills alone aren't for marketing.
export async function GET() {
  try {
    const auth = await requireStaff(MANAGER_ROLES);
    if ("response" in auth) return auth.response;
    const { restaurantId } = auth.staff;

    const customers = await prisma.customers.findMany({
      where: { restaurantId, offersOptIn: true },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, phone: true, createdAt: true, lastSeenAt: true },
    });
    const visits = await prisma.bills.groupBy({
      by: ["customerId"],
      where: { restaurantId, customerId: { in: customers.map((c) => c.id) } },
      _count: true,
      _sum: { totalAmount: true },
    });

    const rows = [
      ["phone", "visits", "total_spent", "first_seen", "last_seen"],
      ...customers.map((c) => {
        const v = visits.find((x) => x.customerId === c.id);
        return [`+91${c.phone}`, String(v?._count ?? 0), String(Math.round(v?._sum.totalAmount ?? 0)), istDateKey(c.createdAt), istDateKey(c.lastSeenAt)];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\r\n") + "\r\n";

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="offer-list-${istDateKey(new Date())}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Customer export error:", error);
    return NextResponse.json({ message: "Could not export customers." }, { status: 500 });
  }
}
