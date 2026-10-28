import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Small tamper-proof strings signed with NEXTAUTH_SECRET: "<payload>.<signature>".
 * `kind` keeps a token made for one job from being accepted by another.
 */
function signature(kind: string, payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`${kind}:${payload}`).digest("base64url");
}

export function sign(kind: string, payload: string) {
  return `${payload}.${signature(kind, payload)}`;
}

/** The payload if the signature checks out, otherwise null. */
export function verify(kind: string, token: unknown): string | null {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signature(kind, payload));
  return given.length === expected.length && timingSafeEqual(given, expected) ? payload : null;
}

const STAFF_TICKET_MS = 10 * 60 * 1000;

/**
 * Proof that someone just verified this phone on WhatsApp. Lets them pick which
 * restaurant to log in to without asking for another code.
 */
export function makeStaffTicket(phone: string) {
  return sign("staff-ticket", `${phone}.${Date.now() + STAFF_TICKET_MS}`);
}

/** The verified phone, or null if the ticket is fake or expired. */
export function readStaffTicket(ticket: unknown) {
  const payload = verify("staff-ticket", ticket);
  if (!payload) return null;
  const [phone, expires] = payload.split(".");
  return Number(expires) > Date.now() ? phone : null;
}
