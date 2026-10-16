import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff-auth";

// POST /api/waiter/orders/:id  { action: "accept" | "reject" | "served" }
//   accept  - waiter checked a customer's QR order with them; send it to the kitchen
//   reject  - prank or duplicate order
//   served  - food has reached the table
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStaff();
    if ("response" in auth) return auth.response;

    const order = await prisma.orders.findFirst({
      where: { id, restaurantId: auth.staff.restaurantId, paymentStatus: "PENDING" },
      select: { id: true, status: true },
    });
    if (!order) return NextResponse.json({ message: "Order not found." }, { status: 404 });

    const { action } = (await req.json()) as { action?: string };

    if (action === "accept" || action === "reject") {
      // Conditional update so two waiters tapping at once can't both win
      const updated = await prisma.orders.updateMany({
        where: { id, status: "RECEIVED" },
        data: { status: action === "accept" ? "PREPARING" : "CANCELLED" },
      });
      if (updated.count === 0) {
        return NextResponse.json({ message: "Another waiter already handled this order." }, { status: 409 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "served") {
      if (order.status === "RECEIVED" || order.status === "CANCELLED") {
        return NextResponse.json({ message: "Accept the order before marking it served." }, { status: 409 });
      }
      await prisma.orders.update({ where: { id }, data: { status: "SERVED" } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Waiter order action error:", error);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
