import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { findTableByQr } from "@/lib/table-access";
import { priceItems, totalsFor } from "@/lib/orders";
import { claimTable } from "@/lib/table-session";

// POST /api/public/orders - a customer places an order from the table QR menu.
// No waiter confirmation: it goes straight to the kitchen and onto the bill.
// The waiter's board shows it as "New order" until someone taps "Got it".
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const table = await findTableByQr(body.slug, body.token);
    if (!table) {
      return NextResponse.json({ message: "This QR code is not valid any more. Please scan the table QR again." }, { status: 404 });
    }

    const priced = await priceItems(table.restaurantId, body.items);
    if ("error" in priced) {
      return NextResponse.json({ message: priced.error }, { status: 400 });
    }

    // Only the phone that owns this table can order for it
    const claim = await claimTable(table);
    if ("error" in claim) {
      return NextResponse.json({ message: claim.error, code: "TABLE_TAKEN" }, { status: 403 });
    }

    // Restaurant asks every table to verify a WhatsApp number before ordering
    if (table.restaurants.customerOtp === "REQUIRED" && !claim.customerId) {
      return NextResponse.json(
        { message: "Please verify your WhatsApp number to place the order.", code: "VERIFY_PHONE" },
        { status: 403 }
      );
    }

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
    const taxRate = table.restaurants.taxRate;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.orders.create({
        data: {
          restaurantId: table.restaurantId,
          tableId: table.id,
          tableNumber: table.tableNumber,
          taxRate,
          ...totalsFor(priced.lines, taxRate),
          status: "PREPARING",
          customerNotes: note,
          diningSessionToken: claim.sessionId,
          order_items: { create: priced.lines },
        },
        select: { id: true },
      });
      await tx.tables.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });
      return created;
    });

    return NextResponse.json({ orderId: order.id }, { status: 201 });
  } catch (error) {
    console.error("Customer order error:", error);
    return NextResponse.json({ message: "Could not send your order. Please try again or call the waiter." }, { status: 500 });
  }
}
