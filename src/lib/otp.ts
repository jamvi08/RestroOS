import prisma from "@/lib/prisma";

export const STAFF_OTP_PURPOSE = "STAFF_PASSWORD";

/**
 * Checks a WhatsApp OTP for this phone and marks it used if it matches.
 * Returns an error message for the user, or null when the code is valid.
 */
export async function consumeOtp(phone: string, otp: string): Promise<string | null> {
  const verification = await prisma.otp_verifications.findFirst({
    where: {
      phone,
      purpose: STAFF_OTP_PURPOSE,
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

  await prisma.otp_verifications.update({
    where: { id: verification.id },
    data: { isUsed: true },
  });

  return null;
}
