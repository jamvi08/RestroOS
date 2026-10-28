import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { MANAGER_ROLES, requireStaff } from "@/lib/staff-auth";
import { getLiveOrders } from "@/lib/board";
import { istDayStart } from "@/lib/dates";

// GET /api/dashboard/live - every table that's eating right now, with its orders,
// plus today's takings. Polled by the manager's Live orders page.
export async function GET() {
  try {
    const auth = await requireStaff(MANAGER_ROLES);
    if ("response" in auth) return auth.response;
    const { restaurantId } = auth.staff;

    const [tables, paidToday] = await Promise.all([
      getLiveOrders(restaurantId),
      prisma.bills.aggregate({
        where: { restaurantId, createdAt: { gte: istDayStart() } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      tables,
      paidToday: { total: paidToday._sum.totalAmount ?? 0, bills: paidToday._count },
    });
  } catch (error) {
    console.error("Live orders error:", error);
    return NextResponse.json({ message: "Could not load orders." }, { status: 500 });
  }
}
