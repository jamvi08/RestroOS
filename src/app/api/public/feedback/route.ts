import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { findTableByQr } from "@/lib/table-access";
import { RATING_WINDOW_MS, sessionFromCookie } from "@/lib/table-session";

// POST /api/public/feedback { slug, token, rating: 1 | 2 | 3, comment? }
// Only the phone whose bill was just paid can rate, and only once.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const table = await findTableByQr(body.slug, body.token);
    if (!table) {
      return NextResponse.json({ message: "This QR code is not valid any more." }, { status: 404 });
    }

    const rating = Number(body.rating);
    if (![1, 2, 3].includes(rating)) {
      return NextResponse.json({ message: "Please choose a rating." }, { status: 400 });
    }

    const session = await sessionFromCookie(table.id);
    if (
      !session ||
      session.endedReason !== "PAID" ||
      !session.endedAt ||
      Date.now() - session.endedAt.getTime() > RATING_WINDOW_MS
    ) {
      return NextResponse.json({ message: "You can rate after your bill is paid." }, { status: 403 });
    }

    const existing = await prisma.feedback.findUnique({ where: { sessionId: session.id }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ message: "Thanks, we already have your rating." }, { status: 409 });
    }

    await prisma.feedback.create({
      data: {
        restaurantId: table.restaurantId,
        sessionId: session.id,
        tableNumber: table.tableNumber,
        rating,
        comment: typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : "",
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json({ message: "Could not save your rating." }, { status: 500 });
  }
}
