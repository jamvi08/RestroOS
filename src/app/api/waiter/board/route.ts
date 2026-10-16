import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff-auth";
import { getBoard } from "@/lib/board";

// GET /api/waiter/board - every table's state plus things waiting for a waiter.
// Polled every few seconds by the waiter's phone.
export async function GET() {
  try {
    const auth = await requireStaff();
    if ("response" in auth) return auth.response;

    return NextResponse.json(await getBoard(auth.staff.restaurantId));
  } catch (error) {
    console.error("Waiter board error:", error);
    return NextResponse.json({ message: "Could not load tables." }, { status: 500 });
  }
}
