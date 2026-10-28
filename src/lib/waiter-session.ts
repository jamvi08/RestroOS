import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** For /waiter pages: signed-in, active staff of an approved restaurant, or bounce to login. */
export async function requireWaiterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/waiter/login");

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isActive: true,
      phone: true,
      restaurants: { select: { name: true, currency: true, status: true } },
    },
  });

  if (user?.role === "SUPERADMIN") redirect("/admin");
  if (!user || !user.isActive || !user.restaurants) redirect("/waiter/login");
  if (user.restaurants.status !== "APPROVED") redirect("/dashboard");

  // Same number on another restaurant's staff list: offer "Switch restaurant"
  const elsewhere = user.phone
    ? await prisma.users.count({ where: { phone: user.phone, isActive: true, id: { not: session.user.id }, restaurantId: { not: null } } })
    : 0;

  return {
    currency: user.restaurants.currency,
    header: {
      restaurantName: user.restaurants.name,
      canSwitch: elsewhere > 0,
      isManager: user.role === "MANAGER" || user.role === "ADMIN",
    },
  };
}
