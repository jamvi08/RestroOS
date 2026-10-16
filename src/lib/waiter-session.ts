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
      restaurants: { select: { name: true, currency: true, status: true } },
    },
  });

  if (user?.role === "SUPERADMIN") redirect("/admin");
  if (!user || !user.isActive || !user.restaurants) redirect("/waiter/login");
  if (user.restaurants.status !== "APPROVED") redirect("/dashboard");

  return { restaurantName: user.restaurants.name, currency: user.restaurants.currency };
}
