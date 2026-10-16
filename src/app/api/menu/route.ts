import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { blockUnlessApproved } from "@/lib/approval";

export async function GET(req: Request) {
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

    const menuItems = await prisma.menu_items.findMany({
      where: { 
        restaurantId: user.restaurantId,
        isActive: true
      },
      include: {
        categories: true
      },
      orderBy: [
        { categories: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json(menuItems);
  } catch (error) {
    console.error("Fetch menu items error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    const { name, description, price, categoryId, imageUrl, isVeg, isSpicy, isAvailable } = body;

    if (!name || !price || !categoryId) {
      return NextResponse.json({ message: "Name, price, and category are required" }, { status: 400 });
    }

    // Verify the category belongs to this restaurant
    const category = await prisma.categories.findFirst({
      where: {
        id: categoryId,
        restaurantId: user.restaurantId
      }
    });

    if (!category) {
      return NextResponse.json({ message: "Invalid category" }, { status: 400 });
    }

    const menuItem = await prisma.menu_items.create({
      data: {
        restaurantId: user.restaurantId,
        categoryId,
        name,
        description: description || "",
        price: parseFloat(price),
        imageUrl: imageUrl || "",
        isVeg: isVeg !== undefined ? isVeg : true,
        isSpicy: isSpicy !== undefined ? isSpicy : false,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
      },
      include: {
        categories: true
      }
    });

    return NextResponse.json(menuItem, { status: 201 });
  } catch (error) {
    console.error("Create menu item error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
