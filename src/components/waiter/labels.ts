import type { TableState } from "@/lib/board";

export const REQUEST_LABEL = {
  CALL_WAITER: { icon: "🙋", text: "Needs help" },
  WATER: { icon: "💧", text: "Water" },
  BILL: { icon: "🧾", text: "Bill" },
  NEW_ORDER: { icon: "🛎️", text: "New order" },
} as const;

export const TABLE_STATE: Record<TableState, { label: string; tile: string; dot: string }> = {
  HELP: { label: "Needs help", tile: "border-destructive bg-destructive-soft", dot: "bg-destructive" },
  NEW_ORDER: { label: "New order", tile: "border-primary bg-primary-soft", dot: "bg-primary" },
  BILL: { label: "Bill asked", tile: "border-success bg-success-soft", dot: "bg-success" },
  EATING: { label: "Eating", tile: "border-[#74c0fc] bg-[#e7f5ff]", dot: "bg-[#1c7ed6]" },
  FREE: { label: "Free", tile: "border-border bg-card", dot: "bg-[#ced4da]" },
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  RECEIVED: "In kitchen",
  PREPARING: "In kitchen",
  READY: "Ready to serve",
  SERVED: "Served",
};
