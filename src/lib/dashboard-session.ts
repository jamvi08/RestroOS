import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * For owner/manager dashboard pages. The dashboard layout already sends waiters,
 * super admins and unapproved restaurants elsewhere; this returns the restaurant.
 */
export async function requireManagerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { role: true, restaurants: { select: { id: true, name: true, currency: true, status: true } } },
  });
  if (!user?.restaurants || user.restaurants.status !== "APPROVED") redirect("/dashboard");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/waiter");

  return { restaurantId: user.restaurants.id, restaurantName: user.restaurants.name, currency: user.restaurants.currency };
}
