import { NextResponse, NextRequest } from "next/server";
import { cleanPhone, consumeOtp, STAFF_OTP_PURPOSE } from "@/lib/otp";
import { makeStaffTicket } from "@/lib/signed-token";
import { staffRestaurants } from "@/lib/staff-auth";

// POST /api/auth/staff/verify { phone, otp } - step 2 of waiter login.
// Returns a short-lived ticket plus the restaurants this number works at;
// the page then signs in to one of them (asking first if there are several).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = cleanPhone(body.phone);
    if (phone.length !== 10 || typeof body.otp !== "string" || !body.otp) {
      return NextResponse.json({ message: "Mobile number and code are required." }, { status: 400 });
    }

    const otpError = await consumeOtp(phone, STAFF_OTP_PURPOSE, body.otp);
    if (otpError) return NextResponse.json({ message: otpError }, { status: 400 });

    const restaurants = await staffRestaurants(phone);
    if (restaurants.length === 0) {
      return NextResponse.json({ message: "Your manager has removed this number from Staff." }, { status: 403 });
    }

    return NextResponse.json({ ticket: makeStaffTicket(phone), restaurants });
  } catch (error) {
    console.error("Staff verify error:", error);
    return NextResponse.json({ message: "Could not check the code. Please try again." }, { status: 500 });
  }
}
