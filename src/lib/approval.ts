import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * New restaurants stay PENDING until a super admin approves them.
 * API routes call this after loading the user's restaurantId; a non-null
 * result is the response to return instead of doing the work.
 */
export async function blockUnlessApproved(restaurantId: string) {
  const restaurant = await prisma.restaurants.findUnique({
    where: { id: restaurantId },
    select: { status: true },
  });

  if (restaurant?.status === "APPROVED") return null;

  return NextResponse.json(
    {
      message:
        restaurant?.status === "REJECTED"
          ? "This restaurant account was not approved."
          : "Your restaurant is waiting for approval. You can use the dashboard once it is approved.",
    },
    { status: 403 }
  );
}
