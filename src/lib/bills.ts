import prisma from "@/lib/prisma";
import { billFor, openOrderWhere } from "@/lib/orders";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { formatPrice } from "@/lib/utils";
import { TIME_ZONE } from "@/lib/dates";

export class AlreadyPaidError extends Error {}

/**
 * Pays every open order on a table as one numbered bill (#1, #2, … per restaurant)
 * and frees the table. Returns null if there was nothing to pay.
 */
export async function settleTable({
  restaurantId,
  table,
  method,
  staffId,
}: {
  restaurantId: string;
  table: { id: string; tableNumber: string };
  method: "CASH" | "UPI";
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const orders = await tx.orders.findMany({
      where: openOrderWhere(table.id),
      select: { id: true, subtotal: true, tax: true, totalAmount: true },
    });
    if (orders.length === 0) return null;

    // The phone that ordered, if it verified its WhatsApp number: the e-bill goes there
    const session = await tx.table_sessions.findFirst({
      where: { tableId: table.id, endedAt: null },
      orderBy: { startedAt: "asc" },
      select: { customerId: true },
    });

    const { billCounter } = await tx.restaurants.update({
      where: { id: restaurantId },
      data: { billCounter: { increment: 1 } },
      select: { billCounter: true },
    });
    const totals = billFor(orders);
    const bill = await tx.bills.create({
      data: {
        restaurantId,
        billNumber: billCounter,
        tableId: table.id,
        tableNumber: table.tableNumber,
        subtotal: totals.subtotal,
        tax: totals.tax,
        totalAmount: totals.total,
        paymentMethod: method,
        customerId: session?.customerId ?? null,
        staffId,
      },
      select: { id: true, billNumber: true, customerId: true },
    });

    // Conditional update: if another waiter paid this table at the same moment, roll back
    const paid = await tx.orders.updateMany({
      where: { id: { in: orders.map((o) => o.id) }, paymentStatus: "PENDING" },
      data: { paymentStatus: "PAID", paymentMethod: method, status: "SERVED", billId: bill.id },
    });
    if (paid.count !== orders.length) throw new AlreadyPaidError();

    await tx.service_requests.updateMany({
      where: { tableId: table.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      data: { status: "DONE", resolvedAt: new Date() },
    });
    await tx.tables.update({ where: { id: table.id }, data: { status: "AVAILABLE" } });

    return { ...bill, ordersPaid: paid.count };
  });
}

/** One line per dish across all the table's orders: "2 × Paneer Tikka". */
export function billLines(orders: { order_items: { name: string; price: number; quantity: number }[] }[]) {
  const lines = new Map<string, { name: string; price: number; quantity: number }>();
  for (const item of orders.flatMap((o) => o.order_items)) {
    const key = `${item.name}|${item.price}`;
    const line = lines.get(key);
    if (line) line.quantity += item.quantity;
    else lines.set(key, { name: item.name, price: item.price, quantity: item.quantity });
  }
  return [...lines.values()];
}

/** Sends the paid bill to the customer's WhatsApp. Safe to call for bills without a customer. */
export async function sendBillOnWhatsApp(billId: string) {
  const bill = await prisma.bills.findUnique({
    where: { id: billId },
    select: {
      billNumber: true,
      tableNumber: true,
      subtotal: true,
      tax: true,
      totalAmount: true,
      paymentMethod: true,
      createdAt: true,
      whatsappSentAt: true,
      customers: { select: { phone: true } },
      restaurants: { select: { name: true, currency: true, taxRate: true } },
      orders: { select: { taxRate: true, order_items: { select: { name: true, price: true, quantity: true } } } },
    },
  });
  if (!bill?.customers || bill.whatsappSentAt) return;

  const price = (n: number) => formatPrice(n, bill.restaurants.currency);
  const when = bill.createdAt.toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const taxRate = bill.orders[0]?.taxRate ?? bill.restaurants.taxRate;

  const text = [
    `*${bill.restaurants.name}*`,
    `Bill #${bill.billNumber} · Table ${bill.tableNumber}`,
    when,
    "",
    ...billLines(bill.orders).map((l) => `${l.quantity} × ${l.name} — ${price(l.price * l.quantity)}`),
    "",
    `Items: ${price(bill.subtotal)}`,
    ...(bill.tax > 0 ? [`Tax (${taxRate}%): ${price(bill.tax)}`] : []),
    `*Total: ${price(bill.totalAmount)}* (paid by ${bill.paymentMethod === "UPI" ? "UPI" : "cash"})`,
    "",
    "Thank you for eating with us! 🙏",
  ].join("\n");

  try {
    const sent = await sendWhatsAppText(bill.customers.phone, text);
    if (!sent.data?.simulated) {
      await prisma.bills.update({ where: { id: billId }, data: { whatsappSentAt: new Date() } });
    }
  } catch (error) {
    // The bill is paid either way; the owner can see on the Bills page that it wasn't sent
    console.error(`Could not send bill ${billId} on WhatsApp:`, error);
  }
}
