import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeStaffTicket } from "@/lib/signed-token";
import { staffRestaurants } from "@/lib/staff-auth";

// GET /api/auth/staff/restaurants - "Switch restaurant" for a logged-in waiter who
// works at more than one place. They proved the number at login, so no new code.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: "Please log in again." }, { status: 401 });

    const me = await prisma.users.findUnique({ where: { id: session.user.id }, select: { phone: true, isActive: true } });
    if (!me?.phone || !me.isActive) return NextResponse.json({ message: "Please log in again." }, { status: 401 });

    return NextResponse.json({
      ticket: makeStaffTicket(me.phone),
      restaurants: await staffRestaurants(me.phone),
      currentUserId: session.user.id,
    });
  } catch (error) {
    console.error("Staff restaurants error:", error);
    return NextResponse.json({ message: "Could not load your restaurants." }, { status: 500 });
  }
}
