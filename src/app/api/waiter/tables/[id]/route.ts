import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff-auth";
import { getTableDetail } from "@/lib/board";
import { priceItems, totalsFor } from "@/lib/orders";
import { activeSession, endTableSession } from "@/lib/table-session";

type Params = { params: Promise<{ id: string }> };

// GET /api/waiter/tables/:id - orders, requests and running bill for one table
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await requireStaff();
    if ("response" in auth) return auth.response;

    const detail = await getTableDetail(auth.staff.restaurantId, id);
    if (!detail) return NextResponse.json({ message: "Table not found." }, { status: 404 });
    const phone = await activeSession(id);
    return NextResponse.json({ ...detail, taxRate: auth.staff.taxRate, phoneConnected: Boolean(phone) });
  } catch (error) {
    console.error("Waiter table error:", error);
    return NextResponse.json({ message: "Could not load this table." }, { status: 500 });
  }
}

// POST /api/waiter/tables/:id
//   { action: "add-items", items: [{ menuItemId, quantity }], note? }  waiter takes an order
//   { action: "pay", method: "CASH" | "UPI" }                          settle the bill, free the table
//   { action: "reset-phone" }                                          let a different customer phone take over
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await requireStaff();
    if ("response" in auth) return auth.response;
    const { restaurantId, taxRate } = auth.staff;

    const table = await prisma.tables.findFirst({
      where: { id, restaurantId },
      select: { id: true, tableNumber: true },
    });
    if (!table) return NextResponse.json({ message: "Table not found." }, { status: 404 });

    const body = await req.json();

    if (body.action === "add-items") {
      const priced = await priceItems(restaurantId, body.items);
      if ("error" in priced) return NextResponse.json({ message: priced.error }, { status: 400 });

      const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
      await prisma.$transaction([
        prisma.orders.create({
          data: {
            restaurantId,
            tableId: table.id,
            tableNumber: table.tableNumber,
            taxRate,
            ...totalsFor(priced.lines, taxRate),
            // Taken by the waiter in person, so it goes straight to the kitchen
            status: "PREPARING",
            customerNotes: note,
            order_items: { create: priced.lines },
          },
        }),
        prisma.tables.update({ where: { id: table.id }, data: { status: "OCCUPIED" } }),
      ]);
      return NextResponse.json({ success: true }, { status: 201 });
    }

    if (body.action === "pay") {
      if (body.method !== "CASH" && body.method !== "UPI") {
        return NextResponse.json({ message: "Choose Cash or UPI." }, { status: 400 });
      }

      const unconfirmed = await prisma.orders.count({
        where: { tableId: table.id, status: "RECEIVED", paymentStatus: "PENDING" },
      });
      if (unconfirmed > 0) {
        return NextResponse.json(
          { message: "This table has a new order you haven't accepted. Accept or reject it first." },
          { status: 409 }
        );
      }

      const now = new Date();
      const [paid] = await prisma.$transaction([
        prisma.orders.updateMany({
          where: { tableId: table.id, paymentStatus: "PENDING", status: { notIn: ["CANCELLED", "RECEIVED"] } },
          data: { paymentStatus: "PAID", paymentMethod: body.method, status: "SERVED" },
        }),
        prisma.service_requests.updateMany({
          where: { tableId: table.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          data: { status: "DONE", resolvedAt: now },
        }),
        prisma.tables.update({ where: { id: table.id }, data: { status: "AVAILABLE" } }),
      ]);
      // The customer's phone loses access to this table; the next customers start fresh
      await endTableSession(table.id, "PAID");

      return NextResponse.json({ success: true, ordersPaid: paid.count });
    }

    if (body.action === "reset-phone") {
      await endTableSession(table.id, "RESET");
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Waiter table action error:", error);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
