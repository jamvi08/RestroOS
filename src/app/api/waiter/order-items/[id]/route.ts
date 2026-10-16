import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff-auth";
import { recalcOrder } from "@/lib/orders";

// PATCH /api/waiter/order-items/:id  { quantity }  - fix a wrong item; 0 removes it.
// Only allowed while the bill is unpaid.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStaff();
    if ("response" in auth) return auth.response;

    const item = await prisma.order_items.findFirst({
      where: {
        id,
        orders: { restaurantId: auth.staff.restaurantId, paymentStatus: "PENDING", status: { not: "CANCELLED" } },
      },
      select: { id: true, orderId: true },
    });
    if (!item) return NextResponse.json({ message: "Item not found or already billed." }, { status: 404 });

    const quantity = Math.floor(Number((await req.json()).quantity));
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 50) {
      return NextResponse.json({ message: "Quantity must be between 0 and 50." }, { status: 400 });
    }

    if (quantity === 0) {
      await prisma.order_items.delete({ where: { id } });
    } else {
      await prisma.order_items.update({ where: { id }, data: { quantity } });
    }
    await recalcOrder(item.orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waiter item update error:", error);
    return NextResponse.json({ message: "Could not change the item. Please try again." }, { status: 500 });
  }
}
