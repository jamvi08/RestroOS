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
      where: { id: session.user.id },
      include: { restaurants: true }
    });

    if (!user || !user.restaurants) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(user.restaurantId!);
    if (notApproved) return notApproved;

    // Format to match what the frontend expects
    const profile = {
      ...user.restaurants,
      ownerName: user.name, // Mix in ownerName from user
      logoUrl: user.restaurants.logo, // Map logo to logoUrl
    };

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, ownerName, phone, address, logoUrl } = body;

    const user = await prisma.users.findUnique({ where: { id: session.user.id } });
    if (!user || !user.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(user.restaurantId);
    if (notApproved) return notApproved;

    const updatedRestaurant = await prisma.restaurants.update({
      where: { id: user.restaurantId },
      data: {
        name,
        phone,
        address,
        ...(logoUrl && { logo: logoUrl }),
      },
    });

    if (ownerName) {
      await prisma.users.update({
        where: { id: user.id },
        data: { name: ownerName }
      });
    }

    return NextResponse.json({ ...updatedRestaurant, ownerName, logoUrl: updatedRestaurant.logo });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
