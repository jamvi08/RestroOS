import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { blockUnlessApproved } from "@/lib/approval";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id }
    });

    if (!user || !user.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(user.restaurantId);
    if (notApproved) return notApproved;

    const tables = await prisma.tables.findMany({
      where: { 
        restaurantId: user.restaurantId,
        isActive: true
      },
      include: {
        restaurants: {
          select: { slug: true }
        }
      },
      orderBy: { tableNumber: 'asc' }
    });

    return NextResponse.json(tables);
  } catch (error) {
    console.error("Fetch tables error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id }
    });

    if (!user || !user.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(user.restaurantId);
    if (notApproved) return notApproved;

    const body = await req.json();
    const { tableNumber, label, capacity } = body;

    if (!tableNumber) {
      return NextResponse.json({ message: "Table number is required" }, { status: 400 });
    }

    // Check for duplicate tableNumber
    const existingTable = await prisma.tables.findFirst({
      where: {
        restaurantId: user.restaurantId,
        tableNumber: String(tableNumber)
      }
    });

    if (existingTable) {
      return NextResponse.json({ message: "Table number already exists" }, { status: 400 });
    }

    const table = await prisma.tables.create({
      data: {
        restaurantId: user.restaurantId,
        tableNumber: String(tableNumber),
        label: label || "",
        capacity: parseInt(capacity) || 4,
      }
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    console.error("Create table error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
