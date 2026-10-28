import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { blockUnlessApproved } from "@/lib/approval";

// PUT /api/staff/[id] - Toggle active status or update details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { restaurantId: true, role: true },
    });

    if (!currentUser || !currentUser.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(currentUser.restaurantId);
    if (notApproved) return notApproved;

    if (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER") {
      return NextResponse.json({ message: "Only managers and owners can change staff." }, { status: 403 });
    }

    // Verify staff belongs to this restaurant
    const targetStaff = await prisma.users.findFirst({
      where: { id, restaurantId: currentUser.restaurantId },
    });

    if (!targetStaff) {
      return NextResponse.json({ message: "Staff member not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, phone, role, isActive } = body;

    let updatedPhone = undefined;
    if (phone) {
      const cleaned = phone.replace(/\D/g, "").slice(-10);
      if (cleaned.length !== 10) {
        return NextResponse.json({ message: "Invalid 10-digit phone number" }, { status: 400 });
      }
      // Check collision within this restaurant (other restaurants may share a waiter)
      const collision = await prisma.users.findFirst({
        where: { phone: cleaned, restaurantId: currentUser.restaurantId, NOT: { id } },
      });
      if (collision) {
        return NextResponse.json({ message: "Phone number already in use" }, { status: 409 });
      }
      updatedPhone = cleaned;
    }

    const updated = await prisma.users.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(updatedPhone && { phone: updatedPhone }),
        ...((role === "WAITER" || role === "MANAGER") && { role }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating staff:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/staff/[id] - Remove staff member
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { restaurantId: true, role: true },
    });

    if (!currentUser || !currentUser.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(currentUser.restaurantId);
    if (notApproved) return notApproved;

    // Verify staff belongs to this restaurant and cannot delete self
    if (id === session.user.id) {
      return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
    }

    const targetStaff = await prisma.users.findFirst({
      where: { id, restaurantId: currentUser.restaurantId },
    });

    if (!targetStaff) {
      return NextResponse.json({ message: "Staff member not found" }, { status: 404 });
    }

    await prisma.users.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Staff member deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting staff:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
