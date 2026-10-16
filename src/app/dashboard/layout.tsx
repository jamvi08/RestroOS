import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PendingApproval } from "@/components/dashboard/PendingApproval";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { name: true, role: true, restaurants: { select: { name: true, status: true } } },
  });

  if (user?.role === "SUPERADMIN") {
    redirect("/admin");
  }

  // Waiters use their own portal, not the owner dashboard
  if (user?.role === "WAITER") {
    redirect("/waiter");
  }

  if (user?.restaurants && user.restaurants.status !== "APPROVED") {
    return (
      <PendingApproval
        ownerName={user.name}
        restaurantName={user.restaurants.name}
        rejected={user.restaurants.status === "REJECTED"}
      />
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
