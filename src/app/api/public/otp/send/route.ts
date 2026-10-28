import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { findTableByQr } from "@/lib/table-access";
import { tableAccess, TAKEN_MESSAGE } from "@/lib/table-session";
import { cleanPhone, CUSTOMER_OTP_PURPOSE, issueOtp } from "@/lib/otp";

// Each code is a WhatsApp message from the shared number, so cap how many one table can ask for
const MAX_CODES_PER_TABLE = 6;
const TABLE_WINDOW_MS = 15 * 60 * 1000;

// POST /api/public/otp/send { slug, token, phone } - customer asks for a WhatsApp code on the QR menu.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const table = await findTableByQr(body.slug, body.token);
    if (!table) {
      return NextResponse.json({ message: "This QR code is not valid any more. Please scan the table QR again." }, { status: 404 });
    }
    if (table.restaurants.customerOtp === "OFF") {
      return NextResponse.json({ message: "This restaurant doesn't ask for a number." }, { status: 400 });
    }

    const phone = cleanPhone(body.phone);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ message: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    const { access } = await tableAccess(table.id);
    if (access === "TAKEN") {
      return NextResponse.json({ message: TAKEN_MESSAGE, code: "TABLE_TAKEN" }, { status: 403 });
    }

    const recent = await prisma.otp_verifications.count({
      where: { tableId: table.id, createdAt: { gt: new Date(Date.now() - TABLE_WINDOW_MS) } },
    });
    if (recent >= MAX_CODES_PER_TABLE) {
      return NextResponse.json({ message: "Too many codes asked from this table. Please call the waiter." }, { status: 429 });
    }

    const result = await issueOtp(phone, CUSTOMER_OTP_PURPOSE, table.id);
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status });

    return NextResponse.json({ success: true, devOtp: result.devOtp });
  } catch (error) {
    console.error("Customer send code error:", error);
    return NextResponse.json({ message: "Could not send the code. Please try again." }, { status: 500 });
  }
}
