import { randomInt } from "node:crypto";
import prisma from "@/lib/prisma";
import { sendWhatsAppOTP } from "@/lib/whatsapp";

/** A waiter logging in with their mobile number. */
export const STAFF_OTP_PURPOSE = "STAFF_LOGIN";
/** A diner verifying their number on the table QR menu. */
export const CUSTOMER_OTP_PURPOSE = "CUSTOMER_LOGIN";

const COOLDOWN_MS = 60 * 1000;
const VALID_MS = 10 * 60 * 1000;

export const cleanPhone = (phone: unknown) => (typeof phone === "string" ? phone.replace(/\D/g, "").slice(-10) : "");

/**
 * Creates a 6-digit code and sends it on WhatsApp. One code per phone per minute.
 * `devOtp` is set when the WhatsApp server isn't configured, so the screen can show the code.
 */
export async function issueOtp(phone: string, purpose: string, tableId?: string) {
  const recent = await prisma.otp_verifications.findFirst({
    where: { phone, createdAt: { gt: new Date(Date.now() - COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent) {
    const wait = Math.ceil((COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
    return { error: `Please wait ${wait}s before asking for another code.`, status: 429 } as const;
  }

  // Older unused codes stop working, so only the newest one counts
  await prisma.otp_verifications.updateMany({ where: { phone, purpose, isUsed: false }, data: { isUsed: true } });

  const otp = randomInt(100000, 1000000).toString();
  await prisma.otp_verifications.create({
    data: { phone, otp, purpose, tableId, expiresAt: new Date(Date.now() + VALID_MS) },
  });

  const sent = await sendWhatsAppOTP(phone, otp);
  // Test mode only: the code is shown on screen, which must never happen on the live site
  const showOnScreen = sent.data?.simulated && process.env.NODE_ENV !== "production";
  return { devOtp: showOnScreen ? otp : undefined } as const;
}

/**
 * Checks a WhatsApp OTP for this phone and marks it used if it matches.
 * Returns an error message for the user, or null when the code is valid.
 */
export async function consumeOtp(phone: string, purpose: string, otp: string): Promise<string | null> {
  const verification = await prisma.otp_verifications.findFirst({
    where: {
      phone,
      purpose,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    return "This code has expired. Please ask for a new code.";
  }

  if (verification.attempts >= 5) {
    return "Too many wrong tries. Please ask for a new code.";
  }

  if (verification.otp !== otp.trim()) {
    await prisma.otp_verifications.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    return "Wrong code. Please check WhatsApp and try again.";
  }

  // Conditional update so the same code can't be used twice at once
  const used = await prisma.otp_verifications.updateMany({
    where: { id: verification.id, isUsed: false },
    data: { isUsed: true },
  });
  if (used.count === 0) return "This code was already used. Please ask for a new code.";

  return null;
}
