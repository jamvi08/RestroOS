import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const STAFF_ROLES = ["WAITER", "MANAGER", "ADMIN"];
export const MANAGER_ROLES = ["MANAGER", "ADMIN"];

/**
 * For waiter-board API routes: the signed-in user must be active staff of an
 * approved restaurant. Returns the user, or a response to send back instead.
 * Pass MANAGER_ROLES for owner/manager-only routes.
 */
export async function requireStaff(roles: string[] = STAFF_ROLES) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: NextResponse.json({ message: "Please log in again." }, { status: 401 }) } as const;
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      isActive: true,
      restaurantId: true,
      restaurants: { select: { status: true, taxRate: true, name: true } },
    },
  });

  if (!user || !user.isActive || !user.restaurantId || !user.restaurants || !roles.includes(user.role)) {
    return { response: NextResponse.json({ message: "You don't have access to this restaurant." }, { status: 403 }) } as const;
  }
  if (user.restaurants.status !== "APPROVED") {
    return { response: NextResponse.json({ message: "This restaurant is waiting for approval." }, { status: 403 }) } as const;
  }

  return {
    staff: {
      id: user.id,
      restaurantId: user.restaurantId,
      taxRate: user.restaurants.taxRate,
      restaurantName: user.restaurants.name,
    },
  } as const;
}

/** Every restaurant this mobile number can log in to, for the "which restaurant?" step. */
export async function staffRestaurants(phone: string) {
  const rows = await prisma.users.findMany({
    where: { phone, isActive: true, role: { in: STAFF_ROLES as ("WAITER" | "MANAGER" | "ADMIN")[] }, restaurantId: { not: null } },
    select: { id: true, name: true, role: true, restaurants: { select: { name: true } } },
  });
  return rows
    .filter((r) => r.restaurants)
    .map((r) => ({ userId: r.id, staffName: r.name, role: r.role, restaurantName: r.restaurants!.name }))
    .sort((a, b) => a.restaurantName.localeCompare(b.restaurantName));
}
