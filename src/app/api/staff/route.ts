import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { blockUnlessApproved } from "@/lib/approval";

// GET /api/staff - List all staff for the manager's restaurant
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { restaurantId: true, role: true },
    });

    if (!currentUser || !currentUser.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(currentUser.restaurantId);
    if (notApproved) return notApproved;

    const staff = await prisma.users.findMany({
      where: {
        restaurantId: currentUser.restaurantId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(staff);
  } catch (error: any) {
    console.error("Error fetching staff:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/staff - Add a new staff member (waiter)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { restaurantId: true, role: true },
    });

    if (!currentUser || !currentUser.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(currentUser.restaurantId);
    if (notApproved) return notApproved;

    // Only Admin or Manager can manage staff
    if (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER") {
      return NextResponse.json(
        { message: "Only managers and admins can add staff members." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, phone, role } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { message: "Name and phone number are required." },
        { status: 400 }
      );
    }

    const cleanedPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanedPhone.length !== 10) {
      return NextResponse.json(
        { message: "Please provide a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    // The same waiter may also work at another restaurant; they choose which one after logging in
    const existing = await prisma.users.findFirst({
      where: { phone: cleanedPhone, restaurantId: currentUser.restaurantId },
    });

    if (existing) {
      return NextResponse.json(
        { message: "A staff member with this phone number already exists in your restaurant." },
        { status: 409 }
      );
    }

    const newStaff = await prisma.users.create({
      data: {
        name: name.trim(),
        phone: cleanedPhone,
        role: role === "MANAGER" ? "MANAGER" : "WAITER",
        restaurantId: currentUser.restaurantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Staff member added successfully", staff: newStaff },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating staff:", error);
    return NextResponse.json(
      { message: error.message || "Failed to add staff member" },
      { status: 500 }
    );
  }
}
