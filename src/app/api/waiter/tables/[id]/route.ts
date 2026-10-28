import { NextResponse, NextRequest, after } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff-auth";
import { getTableDetail } from "@/lib/board";
import { priceItems, totalsFor } from "@/lib/orders";
import { activeSession, endTableSession } from "@/lib/table-session";
import { AlreadyPaidError, sendBillOnWhatsApp, settleTable } from "@/lib/bills";
import { maskPhone } from "@/lib/customer";

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
    const customer = phone?.customerId
      ? await prisma.customers.findUnique({ where: { id: phone.customerId }, select: { phone: true } })
      : null;
    return NextResponse.json({
      ...detail,
      taxRate: auth.staff.taxRate,
      phoneConnected: Boolean(phone),
      // Verified WhatsApp number: the e-bill goes here when the table pays
      customerPhone: customer ? maskPhone(customer.phone) : null,
    });
  } catch (error) {
    console.error("Waiter table error:", error);
    return NextResponse.json({ message: "Could not load this table." }, { status: 500 });
  }
}

// POST /api/waiter/tables/:id
//   { action: "add-items", items: [{ menuItemId, quantity }], note? }  waiter takes an order
//   { action: "pay", method: "CASH" | "UPI" }                          settle the bill, free the table, WhatsApp the e-bill
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
            // Taken by the waiter in person: already seen, no "New order" alert
            status: "PREPARING",
            seenAt: new Date(),
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

      let bill;
      try {
        bill = await settleTable({ restaurantId, table, method: body.method, staffId: auth.staff.id });
      } catch (err) {
        if (err instanceof AlreadyPaidError) {
          return NextResponse.json({ message: "Another waiter just took payment for this table." }, { status: 409 });
        }
        throw err;
      }
      if (!bill) {
        return NextResponse.json({ message: "Nothing to pay on this table." }, { status: 409 });
      }
      // The customer's phone loses access to this table; the next customers start fresh
      await endTableSession(table.id, "PAID");
      // Don't make the waiter wait for WhatsApp
      if (bill.customerId) after(() => sendBillOnWhatsApp(bill.id));

      return NextResponse.json({ success: true, billNumber: bill.billNumber, ordersPaid: bill.ordersPaid, eBill: Boolean(bill.customerId) });
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
