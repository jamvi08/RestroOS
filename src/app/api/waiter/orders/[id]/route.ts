import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff-auth";

// POST /api/waiter/orders/:id  { action: "seen" | "cancel" | "served" }
//   seen    - waiter tapped "Got it" on a new QR order (clears the alert; the order is already in the kitchen)
//   cancel  - prank, duplicate or wrong order; comes off the bill
//   served  - food has reached the table
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStaff();
    if ("response" in auth) return auth.response;

    const order = await prisma.orders.findFirst({
      where: { id, restaurantId: auth.staff.restaurantId, paymentStatus: "PENDING" },
      select: { id: true, status: true, seenAt: true },
    });
    if (!order) return NextResponse.json({ message: "Order not found." }, { status: 404 });

    const { action } = (await req.json()) as { action?: string };

    if (action === "seen") {
      // Two waiters tapping at once is fine: the first time wins, the second is a no-op
      await prisma.orders.updateMany({ where: { id, seenAt: null }, data: { seenAt: new Date() } });
      return NextResponse.json({ success: true });
    }

    if (action === "cancel") {
      if (order.status === "CANCELLED") return NextResponse.json({ success: true });
      await prisma.orders.update({ where: { id }, data: { status: "CANCELLED", seenAt: order.seenAt ?? new Date() } });
      return NextResponse.json({ success: true });
    }

    if (action === "served") {
      if (order.status === "CANCELLED") {
        return NextResponse.json({ message: "This order was cancelled." }, { status: 409 });
      }
      await prisma.orders.update({ where: { id }, data: { status: "SERVED", seenAt: order.seenAt ?? new Date() } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Waiter order action error:", error);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
