import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const allowed = ["APPROVED", "REJECTED", "PENDING"] as const;
type Status = (typeof allowed)[number];

// PATCH /api/admin/restaurants/:id - super admin approves or rejects a restaurant
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Re-check the role from the database rather than trusting the token
    const admin = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { role: true, isActive: true },
    });
    if (admin?.role !== "SUPERADMIN" || !admin.isActive) {
      return NextResponse.json({ message: "Only the super admin can do this" }, { status: 403 });
    }

    const { status } = (await req.json()) as { status?: string };
    if (!status || !allowed.includes(status as Status)) {
      return NextResponse.json({ message: "Status must be APPROVED, REJECTED or PENDING" }, { status: 400 });
    }

    const restaurant = await prisma.restaurants.update({
      where: { id },
      data: { status: status as Status },
      select: { id: true, name: true, status: true },
    });

    return NextResponse.json(restaurant);
  } catch (error) {
    console.error("Update restaurant status error:", error);
    return NextResponse.json({ message: "Could not update the restaurant" }, { status: 500 });
  }
}
