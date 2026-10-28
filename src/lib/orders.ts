import prisma from "@/lib/prisma";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function totalsFor(items: { price: number; quantity: number }[], taxRate: number) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const tax = round2((subtotal * taxRate) / 100);
  return { subtotal, tax, totalAmount: round2(subtotal + tax) };
}

/** Running bill for a table: every order that isn't cancelled (they're all on it from the moment they're placed). */
export function billFor(orders: { subtotal: number; tax: number; totalAmount: number }[]) {
  return {
    subtotal: round2(orders.reduce((s, o) => s + o.subtotal, 0)),
    tax: round2(orders.reduce((s, o) => s + o.tax, 0)),
    total: round2(orders.reduce((s, o) => s + o.totalAmount, 0)),
  };
}

export const MAX_LINES_PER_ORDER = 30;
export const MAX_QTY_PER_LINE = 50;

export type RequestedItem = { menuItemId: string; quantity: number; note?: string };

const MAX_NOTE_LENGTH = 100;

/**
 * Turns {menuItemId, quantity} pairs from the client into priced order lines.
 * Prices always come from the database, never from the client.
 */
export async function priceItems(restaurantId: string, raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Please add at least one dish." } as const;
  }
  if (raw.length > MAX_LINES_PER_ORDER) {
    return { error: `An order can have at most ${MAX_LINES_PER_ORDER} different dishes.` } as const;
  }

  const wanted = new Map<string, number>();
  const notes = new Map<string, string>();
  for (const entry of raw as RequestedItem[]) {
    const qty = Math.floor(Number(entry?.quantity));
    if (typeof entry?.menuItemId !== "string" || !Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { error: "Some dishes in the order are not valid." } as const;
    }
    wanted.set(entry.menuItemId, Math.min(MAX_QTY_PER_LINE, (wanted.get(entry.menuItemId) ?? 0) + qty));
    const note = typeof entry.note === "string" ? entry.note.trim().slice(0, MAX_NOTE_LENGTH) : "";
    if (note && !notes.has(entry.menuItemId)) notes.set(entry.menuItemId, note);
  }

  const menuItems = await prisma.menu_items.findMany({
    where: { id: { in: [...wanted.keys()] }, restaurantId, isActive: true },
    select: { id: true, name: true, price: true, isVeg: true, isAvailable: true },
  });

  if (menuItems.length !== wanted.size) {
    return { error: "Some dishes are no longer on the menu. Please refresh and try again." } as const;
  }
  const soldOut = menuItems.filter((m) => !m.isAvailable);
  if (soldOut.length > 0) {
    return { error: `Sorry, ${soldOut.map((m) => m.name).join(", ")} just sold out.` } as const;
  }

  const lines = menuItems.map((m) => ({
    menuItemId: m.id,
    name: m.name,
    price: m.price,
    isVeg: m.isVeg,
    quantity: wanted.get(m.id)!,
    specialInstructions: notes.get(m.id) ?? "",
  }));
  return { lines } as const;
}

/** Recomputes an order's totals after an item changed; cancels it if nothing is left. */
export async function recalcOrder(orderId: string) {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { taxRate: true, order_items: { select: { price: true, quantity: true } } },
  });
  if (!order) return;

  if (order.order_items.length === 0) {
    await prisma.orders.update({ where: { id: orderId }, data: { status: "CANCELLED", subtotal: 0, tax: 0, totalAmount: 0 } });
    return;
  }
  await prisma.orders.update({ where: { id: orderId }, data: totalsFor(order.order_items, order.taxRate) });
}

/** Orders that are still on the table: not cancelled and not yet paid. */
export const openOrderWhere = (tableId: string) => ({
  tableId,
  paymentStatus: "PENDING" as const,
  status: { not: "CANCELLED" as const },
});
