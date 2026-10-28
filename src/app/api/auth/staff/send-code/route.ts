import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { cleanPhone, issueOtp, STAFF_OTP_PURPOSE } from "@/lib/otp";

// POST /api/auth/staff/send-code { phone } - step 1 of waiter login: a code on WhatsApp.
// Only numbers a manager has added in Staff get a code.
export async function POST(req: NextRequest) {
  try {
    const phone = cleanPhone((await req.json()).phone);
    if (phone.length !== 10) {
      return NextResponse.json({ message: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    const staff = await prisma.users.findFirst({
      where: { phone, isActive: true, restaurantId: { not: null } },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json(
        { message: "This number isn't on any restaurant's staff list. Ask your manager to add it in Staff." },
        { status: 404 }
      );
    }

    const result = await issueOtp(phone, STAFF_OTP_PURPOSE);
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status });

    return NextResponse.json({ success: true, devOtp: result.devOtp });
  } catch (error) {
    console.error("Staff send code error:", error);
    return NextResponse.json({ message: "Could not send the code. Please try again." }, { status: 500 });
  }
}
