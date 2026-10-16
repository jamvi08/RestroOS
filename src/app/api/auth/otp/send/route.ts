import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { sendWhatsAppOTP } from "@/lib/whatsapp";
import { STAFF_OTP_PURPOSE } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ message: "Mobile number is required" }, { status: 400 });
    }

    const cleanedPhone = phone.replace(/\D/g, "").slice(-10);

    if (cleanedPhone.length !== 10) {
      return NextResponse.json(
        { message: "Please provide a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    // Server-side verification: Manager must have added this number first!
    const staffUser = await prisma.users.findFirst({
      where: {
        phone: cleanedPhone,
        isActive: true,
      },
      include: {
        restaurants: {
          select: { name: true },
        },
      },
    });

    if (!staffUser) {
      return NextResponse.json(
        {
          message:
            "This mobile number is not registered with any restaurant. Please contact your restaurant manager to add your number to the staff list.",
        },
        { status: 404 }
      );
    }

    // Rate limiting: 60-second cooldown between OTP requests
    const recentOtp = await prisma.otp_verifications.findFirst({
      where: {
        phone: cleanedPhone,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentOtp) {
      const waitSeconds = Math.ceil(
        (60 * 1000 - (Date.now() - new Date(recentOtp.createdAt).getTime())) / 1000
      );
      return NextResponse.json(
        { message: `Please wait ${waitSeconds}s before requesting another OTP.` },
        { status: 429 }
      );
    }

    // Invalidate existing active OTPs for this phone to prevent replay
    await prisma.otp_verifications.updateMany({
      where: {
        phone: cleanedPhone,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    // Generate 6-digit random numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in DB with 10 minutes expiry
    await prisma.otp_verifications.create({
      data: {
        phone: cleanedPhone,
        otp,
        purpose: STAFF_OTP_PURPOSE,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send via WhatsApp
    const sendResult = await sendWhatsAppOTP(cleanedPhone, otp);
    const isSimulated = sendResult?.data?.simulated;

    return NextResponse.json({
      message: isSimulated
        ? `WhatsApp server unreachable. Test OTP is: ${otp}`
        : `OTP sent successfully to WhatsApp for ${staffUser.name} (${staffUser.restaurants?.name || "Restaurant Staff"})`,
      restaurantName: staffUser.restaurants?.name,
      staffName: staffUser.name,
      devOtp: isSimulated ? otp : undefined,
    });
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return NextResponse.json(
      { message: error.message || "Failed to send WhatsApp OTP. Please try again." },
      { status: 500 }
    );
  }
}
