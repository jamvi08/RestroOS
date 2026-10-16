import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { consumeOtp } from "@/lib/otp";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

// POST /api/auth/staff/set-password - "forgot password" backup when the manager
// isn't around. The waiter proves they own the number with a WhatsApp OTP.
export async function POST(req: NextRequest) {
  try {
    const { phone, otp, password } = (await req.json()) as { phone?: string; otp?: string; password?: string };
    const cleanedPhone = (phone || "").replace(/\D/g, "").slice(-10);

    if (cleanedPhone.length !== 10 || !otp) {
      return NextResponse.json({ message: "Mobile number and code are required." }, { status: 400 });
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const staffUser = await prisma.users.findFirst({
      where: { phone: cleanedPhone, isActive: true },
      select: { id: true },
    });

    if (!staffUser) {
      return NextResponse.json(
        { message: "This number is not registered with any restaurant." },
        { status: 404 }
      );
    }

    const otpError = await consumeOtp(cleanedPhone, otp);
    if (otpError) {
      return NextResponse.json({ message: otpError }, { status: 400 });
    }

    await prisma.users.update({
      where: { id: staffUser.id },
      data: { password: await bcrypt.hash(password, 10) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set staff password error:", error);
    return NextResponse.json({ message: "Could not save the password. Please try again." }, { status: 500 });
  }
}
