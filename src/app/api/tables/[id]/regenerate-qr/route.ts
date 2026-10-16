import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { blockUnlessApproved } from "@/lib/approval";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id }
    });

    if (!user || !user.restaurantId) {
      return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
    }

    const notApproved = await blockUnlessApproved(user.restaurantId);
    if (notApproved) return notApproved;

    // Verify ownership
    const existingTable = await prisma.tables.findFirst({
      where: {
        id: id,
        restaurantId: user.restaurantId
      }
    });

    if (!existingTable) {
      return NextResponse.json({ message: "Table not found" }, { status: 404 });
    }

    // Generate a secure, random unique token. crypto.randomUUID() is built-in to Node.js
    const newToken = crypto.randomUUID();

    const updatedTable = await prisma.tables.update({
      where: { id: id },
      data: { qrCodeToken: newToken },
    });

    return NextResponse.json(updatedTable);
  } catch (error) {
    console.error("Regenerate QR error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
