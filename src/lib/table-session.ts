import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * "First phone only": the first phone that orders or asks for help at a free
 * table owns it until the bill is paid. That phone holds "<sessionId>.<secret>"
 * in an httpOnly cookie; the database only keeps a hash of the secret.
 * Any other phone (including someone at home with a photo of the QR) can read
 * the menu but can't order, call the waiter or see the table's bill.
 */

// A session with no unpaid orders and no activity for this long frees the table
const IDLE_MS = 45 * 60 * 1000;
const COOKIE_MAX_AGE = 12 * 60 * 60; // seconds
const TOUCH_EVERY_MS = 60 * 1000;
// How long after paying the phone can still leave a rating
export const RATING_WINDOW_MS = 6 * 60 * 60 * 1000;

const cookieName = (tableId: string) => `rt_${tableId}`;
const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

function sameHash(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The session this phone's cookie points at for this table (active or ended), if the secret checks out. */
export async function sessionFromCookie(tableId: string) {
  const raw = (await cookies()).get(cookieName(tableId))?.value;
  if (!raw) return null;
  const [id, secret] = raw.split(".");
  if (!id || !secret) return null;

  const session = await prisma.table_sessions.findFirst({ where: { id, tableId } });
  if (!session || !sameHash(session.secretHash, hashSecret(secret))) return null;
  return session;
}

/** The table's current owner session, ending it first if it has gone idle with nothing ordered. */
export async function activeSession(tableId: string) {
  const session = await prisma.table_sessions.findFirst({
    where: { tableId, endedAt: null },
    orderBy: { startedAt: "asc" },
  });
  if (!session) return null;

  if (Date.now() - session.lastSeenAt.getTime() > IDLE_MS) {
    const unpaid = await prisma.orders.count({
      where: { tableId, paymentStatus: "PENDING", status: { not: "CANCELLED" } },
    });
    if (unpaid === 0) {
      await prisma.table_sessions.update({ where: { id: session.id }, data: { endedAt: new Date(), endedReason: "EXPIRED" } });
      return null;
    }
  }
  return session;
}

export type TableAccess = "FREE" | "OWNER" | "TAKEN";

/** Is this phone the table's owner, is the table free to claim, or is another phone using it? */
export async function tableAccess(tableId: string) {
  const [active, mine] = await Promise.all([activeSession(tableId), sessionFromCookie(tableId)]);
  if (!active) return { access: "FREE" as TableAccess, active: null, mine };
  if (mine && mine.id === active.id) {
    if (Date.now() - active.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      await prisma.table_sessions.update({ where: { id: active.id }, data: { lastSeenAt: new Date() } });
    }
    return { access: "OWNER" as TableAccess, active, mine };
  }
  return { access: "TAKEN" as TableAccess, active, mine };
}

export const TAKEN_MESSAGE =
  "This table is already ordering from another phone. Ask that person to add it, or tell the waiter.";

/**
 * For actions that need to own the table (order, call waiter). Claims a free
 * table for this phone, or returns an error message if another phone owns it.
 */
export async function claimTable(table: { id: string; restaurantId: string }) {
  const { access, active } = await tableAccess(table.id);
  if (access === "OWNER") return { sessionId: active!.id };
  if (access === "TAKEN") return { error: TAKEN_MESSAGE };

  const secret = randomBytes(24).toString("base64url");
  const created = await prisma.table_sessions.create({
    data: { restaurantId: table.restaurantId, tableId: table.id, secretHash: hashSecret(secret) },
  });

  // Two phones claiming at the same moment: the earliest session wins
  const winner = await prisma.table_sessions.findFirst({
    where: { tableId: table.id, endedAt: null },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (winner?.id !== created.id) {
    await prisma.table_sessions.update({ where: { id: created.id }, data: { endedAt: new Date(), endedReason: "LOST_RACE" } });
    return { error: TAKEN_MESSAGE };
  }

  (await cookies()).set(cookieName(table.id), `${created.id}.${secret}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return { sessionId: created.id };
}

/** Bill paid, or the waiter frees the table for another phone. */
export async function endTableSession(tableId: string, reason: "PAID" | "RESET") {
  await prisma.table_sessions.updateMany({
    where: { tableId, endedAt: null },
    data: { endedAt: new Date(), endedReason: reason },
  });
}
