import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff-auth";

// POST /api/waiter/requests/:id  { status: "ACKNOWLEDGED" | "DONE" }
//   ACKNOWLEDGED - waiter tapped "Coming"; the customer sees "Waiter is coming"
//   DONE         - handled
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStaff();
    if ("response" in auth) return auth.response;

    const request = await prisma.service_requests.findFirst({
      where: { id, restaurantId: auth.staff.restaurantId },
      select: { id: true, status: true },
    });
    if (!request) return NextResponse.json({ message: "Request not found." }, { status: 404 });

    const { status } = (await req.json()) as { status?: string };
    if (status !== "ACKNOWLEDGED" && status !== "DONE") {
      return NextResponse.json({ message: "Unknown status." }, { status: 400 });
    }
    if (request.status === "DONE") {
      return NextResponse.json({ success: true });
    }

    const now = new Date();
    await prisma.service_requests.update({
      where: { id },
      data: status === "ACKNOWLEDGED" ? { status, acknowledgedAt: now } : { status, resolvedAt: now },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waiter request update error:", error);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
