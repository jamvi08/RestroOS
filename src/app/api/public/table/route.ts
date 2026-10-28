import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { findTableByQr } from "@/lib/table-access";
import { billFor, openOrderWhere } from "@/lib/orders";
import { RATING_WINDOW_MS, tableAccess } from "@/lib/table-session";
import { maskPhone, rememberedCustomer } from "@/lib/customer";

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

    const { access, active, mine } = await tableAccess(table.id);

    // Has this phone verified a WhatsApp number here? (Only asked when the restaurant turned it on.)
    let customer: { phone: string } | null = null;
    if (access !== "TAKEN" && table.restaurants.customerOtp !== "OFF") {
      const known =
        access === "OWNER" && active?.customerId
          ? await prisma.customers.findUnique({ where: { id: active.customerId }, select: { phone: true } })
          : await rememberedCustomer(table.restaurantId);
      customer = known ? { phone: maskPhone(known.phone) } : null;
    }

    // The bill was paid on this phone's session: offer the one-tap rating
    let paid: { canRate: boolean } | null = null;
    if (access !== "OWNER" && mine?.endedReason === "PAID" && mine.endedAt && Date.now() - mine.endedAt.getTime() < RATING_WINDOW_MS) {
      const rated = await prisma.feedback.count({ where: { sessionId: mine.id } });
      paid = { canRate: rated === 0 };
    }

    if (access !== "OWNER") {
      return NextResponse.json({ access, paid, customer, orders: [], requests: [], bill: null });
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

    const bill = { ...billFor(orders), taxRate: table.restaurants.taxRate };

    return NextResponse.json({
      access,
      paid: null,
      customer,
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
