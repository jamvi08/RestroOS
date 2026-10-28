export { cn } from "cn"

/** ₹220, ₹1,250 or ₹99.50 — whole rupees drop the decimals. */
export function formatPrice(amount: number, currency = "₹") {
  const value = Number.isInteger(amount)
    ? amount.toLocaleString("en-IN")
    : amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${currency}${value}`
}

