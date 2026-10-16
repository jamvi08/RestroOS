import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AdminRestaurants } from "@/components/admin/AdminRestaurants";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const admin = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true },
  });
  if (admin?.role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  const restaurants = await prisma.restaurants.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      status: true,
      createdAt: true,
      users: {
        where: { role: "ADMIN" },
        select: { name: true, email: true },
        take: 1,
      },
    },
  });

  return (
    <AdminRestaurants
      adminName={admin.name}
      restaurants={restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        phone: r.phone,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        ownerName: r.users[0]?.name ?? null,
        ownerEmail: r.users[0]?.email ?? null,
      }))}
    />
  );
}
