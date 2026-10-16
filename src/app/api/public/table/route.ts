import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { findTableByQr } from "@/lib/table-access";
import { openOrderWhere, round2 } from "@/lib/orders";
import { RATING_WINDOW_MS, tableAccess } from "@/lib/table-session";

// GET /api/public/table?slug=&token=
// For the phone that owns the table: what's been ordered, the running bill and
// whether the waiter is on the way. Other phones only learn whether the table
// is free or taken — never another customer's order.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const table = await findTableByQr(params.get("slug"), params.get("token"));
    if (!table) {
      return NextResponse.json({ message: "This QR code is not valid any more." }, { status: 404 });
    }

    const { access, mine } = await tableAccess(table.id);

    // The bill was paid on this phone's session: offer the one-tap rating
    let paid: { canRate: boolean } | null = null;
    if (access !== "OWNER" && mine?.endedReason === "PAID" && mine.endedAt && Date.now() - mine.endedAt.getTime() < RATING_WINDOW_MS) {
      const rated = await prisma.feedback.count({ where: { sessionId: mine.id } });
      paid = { canRate: rated === 0 };
    }

    if (access !== "OWNER") {
      return NextResponse.json({ access, paid, orders: [], requests: [], bill: null });
    }

    const [orders, requests] = await Promise.all([
      prisma.orders.findMany({
        where: openOrderWhere(table.id),
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          subtotal: true,
          tax: true,
          createdAt: true,
          order_items: { select: { id: true, name: true, quantity: true, price: true, isVeg: true, specialInstructions: true } },
        },
      }),
      prisma.service_requests.findMany({
        where: { tableId: table.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        select: { id: true, type: true, status: true },
      }),
    ]);

    // The bill only includes orders a waiter has accepted
    const accepted = orders.filter((o) => o.status !== "RECEIVED");
    const bill = {
      subtotal: round2(accepted.reduce((s, o) => s + o.subtotal, 0)),
      tax: round2(accepted.reduce((s, o) => s + o.tax, 0)),
      total: round2(accepted.reduce((s, o) => s + o.totalAmount, 0)),
      taxRate: table.restaurants.taxRate,
    };

    return NextResponse.json({
      access,
      paid: null,
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: o.totalAmount,
        createdAt: o.createdAt,
        items: o.order_items,
      })),
      requests,
      bill,
    });
  } catch (error) {
    console.error("Table status error:", error);
    return NextResponse.json({ message: "Could not load your order." }, { status: 500 });
  }
}
