import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { findTableByQr } from "@/lib/table-access";
import { claimTable, linkCustomer } from "@/lib/table-session";
import { cleanPhone, consumeOtp, CUSTOMER_OTP_PURPOSE } from "@/lib/otp";
import { maskPhone, rememberCustomer } from "@/lib/customer";

// POST /api/public/otp/verify { slug, token, phone, otp, offers }
// The customer proved the number: this phone now owns the table as that customer,
// the e-bill goes to that number, and next visit they're remembered.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const table = await findTableByQr(body.slug, body.token);
    if (!table) {
      return NextResponse.json({ message: "This QR code is not valid any more. Please scan the table QR again." }, { status: 404 });
    }

    const phone = cleanPhone(body.phone);
    if (phone.length !== 10 || typeof body.otp !== "string" || !body.otp) {
      return NextResponse.json({ message: "Mobile number and code are required." }, { status: 400 });
    }

    const otpError = await consumeOtp(phone, CUSTOMER_OTP_PURPOSE, body.otp);
    if (otpError) return NextResponse.json({ message: otpError }, { status: 400 });

    const claim = await claimTable(table);
    if ("error" in claim) {
      return NextResponse.json({ message: claim.error, code: "TABLE_TAKEN" }, { status: 403 });
    }

    // Offers need a clear yes from the customer; leaving the box empty never turns off an earlier yes
    const offers = body.offers === true;
    const customer = await prisma.customers.upsert({
      where: { restaurantId_phone: { restaurantId: table.restaurantId, phone } },
      create: { restaurantId: table.restaurantId, phone, offersOptIn: offers },
      update: offers ? { offersOptIn: true } : {},
      select: { id: true },
    });

    await linkCustomer(claim.sessionId, customer.id);
    await rememberCustomer(table.restaurantId, customer.id);

    return NextResponse.json({ success: true, phone: maskPhone(phone) });
  } catch (error) {
    console.error("Customer verify error:", error);
    return NextResponse.json({ message: "Could not check the code. Please try again." }, { status: 500 });
  }
}
