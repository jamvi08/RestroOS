import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { findTableByQr } from "@/lib/table-access";
import { claimTable } from "@/lib/table-session";

const TYPES = ["CALL_WAITER", "WATER", "BILL"] as const;
type RequestType = (typeof TYPES)[number];

// POST /api/public/requests - customer taps "Call waiter", "Water" or "Bring bill".
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const table = await findTableByQr(body.slug, body.token);
    if (!table) {
      return NextResponse.json({ message: "This QR code is not valid any more. Please scan the table QR again." }, { status: 404 });
    }

    if (!TYPES.includes(body.type)) {
      return NextResponse.json({ message: "Unknown request." }, { status: 400 });
    }
    const type = body.type as RequestType;

    // Only the phone that owns this table can call the waiter from the app
    const claim = await claimTable(table);
    if ("error" in claim) {
      return NextResponse.json({ message: claim.error, code: "TABLE_TAKEN" }, { status: 403 });
    }

    // Pressing the same button twice doesn't create a second alert
    const existing = await prisma.service_requests.findFirst({
      where: { tableId: table.id, type, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      select: { id: true, type: true, status: true },
    });
    if (existing) {
      return NextResponse.json(existing);
    }

    const created = await prisma.service_requests.create({
      data: {
        restaurantId: table.restaurantId,
        tableId: table.id,
        tableNumber: table.tableNumber,
        type,
      },
      select: { id: true, type: true, status: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Service request error:", error);
    return NextResponse.json({ message: "Could not reach the waiter. Please wave to the staff." }, { status: 500 });
  }
}
