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
    const existingItem = await prisma.menu_items.findFirst({
      where: {
        id: id,
        restaurantId: user.restaurantId
      }
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Menu item not found" }, { status: 404 });
    }

    const body = await req.json();
    
    // Support partial updates (like toggling availability)
    const dataToUpdate: any = {};
    if (body.name !== undefined) dataToUpdate.name = body.name;
    if (body.description !== undefined) dataToUpdate.description = body.description;
    if (body.price !== undefined) dataToUpdate.price = parseFloat(body.price);
    if (body.categoryId !== undefined) dataToUpdate.categoryId = body.categoryId;
    if (body.imageUrl !== undefined) dataToUpdate.imageUrl = body.imageUrl;
    if (body.isVeg !== undefined) dataToUpdate.isVeg = body.isVeg;
    if (body.isSpicy !== undefined) dataToUpdate.isSpicy = body.isSpicy;
    if (body.isAvailable !== undefined) dataToUpdate.isAvailable = body.isAvailable;
    if (body.isActive !== undefined) dataToUpdate.isActive = body.isActive;

    // Verify category if changed
    if (dataToUpdate.categoryId && dataToUpdate.categoryId !== existingItem.categoryId) {
      const category = await prisma.categories.findFirst({
        where: { id: dataToUpdate.categoryId, restaurantId: user.restaurantId }
      });
      if (!category) {
        return NextResponse.json({ message: "Invalid category" }, { status: 400 });
      }
    }

    const updatedItem = await prisma.menu_items.update({
      where: { id: id },
      data: dataToUpdate,
      include: { categories: true }
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Update menu item error:", error);
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
    const existingItem = await prisma.menu_items.findFirst({
      where: {
        id: id,
        restaurantId: user.restaurantId
      }
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Menu item not found" }, { status: 404 });
    }

    // Soft delete or hard delete based on preference. Let's do soft delete for safety in production apps.
    await prisma.menu_items.update({
      where: { id: id },
      data: { isActive: false }
    });

    return NextResponse.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete menu item error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
