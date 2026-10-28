import prisma from "@/lib/prisma";
import { billFor, openOrderWhere, round2 } from "@/lib/orders";

/** What a table needs from the waiter right now, most urgent first. */
export type TableState = "HELP" | "NEW_ORDER" | "BILL" | "EATING" | "FREE";

export type BoardAlert = {
  key: string;
  kind: "REQUEST" | "ORDER";
  id: string;
  tableId: string;
  tableNumber: string;
  type: "CALL_WAITER" | "WATER" | "BILL" | "NEW_ORDER";
  /** OPEN = nobody has responded yet; ACKNOWLEDGED = a waiter said "Coming" */
  status: "OPEN" | "ACKNOWLEDGED";
  createdAt: string;
  itemCount?: number;
  /** New QR orders: what to tell the kitchen, without opening the table */
  items?: { name: string; quantity: number; note: string | null }[];
};

export type BoardTable = {
  id: string;
  tableNumber: string;
  label: string | null;
  capacity: number;
  state: TableState;
  runningTotal: number;
  itemCount: number;
  since: string | null;
};

export async function getBoard(restaurantId: string) {
  const [tables, orders, requests] = await Promise.all([
    prisma.tables.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, tableNumber: true, label: true, capacity: true },
    }),
    prisma.orders.findMany({
      where: { restaurantId, paymentStatus: "PENDING", status: { not: "CANCELLED" }, tableId: { not: null } },
      select: {
        id: true,
        tableId: true,
        tableNumber: true,
        status: true,
        totalAmount: true,
        seenAt: true,
        createdAt: true,
        order_items: { select: { name: true, quantity: true, specialInstructions: true } },
      },
    }),
    prisma.service_requests.findMany({
      where: { restaurantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      select: { id: true, tableId: true, tableNumber: true, type: true, status: true, createdAt: true },
    }),
  ]);

  const alerts: BoardAlert[] = [
    ...requests.map((r) => ({
      key: `req:${r.id}`,
      kind: "REQUEST" as const,
      id: r.id,
      tableId: r.tableId,
      tableNumber: r.tableNumber,
      type: r.type,
      status: r.status as "OPEN" | "ACKNOWLEDGED",
      createdAt: r.createdAt.toISOString(),
    })),
    // Customer QR orders go straight to the kitchen; this just makes sure a waiter has seen them
    ...orders
      .filter((o) => !o.seenAt)
      .map((o) => ({
        key: `order:${o.id}`,
        kind: "ORDER" as const,
        id: o.id,
        tableId: o.tableId!,
        tableNumber: o.tableNumber,
        type: "NEW_ORDER" as const,
        status: "OPEN" as const,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.order_items.reduce((s, i) => s + i.quantity, 0),
        items: o.order_items.map((i) => ({ name: i.name, quantity: i.quantity, note: i.specialInstructions || null })),
      })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const boardTables: BoardTable[] = tables
    .map((t) => {
      const tOrders = orders.filter((o) => o.tableId === t.id);
      const tRequests = requests.filter((r) => r.tableId === t.id);

      let state: TableState = "FREE";
      if (tRequests.some((r) => r.type !== "BILL")) state = "HELP";
      else if (tOrders.some((o) => !o.seenAt)) state = "NEW_ORDER";
      else if (tRequests.some((r) => r.type === "BILL")) state = "BILL";
      else if (tOrders.length > 0) state = "EATING";

      const firstSeen = [...tOrders.map((o) => o.createdAt), ...tRequests.map((r) => r.createdAt)].sort(
        (a, b) => a.getTime() - b.getTime()
      )[0];

      return {
        id: t.id,
        tableNumber: t.tableNumber,
        label: t.label,
        capacity: t.capacity,
        state,
        runningTotal: round2(tOrders.reduce((s, o) => s + o.totalAmount, 0)),
        itemCount: tOrders.reduce((s, o) => s + o.order_items.reduce((n, i) => n + i.quantity, 0), 0),
        since: firstSeen ? firstSeen.toISOString() : null,
      };
    })
    // Natural sort so Table 2 comes before Table 10
    .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));

  return { tables: boardTables, alerts };
}

export async function getTableDetail(restaurantId: string, tableId: string) {
  const table = await prisma.tables.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, tableNumber: true, label: true, capacity: true },
  });
  if (!table) return null;

  const [orders, requests] = await Promise.all([
    prisma.orders.findMany({
      where: openOrderWhere(table.id),
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        subtotal: true,
        tax: true,
        totalAmount: true,
        customerNotes: true,
        seenAt: true,
        createdAt: true,
        order_items: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, quantity: true, price: true, isVeg: true, specialInstructions: true },
        },
      },
    }),
    prisma.service_requests.findMany({
      where: { tableId: table.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, status: true, createdAt: true },
    }),
  ]);

  return { table, orders, requests, bill: billFor(orders) };
}

export type LiveTable = {
  tableId: string;
  tableNumber: string;
  since: string;
  total: number;
  requests: { id: string; type: "CALL_WAITER" | "WATER" | "BILL"; status: "OPEN" | "ACKNOWLEDGED"; createdAt: string }[];
  orders: {
    id: string;
    status: string;
    isNew: boolean;
    total: number;
    createdAt: string;
    notes: string | null;
    items: { name: string; quantity: number; isVeg: boolean; note: string | null }[];
  }[];
};

/** Every table with something going on, with every unpaid order and what's in it. For the manager's Live orders page. */
export async function getLiveOrders(restaurantId: string) {
  const [orders, requests] = await Promise.all([
    prisma.orders.findMany({
      where: { restaurantId, paymentStatus: "PENDING", status: { not: "CANCELLED" }, tableId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        tableId: true,
        tableNumber: true,
        status: true,
        totalAmount: true,
        seenAt: true,
        customerNotes: true,
        createdAt: true,
        order_items: { orderBy: { name: "asc" }, select: { name: true, quantity: true, isVeg: true, specialInstructions: true } },
      },
    }),
    prisma.service_requests.findMany({
      where: { restaurantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, tableId: true, tableNumber: true, type: true, status: true, createdAt: true },
    }),
  ]);

  const tables = new Map<string, LiveTable>();
  const tableFor = (tableId: string, tableNumber: string, at: Date) => {
    let t = tables.get(tableId);
    if (!t) {
      t = { tableId, tableNumber, since: at.toISOString(), total: 0, requests: [], orders: [] };
      tables.set(tableId, t);
    }
    if (at.toISOString() < t.since) t.since = at.toISOString();
    return t;
  };

  for (const o of orders) {
    const t = tableFor(o.tableId!, o.tableNumber, o.createdAt);
    t.total = round2(t.total + o.totalAmount);
    t.orders.push({
      id: o.id,
      status: o.status,
      isNew: !o.seenAt,
      total: o.totalAmount,
      createdAt: o.createdAt.toISOString(),
      notes: o.customerNotes || null,
      items: o.order_items.map((i) => ({ name: i.name, quantity: i.quantity, isVeg: i.isVeg, note: i.specialInstructions || null })),
    });
  }
  for (const r of requests) {
    tableFor(r.tableId, r.tableNumber, r.createdAt).requests.push({
      id: r.id,
      type: r.type,
      status: r.status as "OPEN" | "ACKNOWLEDGED",
      createdAt: r.createdAt.toISOString(),
    });
  }

  return [...tables.values()].sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
}
