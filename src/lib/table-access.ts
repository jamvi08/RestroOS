import prisma from "@/lib/prisma";

/**
 * Looks up a table from the customer's QR link (restaurant slug + secret token).
 * The token is the customer's only credential, so every public table API goes through here.
 */
export async function findTableByQr(slug: unknown, token: unknown) {
  if (typeof slug !== "string" || typeof token !== "string" || !slug || !token) return null;

  return prisma.tables.findFirst({
    where: {
      qrCodeToken: token,
      isActive: true,
      restaurants: { slug, isActive: true, status: "APPROVED" },
    },
    select: {
      id: true,
      tableNumber: true,
      restaurantId: true,
      restaurants: { select: { taxRate: true } },
    },
  });
}
