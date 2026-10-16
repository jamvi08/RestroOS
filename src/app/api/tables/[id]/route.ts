import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { blockUnlessApproved } from "@/lib/approval";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    // Verify ownership
    const existingTable = await prisma.tables.findFirst({
      where: {
        id: id,
        restaurantId: user.restaurantId
      }
    });

    if (!existingTable) {
      return NextResponse.json({ message: "Table not found" }, { status: 404 });
    }

    const body = await req.json();
    
    const dataToUpdate: any = {};
    if (body.tableNumber !== undefined) {
      // Check for duplicate if changing table number
      if (body.tableNumber !== existingTable.tableNumber) {
        const duplicate = await prisma.tables.findFirst({
          where: { restaurantId: user.restaurantId, tableNumber: String(body.tableNumber) }
        });
        if (duplicate) {
          return NextResponse.json({ message: "Table number already exists" }, { status: 400 });
        }
      }
      dataToUpdate.tableNumber = String(body.tableNumber);
    }
    
    if (body.label !== undefined) dataToUpdate.label = body.label;
    if (body.capacity !== undefined) dataToUpdate.capacity = parseInt(body.capacity);
    if (body.isActive !== undefined) dataToUpdate.isActive = body.isActive;

    const updatedTable = await prisma.tables.update({
      where: { id: id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedTable);
  } catch (error) {
    console.error("Update table error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    // Verify ownership
    const existingTable = await prisma.tables.findFirst({
      where: {
        id: id,
        restaurantId: user.restaurantId
      }
    });

    if (!existingTable) {
      return NextResponse.json({ message: "Table not found" }, { status: 404 });
    }

    await prisma.tables.update({
      where: { id: id },
      data: { isActive: false }
    });

    return NextResponse.json({ message: "Table deleted successfully" });
  } catch (error) {
    console.error("Delete table error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
