import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { sign, verify } from "@/lib/signed-token";

/**
 * A diner who verified their WhatsApp number at this restaurant is remembered on
 * that phone, so next visit they don't need another code. The cookie holds the
 * customer id signed with NEXTAUTH_SECRET, scoped to one restaurant.
 */
const MAX_AGE = 180 * 24 * 60 * 60; // seconds
const cookieName = (restaurantId: string) => `rc_${restaurantId}`;
const kind = (restaurantId: string) => `customer:${restaurantId}`;

export async function rememberedCustomer(restaurantId: string) {
  const customerId = verify(kind(restaurantId), (await cookies()).get(cookieName(restaurantId))?.value);
  if (!customerId) return null;
  return prisma.customers.findFirst({ where: { id: customerId, restaurantId }, select: { id: true, phone: true } });
}

export async function rememberCustomer(restaurantId: string, customerId: string) {
  (await cookies()).set(cookieName(restaurantId), sign(kind(restaurantId), customerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** "••••3210": enough for the customer to recognise their number. */
export const maskPhone = (phone: string) => `••••${phone.slice(-4)}`;
