/**
 * Restaurants are in India and the server runs in UTC, so "today" and
 * "8 pm" are worked out in IST (UTC+5:30, no daylight saving).
 */
export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Midnight IST at the start of today, or `daysAgo` days before. */
export function istDayStart(daysAgo = 0) {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() - daysAgo) - IST_OFFSET_MS);
}

/** 0–23 hour of the day in IST. */
export const istHour = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).getUTCHours();

/** "2026-10-21" in IST, for grouping by day. */
export const istDateKey = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** "21 Oct, 8:45 pm" */
export const formatDateTime = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** "8:45 pm" */
export const formatTime = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });

/** "Tue 21 Oct" */
export const formatDay = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });

/** "8 pm" for an IST hour 0–23 */
export const formatHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;
